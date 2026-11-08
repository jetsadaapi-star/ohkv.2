/**
 * One-off import of the old OHK Shop (Active eCommerce CMS, Laravel/MySQL)
 * into this store.
 *
 *   1. Export the MySQL tables to NDJSON (one JSON row per line) into a folder.
 *   2. Copy the images: node --env-file=.env scripts/legacy-import/copy-uploads.mjs <dir>
 *   3. Run:  tsx --env-file-if-exists=.env --require ./scripts/lib/finance-cli.cjs \
 *              scripts/legacy-import/import.ts <dir> [--wipe-demo]
 *
 * Idempotent: every imported row is recorded in `legacyimportmaps`
 * (kind + legacy id → new id), so a re-run skips what is already in and only
 * fills what is missing. Passwords keep their bcrypt hash; sign-in accepts it
 * (lib/auth/legacy-password.ts).
 */
import { readFileSync, existsSync } from "node:fs";
import { Types } from "mongoose";
import { connectDB, mongoose } from "@/lib/db";
import {
  AdminProfile,
  BarcodeRegistry,
  BlogCategory,
  BlogPost,
  Brand,
  Cart,
  Category,
  Collection,
  Order,
  Product,
  Review,
  Settings,
  User,
  Vendor,
  VendorFollow,
  Wishlist,
} from "@/models";
import { getSettings } from "@/models/settings.model";
import { ADMIN_PERMISSIONS } from "@/config/permissions.config";
import { matchKalasinDistrict, KALASIN_DISTRICTS } from "@/config/kalasin-districts";
import { slugify } from "@/lib/strings";
import { createVendorWithOwner } from "@/lib/vendors/vendor-create";
import { ensureDefaultVendorId } from "@/lib/vendors/multi-vendor";
import { ensureCustomerProfile, refreshCustomerStats } from "@/lib/customers/customer";
import { importProductsJson } from "@/lib/products/import-export";
import { resolveProductFeatures } from "@/lib/products/product-features";
import { taxClassOptions } from "@/lib/tax/tax-settings";
import { createTeamRole } from "@/lib/access/team-role-service";
import { adminProfileTeamFields, fullTeamAccess } from "@/lib/access/team-permissions";
import { setMarketingConsent } from "@/lib/customers/marketing-consent";
import { recomputeProductRating } from "@/lib/catalog/reviews";
import {
  normalizeContentPagesSettings,
  slugifyContentPageHandle,
  RESERVED_CONTENT_PAGE_HANDLES,
} from "@/lib/site-config/content-pages-config";

/* ------------------------------------------------------------------ */
/* Input                                                               */
/* ------------------------------------------------------------------ */

const DIR = process.argv[2];
const WIPE_DEMO = process.argv.includes("--wipe-demo");
if (!DIR || !existsSync(DIR)) {
  console.error("Usage: import.ts <legacy-ndjson-dir> [--wipe-demo]");
  process.exit(1);
}

type Row = Record<string, any>;
function table(name: string): Row[] {
  const path = `${DIR}/${name}.ndjson`;
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
}
const uploadMap: Record<string, string> = existsSync(`${DIR}/upload-map.json`)
  ? JSON.parse(readFileSync(`${DIR}/upload-map.json`, "utf8"))
  : {};

function img(id: unknown): string | undefined {
  if (id === null || id === undefined || id === "") return undefined;
  return uploadMap[String(id).trim()];
}
function imgs(list: unknown): string[] {
  if (!list) return [];
  return String(list)
    .split(",")
    .map((s) => img(s.trim()))
    .filter((u): u is string => Boolean(u));
}
function date(value: unknown): Date | undefined {
  if (!value) return undefined;
  const d = new Date(String(value).replace(" ", "T") + (String(value).includes("Z") ? "" : "+07:00"));
  return Number.isNaN(d.getTime()) ? undefined : d;
}
function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}
/**
 * HTML pasted from Word into the old editor: inline styles, `mso-*`
 * properties, conditional comments and empty spans. Dropping them keeps every
 * word and tag that carries meaning (p, strong, ul/li, img, a, tables) and
 * typically shrinks a description to a tenth of its size.
 */
function cleanHtml(html: string): string {
  return html
    .replace(/<!--\[if[\s\S]*?<!\[endif\]-->/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<\/?o:p[^>]*>/gi, "")
    .replace(/\s(style|class|lang|dir|id|align|data-[\w-]+)="[^"]*"/gi, "")
    .replace(/<\/?(span|font)[^>]*>/gi, "")
    .replace(/<img[^>]+src="data:[^"]+"[^>]*>/gi, "")
    .replace(/<p>(\s|&nbsp;)*<\/p>/gi, "")
    .replace(/\n{2,}/g, "\n")
    .trim();
}
/** Within the product limit: cleaned HTML, else the plain text as paragraphs. */
function productDescription(html: string, max = 10000): string {
  const cleaned = cleanHtml(html);
  if (cleaned.length <= max) return cleaned;
  const plain = stripHtml(cleaned);
  return plain.length <= max - 7 ? `<p>${plain}</p>` : `<p>${plain.slice(0, max - 10)}…</p>`;
}
function asciiSlug(value: unknown, fallback: string): string {
  const s = slugify(text(value));
  return s && s.length >= 3 && !/^\d+$/.test(s) ? s : fallback;
}
const report: Record<string, string[]> = {};
function note(section: string, message: string) {
  (report[section] ??= []).push(message);
}

/* ------------------------------------------------------------------ */
/* Id map (idempotency)                                                */
/* ------------------------------------------------------------------ */

const mapCol = () => mongoose.connection.collection("legacyimportmaps");
async function getMap(kind: string, legacyId: unknown): Promise<string | undefined> {
  const row = await mapCol().findOne({ kind, legacyId: String(legacyId) });
  return row ? String(row.newId) : undefined;
}
async function setMap(kind: string, legacyId: unknown, newId: unknown) {
  await mapCol().updateOne(
    { kind, legacyId: String(legacyId) },
    { $set: { newId: String(newId), at: new Date() } },
    { upsert: true },
  );
}
async function allMap(kind: string): Promise<Map<string, string>> {
  const rows = await mapCol().find({ kind }).toArray();
  return new Map(rows.map((r) => [String(r.legacyId), String(r.newId)]));
}

/* ------------------------------------------------------------------ */
/* Legacy lookups                                                      */
/* ------------------------------------------------------------------ */

const L = {
  users: table("users"),
  shops: table("shops"),
  products: table("products"),
  stocks: table("product_stocks"),
  productTr: table("product_translations"),
  productTaxes: table("product_taxes"),
  categories: table("categories"),
  categoryTr: table("category_translations"),
  brands: table("brands"),
  brandTr: table("brand_translations"),
  addresses: table("addresses"),
  states: table("states"),
  cities: table("cities"),
  reviews: table("reviews"),
  blogs: table("blogs"),
  blogCategories: table("blog_categories"),
  pages: table("pages"),
  pageTr: table("page_translations"),
  orders: table("orders"),
  orderDetails: table("order_details"),
  staff: table("staff"),
  roles: table("roles"),
  permissions: table("permissions"),
  rolePermissions: table("role_has_permissions"),
  follows: table("follow_sellers"),
  subscribers: table("subscribers"),
  colors: table("colors"),
  attributes: table("attributes"),
  attributeTr: table("attribute_translations"),
  settings: table("business_settings"),
  commissions: table("commission_histories"),
};
const stateName = new Map(L.states.map((s) => [String(s.id), text(s.name)]));
const cityName = new Map(L.cities.map((c) => [String(c.id), text(c.name)]));
const thTr = (rows: Row[], key: string, id: unknown, field = "name") =>
  text(rows.find((r) => String(r[key]) === String(id) && r.lang === "th")?.[field]);
const setting = (type: string) => L.settings.find((s) => s.type === type)?.value;

const PLACEHOLDER_DOMAIN = "no-email.invalid";
const EMAIL_RE = /^\S+@\S+\.\S+$/;
function legacyEmail(u: Row): { email: string; real: boolean } {
  const e = text(u.email).toLowerCase();
  if (e && EMAIL_RE.test(e)) return { email: e, real: true };
  // The legacy id makes it unique: two old accounts can share a phone number.
  return { email: `legacy-${u.id}@${PLACEHOLDER_DOMAIN}`, real: false };
}

/* ------------------------------------------------------------------ */
/* Steps                                                               */
/* ------------------------------------------------------------------ */

async function wipeDemo() {
  if (await getMap("meta", "demo-wiped")) return;
  const counts = {
    products: (await Product.deleteMany({})).deletedCount,
    barcodes: (await BarcodeRegistry.deleteMany({})).deletedCount,
    categories: (await Category.deleteMany({})).deletedCount,
    brands: (await Brand.deleteMany({})).deletedCount,
    collections: (await Collection.deleteMany({})).deletedCount,
    blogPosts: (await BlogPost.deleteMany({})).deletedCount,
    blogCategories: (await BlogCategory.deleteMany({})).deletedCount,
    reviews: (await Review.deleteMany({})).deletedCount,
    wishlists: (await Wishlist.deleteMany({})).deletedCount,
    carts: (await Cart.deleteMany({})).deletedCount,
  };
  await setMap("meta", "demo-wiped", "1");
  console.log("✓ demo data removed", counts);
}

async function importUsers(adminId: string) {
  const accounts = mongoose.connection.collection("account");
  let created = 0;
  for (const u of L.users) {
    if (await getMap("user", u.id)) continue;
    const { email, real } = legacyEmail(u);

    // The old admin is this store's admin (same address): one account.
    const existing = await User.findOne({ email }).select("_id").lean<{ _id: Types.ObjectId } | null>();
    if (existing) {
      await setMap("user", u.id, existing._id);
      if (u.user_type !== "admin") note("users", `${email} already existed — linked, not recreated`);
      continue;
    }

    const role = u.user_type === "staff" ? "admin" : "customer";
    const userAddresses = L.addresses
      .filter((a) => String(a.user_id) === String(u.id))
      .map((a) => {
        const city = cityName.get(String(a.city_id)) || stateName.get(String(a.state_id)) || "";
        return {
          firstName: text(u.name).split(/\s+/)[0] || text(u.name),
          lastName: text(u.name).split(/\s+/).slice(1).join(" "),
          street: text(a.address) || city,
          city,
          state: stateName.get(String(a.state_id)) || "",
          postalCode: text(a.postal_code),
          country: "Thailand",
          phone: text(a.phone) || text(u.phone),
          isDefault: Number(a.set_default) === 1,
          label: "home",
        };
      })
      .filter((a) => a.street && a.city);

    const createdAt = date(u.created_at) ?? new Date();
    const doc = new User({
      name: text(u.name).slice(0, 100) || email.split("@")[0],
      email,
      emailVerified: real,
      ...(real ? { emailVerifiedAt: date(u.email_verified_at) ?? createdAt } : {}),
      phone: text(u.phone) || undefined,
      image: img(u.avatar_original),
      role,
      roles: [role],
      status: Number(u.banned) === 1 ? "banned" : "active",
      addresses: userAddresses,
    });
    const err = doc.validateSync();
    if (err) {
      note("users", `skipped legacy user ${u.id} (${email}): ${err.message}`);
      continue;
    }
    const obj = doc.toObject({ virtuals: false });
    obj.createdAt = createdAt;
    obj.updatedAt = date(u.updated_at) ?? createdAt;
    await User.collection.insertOne(obj);

    if (text(u.password)) {
      await accounts.insertOne({
        userId: obj._id,
        accountId: String(obj._id),
        providerId: "credential",
        password: text(u.password),
        createdAt,
        updatedAt: createdAt,
      });
    }
    if (role === "customer") await ensureCustomerProfile(String(obj._id));
    if (!real) note("users", `no email: legacy user ${u.id} "${u.name}" → ${email} (needs a real email to sign in)`);
    await setMap("user", u.id, obj._id);
    created++;
  }
  console.log(`✓ users: ${created} created`);
}

function shopDistrict(shop: Row, owner: Row | undefined): string | undefined {
  const haystack = [shop.address, owner?.address, owner?.city, shop.name].map(text).join(" ");
  const hits = KALASIN_DISTRICTS.filter((d) => haystack.includes(d.th));
  if (hits.length >= 1) return hits[0].code;
  // ต.โพน is in อ.คำม่วง (the home of Phrae Wa silk).
  if (haystack.includes("โพน")) return "kham-muang";
  return matchKalasinDistrict(text(owner?.city)) ?? undefined;
}

async function importVendors(adminId: string) {
  const settings = await getSettings();
  const users = new Map(L.users.map((u) => [String(u.id), u]));
  let created = 0;
  for (const shop of L.shops) {
    if (await getMap("vendor", shop.id)) continue;
    const owner = users.get(String(shop.user_id));
    const ownerNewId = await getMap("user", shop.user_id);
    if (!owner || !ownerNewId) {
      note("vendors", `shop ${shop.id} "${shop.name}" has no owner account — skipped`);
      continue;
    }
    const ownerUser = await User.findById(ownerNewId).select("email name phone").lean<{ email: string; name: string; phone?: string }>();
    const district = shopDistrict(shop, owner);
    if (!district) note("vendors", `shop ${shop.id} "${shop.name}": district not found — set it in the admin`);
    const commission = Number(shop.commission_percentage);
    const result = await createVendorWithOwner(
      {
        storeName: text(shop.name).slice(0, 100),
        ownerName: ownerUser?.name || text(owner.name),
        ownerEmail: ownerUser!.email,
        ownerPhone: text(shop.phone) || ownerUser?.phone,
        slug: asciiSlug(shop.slug, `shop-${shop.id}`),
        // Every old shop was selling; its verification was only the badge.
        status: "approved",
        description: text(shop.meta_description).slice(0, 1000) || undefined,
        logo: img(shop.logo),
        banner: img(shop.banner_full_width_1) ?? imgs(shop.top_banner)[0] ?? imgs(shop.sliders)[0],
        ...(commission > 0 && commission <= 100 ? { commission } : {}),
        address: {
          street: text(shop.address),
          city: "",
          state: "",
          postalCode: (text(shop.address).match(/\b4\d{4}\b/) ?? [""])[0],
          country: "TH",
          phone: text(shop.phone),
        } as never,
        district,
        verified: Number(shop.verification_status) === 1,
      },
      { userId: adminId },
      { settings, existingAccount: "fill" },
    ).catch((error: Error) => {
      note("vendors", `shop ${shop.id} "${shop.name}": ${error.message}`);
      return null;
    });
    if (!result) continue;

    const bank = {
      accountName: text(shop.bank_acc_name),
      accountNumber: text(shop.bank_acc_no),
      bankName: text(shop.bank_name),
      routingNumber: text(shop.bank_routing_no),
    };
    const social = {
      facebook: text(shop.facebook),
      instagram: text(shop.instagram),
      twitter: text(shop.twitter),
    };
    await Vendor.updateOne(
      { _id: result.vendorId },
      {
        $set: {
          ...(Object.values(bank).some(Boolean) ? { bankDetails: bank } : {}),
          ...(Object.values(social).some(Boolean) ? { socialLinks: social } : {}),
          createdAt: date(shop.created_at) ?? new Date(),
        },
      },
      { timestamps: false },
    );
    await setMap("vendor", shop.id, result.vendorId);
    await setMap("vendorByUser", shop.user_id, result.vendorId);
    created++;
  }
  console.log(`✓ vendors: ${created} created`);
}

async function uniqueSlug(Model: any, base: string): Promise<string> {
  for (let n = 1; n < 200; n++) {
    const candidate = n === 1 ? base : `${base}-${n}`;
    if (!(await Model.exists({ slug: candidate }))) return candidate;
  }
  return `${base}-${Date.now()}`;
}

async function importCategories() {
  const sorted = [...L.categories].sort((a, b) => Number(a.level) - Number(b.level));
  let created = 0;
  for (const c of sorted) {
    if (await getMap("category", c.id)) continue;
    const parentId = Number(c.parent_id) ? await getMap("category", c.parent_id) : undefined;
    const name = (thTr(L.categoryTr, "category_id", c.id) || text(c.name)).slice(0, 100);
    const cat = await Category.create({
      name,
      slug: await uniqueSlug(Category, asciiSlug(c.slug, `category-${c.id}`)),
      image: img(c.banner) ?? img(c.cover_image),
      icon: img(c.icon),
      parentId: parentId ? new Types.ObjectId(parentId) : undefined,
      isActive: true,
      featured: Number(c.featured) === 1,
      order: Number(c.order_level) || 0,
      ...(text(c.meta_title) || text(c.meta_description)
        ? {
            seo: {
              pageTitle: text(c.meta_title).slice(0, 70),
              metaDescription: text(c.meta_description).slice(0, 320),
            },
          }
        : {}),
    });
    await setMap("category", c.id, cat._id);
    created++;
  }
  console.log(`✓ categories: ${created} created`);
}

async function importBrands() {
  let created = 0;
  for (const b of L.brands) {
    if (await getMap("brand", b.id)) continue;
    const brand = await Brand.create({
      name: (thTr(L.brandTr, "brand_id", b.id) || text(b.name)).slice(0, 100),
      slug: await uniqueSlug(Brand, asciiSlug(b.slug, `brand-${b.id}`)),
      logo: img(b.logo),
      isActive: true,
      approvalStatus: "approved",
      featured: Number(b.top) === 1,
    });
    await setMap("brand", b.id, brand._id);
    created++;
  }
  console.log(`✓ brands: ${created} created`);
}

/** Active eCommerce variant names are "<colour>-<value>-<value>…". */
function buildVariants(p: Row, stocks: Row[], discounted: (price: number) => number) {
  const colorCodes: string[] = (() => {
    try { return JSON.parse(p.colors || "[]"); } catch { return []; }
  })();
  const choices: Array<{ attribute_id: string; values: string[] }> = (() => {
    try { return JSON.parse(p.choice_options || "[]"); } catch { return []; }
  })();
  const hasColor = colorCodes.length > 0;
  const optionNames = [
    ...(hasColor ? ["สี"] : []),
    ...choices.map((c) => {
      const name = thTr(L.attributeTr, "attribute_id", c.attribute_id) ||
        text(L.attributes.find((a) => String(a.id) === String(c.attribute_id))?.name) || "ตัวเลือก";
      return name.replace(/\s*Size$/i, "").trim() || "ขนาด";
    }),
  ];
  const parts = stocks.map((s) => text(s.variant).split("-"));
  const consistent = optionNames.length > 0 && parts.every((p) => p.length === optionNames.length);
  const names = consistent ? optionNames : ["ตัวเลือก"];
  const rows = consistent ? parts : stocks.map((s) => [text(s.variant)]);
  const colorByName = new Map(L.colors.map((c) => [text(c.name), text(c.code)]));
  const options = names.map((name, i) => {
    const values = [...new Set(rows.map((r) => r[i]).filter(Boolean))];
    return {
      name,
      values: values.map((v) =>
        name === "สี" && colorByName.get(v) ? { value: v, colorCode: colorByName.get(v) } : v,
      ),
    };
  });
  // The old store's discount applied to every variant, so each variant sells
  // at its discounted price with its own full price as the compare-at.
  const variants = stocks.map((s, i) => {
    const full = Number(s.price) || 0;
    const sale = discounted(full);
    return {
    optionValues: Object.fromEntries(names.map((n, j) => [n, rows[i][j]])),
    price: sale || undefined,
    ...(sale < full ? { comparePrice: full } : {}),
    stock: Math.max(0, Number(s.qty) || 0),
    ...(text(s.sku) ? { sku: text(s.sku) } : {}),
    };
  });
  return { options, variants };
}

async function importProducts(defaultVendorId: string) {
  const settings = await getSettings();
  const categoryMap = await allMap("category");
  const brandMap = await allMap("brand");
  const vendorByUser = await allMap("vendorByUser");
  const fallbackCategory = categoryMap.get("20") ?? [...categoryMap.values()][0];
  const now = Date.now() / 1000;
  const usedSlugs = new Set<string>();
  const seenSkus = new Set<string>();

  const records = L.products.map((p) => {
    const stocks = L.stocks.filter((s) => String(s.product_id) === String(p.id));
    const unit = Number(p.unit_price) || 0;
    const discount = Number(p.discount) || 0;
    const inWindow =
      (!p.discount_start_date || Number(p.discount_start_date) <= now) &&
      (!p.discount_end_date || Number(p.discount_end_date) >= now);
    const discounted = (base: number) =>
      discount > 0 && inWindow
        ? Math.round(
            Math.max(0, p.discount_type === "percent" ? base * (1 - discount / 100) : base - discount) * 100,
          ) / 100
        : base;
    const price = discounted(unit);
    const tax = L.productTaxes.find((t) => String(t.product_id) === String(p.id));
    const taxRate = tax && tax.tax_type === "percent" ? Number(tax.tax) : 0;
    let slug = asciiSlug(p.slug, `otop-${p.id}`);
    if (usedSlugs.has(slug)) slug = `${slug}-${p.id}`;
    usedSlugs.add(slug);
    const vendorId =
      p.added_by === "admin" ? defaultVendorId : vendorByUser.get(String(p.user_id)) ?? defaultVendorId;
    const images = [
      ...new Set([
        ...imgs(p.thumbnail_img),
        ...imgs(p.photos),
        ...stocks.map((s) => img(s.image)).filter((u): u is string => Boolean(u)),
      ]),
    ].slice(0, 250);
    const variantProduct = Number(p.variant_product) === 1 && stocks.length > 0 && stocks.some((s) => text(s.variant));
    const sku = text(stocks[0]?.sku);
    const record: Record<string, unknown> = {
      title: (thTr(L.productTr, "product_id", p.id) || text(p.name)).slice(0, 200),
      slug,
      description: productDescription(
        thTr(L.productTr, "product_id", p.id, "description") || text(p.description) || text(p.name),
      ),
      price,
      ...(price < unit ? { comparePrice: unit } : {}),
      ...(Number(p.purchase_price) > 0 ? { cost: Number(p.purchase_price) } : {}),
      status: Number(p.published) === 1 && Number(p.approved) === 1 ? "active" : "draft",
      categoryId: categoryMap.get(String(p.category_id)) ?? fallbackCategory,
      ...(brandMap.get(String(p.brand_id)) ? { brandId: brandMap.get(String(p.brand_id)) } : {}),
      tags: text(p.tags),
      images,
      featured: Number(p.featured) === 1,
      vendorId,
      weight: Number(p.weight) > 0 ? String(p.weight) : "",
      weightUnit: "kg",
      isPhysicalProduct: Number(p.digital) !== 1,
      chargeTax: taxRate > 0,
      ...(taxRate > 0 ? { taxRate } : {}),
    };
    if (variantProduct) {
      const { options, variants } = buildVariants(p, stocks, discounted);
      record.options = options;
      record.variants = variants.map((v) => {
        if (v.sku && seenSkus.has(v.sku)) delete (v as { sku?: string }).sku;
        if (v.sku) seenSkus.add(v.sku);
        return v;
      });
      record.stock = 0;
    } else {
      record.stock = Math.max(0, Number(stocks[0]?.qty ?? p.current_stock) || 0);
      if (sku && !seenSkus.has(sku)) {
        record.sku = sku;
        seenSkus.add(sku);
      }
    }
    return { legacyId: p.id, record };
  });

  const result = await importProductsJson(JSON.stringify({ products: records.map((r) => r.record) }), {
    defaultVendorId,
    productSource: "admin",
    allowVendorColumn: true,
    allowFeatured: true,
    createMissingCategories: false,
    productFeatures: resolveProductFeatures(settings),
    taxClasses: new Set(taxClassOptions(settings.tax as never).map((entry) => entry.key)),
  } as never);
  console.log(`✓ products: ${result.created} created, ${result.updated} updated, ${result.failed} failed`);
  for (const e of result.errors) {
    const legacy = records[e.row - 1];
    note("products", `legacy product ${legacy?.legacyId ?? "?"} "${legacy?.record.title ?? ""}": ${e.message}`);
  }
  for (const w of result.warnings) note("products", `warning: ${w}`);

  for (const { legacyId, record } of records) {
    const product = await Product.findOne({ slug: record.slug }).select("_id").lean<{ _id: Types.ObjectId } | null>();
    if (product) {
      await setMap("product", legacyId, product._id);
      const created = L.products.find((p) => p.id === legacyId)?.created_at;
      if (created) await Product.updateOne({ _id: product._id }, { $set: { createdAt: date(created) } }, { timestamps: false });
    }
  }
}

async function importFollows() {
  const vendorMap = await allMap("vendor");
  let n = 0;
  for (const f of L.follows) {
    const userId = await getMap("user", f.user_id);
    const vendorId = vendorMap.get(String(f.shop_id));
    if (!userId || !vendorId) continue;
    await VendorFollow.updateOne(
      { userId, vendorId },
      { $setOnInsert: { userId, vendorId } },
      { upsert: true },
    );
    n++;
  }
  console.log(`✓ follows: ${n}`);
}

async function importBlog(adminId: string) {
  let cats = 0, posts = 0;
  for (const c of L.blogCategories) {
    if (c.deleted_at || (await getMap("blogCategory", c.id))) continue;
    const cat = await BlogCategory.create({
      name: text(c.category_name).slice(0, 100),
      slug: await uniqueSlug(BlogCategory, asciiSlug(c.slug, `blog-category-${c.id}`)),
      isActive: true,
    });
    await setMap("blogCategory", c.id, cat._id);
    cats++;
  }
  for (const b of L.blogs) {
    if (b.deleted_at || (await getMap("blogPost", b.id))) continue;
    const content = cleanHtml(text(b.description) || text(b.short_description) || text(b.title));
    const catId = await getMap("blogCategory", b.category_id);
    const published = Number(b.status) === 1;
    const created = date(b.created_at) ?? new Date();
    const post = await BlogPost.create({
      title: text(b.title).slice(0, 200),
      slug: await uniqueSlug(BlogPost, asciiSlug(b.slug, `post-${b.id}`)),
      content,
      excerpt: stripHtml(text(b.short_description) || content).slice(0, 500),
      authorId: new Types.ObjectId(adminId),
      authorName: "Oh-K Shop",
      ...(img(b.banner) ? { featuredImage: { url: img(b.banner), alt: text(b.title).slice(0, 200) } } : {}),
      categoryIds: catId ? [new Types.ObjectId(catId)] : [],
      status: published ? "published" : "draft",
      visibility: "public",
      publishedAt: published ? created : undefined,
      readingTime: Math.max(1, Math.round(stripHtml(content).split(/\s+/).length / 200)),
      seo: {
        pageTitle: text(b.meta_title).slice(0, 70),
        metaDescription: text(b.meta_description).slice(0, 320),
        ...(img(b.meta_img) ? { ogImage: img(b.meta_img) } : {}),
      },
    });
    await BlogPost.updateOne({ _id: post._id }, { $set: { createdAt: created } }, { timestamps: false });
    await setMap("blogPost", b.id, post._id);
    posts++;
  }
  console.log(`✓ blog: ${cats} categories, ${posts} posts`);
}

async function importPagesAndSettings() {
  if (await getMap("meta", "pages")) return;
  const doc = await Settings.findOne({});
  if (!doc) return;
  const pages = normalizeContentPagesSettings((doc as any).contentPages) as any;
  const content = (p: Row) =>
    text(L.pageTr.find((t) => String(t.page_id) === String(p.id) && t.lang === "th")?.content) || text(p.content);
  const titleOf = (p: Row) =>
    text(L.pageTr.find((t) => String(t.page_id) === String(p.id) && t.lang === "th")?.title) || text(p.title);
  const nowIso = new Date().toISOString();
  pages.customPages = Array.isArray(pages.customPages) ? pages.customPages : [];
  for (const p of L.pages) {
    if (p.type === "home_page") continue;
    const body = content(p);
    if (!body) continue;
    if (p.type === "terms_conditions_page") {
      pages.terms = { ...pages.terms, title: titleOf(p), content: body, visible: true };
    } else if (p.type === "privacy_policy_page") {
      pages.privacy = { ...pages.privacy, title: titleOf(p), content: body, visible: true };
    } else {
      let handle = slugifyContentPageHandle(text(p.slug)) || `page-${p.id}`;
      if ((RESERVED_CONTENT_PAGE_HANDLES as Set<string>).has(handle)) handle = `${handle}-info`;
      if (pages.customPages.some((cp: any) => cp.handle === handle)) continue;
      pages.customPages.push({
        id: `legacy-${p.id}`,
        title: titleOf(p),
        handle,
        content: body,
        metaTitle: text(p.meta_title),
        metaDescription: text(p.meta_description),
        visible: true,
        createdAt: (date(p.created_at) ?? new Date()).toISOString(),
        updatedAt: nowIso,
      });
    }
  }
  const about = text(setting("about_us_description"));
  if (about && pages.about) pages.about = { ...pages.about, storyBody: about };
  (doc as any).contentPages = pages;
  doc.markModified("contentPages");
  const phone = text(setting("contact_phone"));
  const address = text(setting("contact_address"));
  if (phone) doc.set("general.storePhone", phone);
  if (address) doc.set("general.storeAddress", address);
  await doc.save();
  await setMap("meta", "pages", "1");
  console.log(`✓ pages: terms, privacy, ${pages.customPages.length} custom pages; store contact`);
}

/** Legacy permission names → the new team permissions, by area. */
const PERMISSION_RULES: Array<[RegExp, string[], string[]]> = [
  // [pattern, view grants, write grants (when the legacy name adds/edits/deletes)]
  [/product|digital|attribute|color|classified|bulk/, ["view_products"], ["manage_products", "create_products", "edit_products", "delete_products"]],
  [/categor/, ["view_categories"], ["manage_categories", "create_categories", "edit_categories", "delete_categories"]],
  [/brand/, ["view_brands"], ["manage_brands", "create_brands", "edit_brands", "delete_brands"]],
  [/review/, ["view_reviews"], ["manage_reviews", "edit_reviews"]],
  [/order|pickup_point/, ["view_orders"], ["manage_orders", "edit_orders"]],
  [/refund/, ["view_returns"], ["manage_returns"]],
  [/customer|user_search|club_point/, ["view_customers", "view_users"], ["manage_customers", "edit_customers", "manage_users"]],
  [/seller/, ["view_vendors"], ["manage_vendors"]],
  [/pay_to|payout|commission|wallet|earning|payment_history/, ["view_payouts", "view_finance"], ["manage_payouts"]],
  [/report|dashboard/, ["view_dashboard", "view_analytics"], []],
  [/blog|website_page|note/, ["view_content"], ["manage_content"]],
  [/header|footer|appearance|homepage|layout/, ["view_online_store"], ["manage_online_store"]],
  [/flash_deal|coupon|newsletter|subscriber|custom_alert|popup|marketing|sms/, ["view_marketing", "view_campaign_banners"], ["manage_marketing", "manage_campaign_banners"]],
  [/support_ticket|quer|conversation/, ["view_inbox"], ["reply_inbox"]],
  [/staff/, ["view_team"], ["create_team_members"]],
  [/setting|configuration|setup|smtp|language|currency|addon|system|server|otp|zone|shipping|payment_method/, ["view_settings"], ["manage_settings"]],
  [/pos_/, ["access_pos"], ["manage_pos"]],
];
const WRITE_WORDS = /^(add|edit|delete|update|publish|approve|ban|pay|reply|send|accept|reject|manage|set|login_as|featured|export|product_bulk)|_(edit|delete|duplicate|configuration|setup|import)$/;

async function importStaff(adminId: string) {
  const permName = new Map(L.permissions.map((p) => [String(p.id), text(p.name)]));
  const roleIdMap = new Map<string, any>();
  const actor = fullTeamAccess(adminId, { isOwner: true });
  for (const r of L.roles) {
    if (Number(r.id) === 1) continue; // Super Admin: never handed out by an import.
    const members = L.staff.filter((s) => String(s.role_id) === String(r.id));
    if (members.length === 0) continue;
    const existingId = await getMap("teamRole", r.id);
    if (existingId) {
      roleIdMap.set(String(r.id), existingId);
      continue;
    }
    const granted = new Set<string>();
    for (const rp of L.rolePermissions.filter((x) => String(x.role_id) === String(r.id))) {
      const name = permName.get(String(rp.permission_id)) ?? "";
      for (const [pattern, view, write] of PERMISSION_RULES) {
        if (!pattern.test(name)) continue;
        view.forEach((p) => granted.add(p));
        if (WRITE_WORDS.test(name)) write.forEach((p) => granted.add(p));
      }
    }
    granted.add("view_dashboard");
    const role = await createTeamRole(
      {
        name: text(r.name).slice(0, 60),
        description: "นำเข้าจากระบบเดิม (OHK Shop)",
        tier: "admin",
        permissions: [...granted],
      } as never,
      actor,
      { userId: adminId, userRole: "admin" } as never,
    ).catch((error: Error) => {
      note("staff", `role "${r.name}": ${error.message}`);
      return null;
    });
    if (!role) continue;
    const roleId = (role as any).id ?? (role as any)._id;
    roleIdMap.set(String(r.id), String(roleId));
    await setMap("teamRole", r.id, roleId);
  }

  const { TeamRole } = await import("@/models");
  let members = 0;
  for (const s of L.staff) {
    const userId = await getMap("user", s.user_id);
    const roleId = roleIdMap.get(String(s.role_id));
    if (!userId || !roleId) continue;
    const role = await TeamRole.findById(roleId).lean<any>();
    if (!role) continue;
    await AdminProfile.updateOne(
      { userId: new Types.ObjectId(userId) },
      {
        $set: {
          permissions: Object.values(ADMIN_PERMISSIONS),
          isSuperAdmin: false,
          department: text(role.name),
          ...adminProfileTeamFields(role, [], []),
        },
        $setOnInsert: { userId: new Types.ObjectId(userId) },
      },
      { upsert: true },
    );
    members++;
  }
  console.log(`✓ staff: ${roleIdMap.size} roles, ${members} team members`);
}

const DELIVERY_STATUS: Record<string, string> = {
  pending: "pending",
  confirmed: "processing",
  picked_up: "shipped",
  on_the_way: "shipped",
  delivered: "delivered",
  cancelled: "cancelled",
};

async function importOrders() {
  const productMap = await allMap("product");
  let created = 0;
  let walkInId: string | undefined;
  for (const o of L.orders) {
    if (await getMap("order", o.id)) continue;
    let customerId = o.user_id ? await getMap("user", o.user_id) : undefined;
    if (!customerId) {
      if (!walkInId) {
        const email = `walk-in@${PLACEHOLDER_DOMAIN}`;
        let walkIn = await User.findOne({ email }).select("_id").lean<any>();
        if (!walkIn) {
          walkIn = await User.create({
            name: "ลูกค้าหน้าร้าน (ระบบเดิม)",
            email,
            role: "customer",
            roles: ["customer"],
            status: "inactive",
          });
          await ensureCustomerProfile(String(walkIn._id));
        }
        walkInId = String(walkIn._id);
      }
      customerId = walkInId;
    }
    const at = date(o.created_at) ?? new Date();
    let ship: Row = {};
    try { ship = JSON.parse(o.shipping_address || "{}"); } catch {}
    const details = L.orderDetails.filter((d) => String(d.order_id) === String(o.id));
    const items: any[] = [];
    for (const d of details) {
      const productId = productMap.get(String(d.product_id));
      if (!productId) {
        note("orders", `order ${o.code}: product ${d.product_id} not imported — line skipped`);
        continue;
      }
      const product = await Product.findById(productId).select("name vendorId sku images variants").lean<any>();
      if (!product) continue;
      const qty = Math.max(1, Number(d.quantity) || 1);
      const variant = text(d.variation)
        ? product.variants?.find((v: any) => v.name === text(d.variation) || v.name?.replace(/ \/ /g, "-") === text(d.variation))
        : undefined;
      items.push({
        productId: product._id,
        vendorId: product.vendorId,
        ...(variant ? { variantId: variant._id, variantLabel: variant.name } : text(d.variation) ? { variantLabel: text(d.variation) } : {}),
        name: product.name,
        sku: variant?.sku || product.sku || `OHK-${d.product_id}`,
        price: Math.round((Number(d.price) / qty) * 100) / 100,
        quantity: qty,
        image: product.images?.[0],
      });
    }
    if (items.length === 0) {
      note("orders", `order ${o.code}: no importable lines — skipped`);
      continue;
    }
    const status = DELIVERY_STATUS[text(o.delivery_status)] ?? "pending";
    const paid = text(o.payment_status) === "paid";
    const subtotal = details.reduce((s, d) => s + Number(d.price || 0), 0);
    const shippingCost = details.reduce((s, d) => s + Number(d.shipping_cost || 0), 0);
    const tax = details.reduce((s, d) => s + Number(d.tax || 0), 0);
    const byVendor = new Map<string, any[]>();
    for (const item of items) {
      const key = String(item.vendorId);
      byVendor.set(key, [...(byVendor.get(key) ?? []), item]);
    }
    const subOrders = [...byVendor.entries()].map(([vendorId, lines]) => {
      const sub = lines.reduce((s, l) => s + l.price * l.quantity, 0);
      const commission = L.commissions
        .filter((c) => String(c.order_id) === String(o.id))
        .reduce((s, c) => s + Number(c.admin_commission || 0), 0);
      return {
        vendorId: new Types.ObjectId(vendorId),
        items: lines,
        subtotal: sub,
        shippingCost: byVendor.size === 1 ? shippingCost : 0,
        commission: byVendor.size === 1 ? commission : 0,
        vendorEarnings: sub - (byVendor.size === 1 ? commission : 0),
        status,
        paymentStatus: paid ? "paid" : "pending",
        ...(paid ? { paidAt: at } : {}),
        ...(status === "delivered" ? { deliveredAt: date(o.delivered_date) ?? at } : {}),
        // Settled history: not owed to anyone in the new books.
        payoutStatus: "paid",
        payoutDate: at,
        commissionSettledAt: at,
        codCollectedBy: "vendor",
      };
    });
    const name = text(ship.name) || "ลูกค้า";
    const doc = new Order({
      orderNumber: `OHK-${text(o.code)}`,
      customerId: new Types.ObjectId(customerId),
      items,
      subOrders,
      shippingAddress: {
        fullName: name,
        firstName: name.split(/\s+/)[0],
        lastName: name.split(/\s+/).slice(1).join(" "),
        street: text(ship.address) || "-",
        city: text(ship.city) || text(ship.state) || "-",
        state: text(ship.state) || "-",
        postalCode: text(ship.postal_code),
        country: text(ship.country) || "Thailand",
        phone: text(ship.phone),
      },
      paymentMethod: "cod",
      subtotal,
      shippingCost,
      tax,
      discount: Number(o.coupon_discount) || 0,
      total: Number(o.grand_total) || subtotal + shippingCost + tax,
      currency: "THB",
      status,
      paymentStatus: paid ? "paid" : "pending",
      ...(paid ? { paidAt: at } : {}),
      ...(status === "delivered" ? { deliveredAt: date(o.delivered_date) ?? at } : {}),
      channel: "online",
      notes: `นำเข้าจากระบบเดิม (OHK Shop) เลขที่ ${text(o.code)}`,
      ...(text(o.additional_info) ? { customerNote: text(o.additional_info) } : {}),
      ...(text(ship.email) ? { guestEmail: text(ship.email).toLowerCase() } : {}),
      contactPhone: text(ship.phone),
    });
    const err = doc.validateSync();
    if (err) {
      note("orders", `order ${o.code}: ${err.message}`);
      continue;
    }
    const obj = doc.toObject({ virtuals: false });
    obj.createdAt = at;
    obj.updatedAt = date(o.updated_at) ?? at;
    await Order.collection.insertOne(obj);
    await setMap("order", o.id, obj._id);
    created++;
  }
  const customers = new Set((await Order.find({ notes: /ระบบเดิม/ }).select("customerId").lean<any[]>()).map((o) => String(o.customerId)));
  for (const id of customers) await refreshCustomerStats(id).catch(() => {});
  console.log(`✓ orders: ${created} created`);
}

async function importReviews() {
  const productMap = await allMap("product");
  let n = 0;
  for (const r of L.reviews) {
    if (await getMap("review", r.id)) continue;
    const productId = productMap.get(String(r.product_id));
    const userId = r.user_id ? await getMap("user", r.user_id) : undefined;
    if (!productId || !userId) {
      note("reviews", `review ${r.id}: product or reviewer not imported — skipped`);
      continue;
    }
    const order = await Order.findOne({ customerId: userId, "items.productId": productId }).select("_id").lean<any>();
    if (!order) {
      note("reviews", `review ${r.id} (${r.rating}★ "${text(r.comment).slice(0, 40)}"): the new store ties a review to an order and this one has none — skipped`);
      continue;
    }
    const review = await Review.create({
      productId,
      userId,
      orderId: order._id,
      rating: Math.min(5, Math.max(1, Number(r.rating) || 5)),
      comment: text(r.comment).slice(0, 1000) || "-",
      images: imgs(r.photos),
      isVerified: true,
      isApproved: Number(r.status) === 1,
    });
    await setMap("review", r.id, review._id);
    await recomputeProductRating(productId);
    n++;
  }
  console.log(`✓ reviews: ${n}`);
}

async function importSubscribers() {
  let n = 0;
  for (const s of L.subscribers) {
    const email = text(s.email).toLowerCase();
    if (!EMAIL_RE.test(email) || (await getMap("subscriber", s.id))) continue;
    const user = await User.findOne({ email }).select("_id").lean<any>();
    await setMarketingConsent({
      state: "subscribed",
      optInLevel: "unknown",
      source: "import",
      at: date(s.created_at),
      ...(user ? { userId: String(user._id) } : { guestEmail: email }),
      createIfMissing: true,
    } as never).catch((error: Error) => note("subscribers", `${email}: ${error.message}`));
    await setMap("subscriber", s.id, email);
    n++;
  }
  console.log(`✓ subscribers: ${n}`);
}

/* ------------------------------------------------------------------ */

async function main() {
  await connectDB();
  const admin = await User.findOne({ role: "admin" }).sort({ createdAt: 1 }).select("_id email").lean<any>();
  if (!admin) throw new Error("No admin account in the new store");
  const adminId = String(admin._id);
  const { vendorId: defaultVendorId } = await ensureDefaultVendorId({ preferredOwnerId: adminId });
  console.log(`Admin ${admin.email}, house store ${defaultVendorId}, images mapped: ${Object.keys(uploadMap).length}`);

  if (WIPE_DEMO) await wipeDemo();
  await importUsers(adminId);
  await importVendors(adminId);
  await importCategories();
  await importBrands();
  await importProducts(String(defaultVendorId));
  await importFollows();
  await importBlog(adminId);
  await importPagesAndSettings();
  await importStaff(adminId);
  await importOrders();
  await importReviews();
  await importSubscribers();

  console.log("\n===== Report =====");
  for (const [section, lines] of Object.entries(report)) {
    console.log(`\n[${section}] ${lines.length}`);
    for (const line of lines) console.log(`  - ${line}`);
  }
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});

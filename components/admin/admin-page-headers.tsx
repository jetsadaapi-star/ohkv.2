import {
  ArrowRightLeft,
  CalendarClock,
  FileText,
  FolderTree,
  Layers,
  MapPin,
  Package,
  ShoppingBag,
  Store,
  ShoppingCart,
  Star,
  Tag,
  Undo2,
  TicketPercent,
  Newspaper,
  MessageSquareText,
  Tags,
  Users,
  UsersRound,
  Warehouse,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { VendorPageHeader } from "@/components/vendor/vendor-page-header";

type HeaderTone = NonNullable<Parameters<typeof VendorPageHeader>[0]["tone"]>;

type AdminPage =
  | "orders"
  | "preorders"
  | "returns"
  | "quotes"
  | "abandoned"
  | "products"
  | "collections"
  | "categories"
  | "brands"
  | "inventory"
  | "locations"
  | "transfers"
  | "reviews"
  | "customers"
  | "vendors"
  | "staff"
  | "discounts"
  | "blogPosts"
  | "blogComments"
  | "blogCategories"
  | "inbox";

/**
 * The admin's page headings, in the look the vendor area uses: a coloured
 * icon, the title and one line on what the page is for. Server components, so
 * each page streams its heading with the shell.
 */
async function AdminHeader({
  page,
  icon,
  tone,
  actions,
}: {
  page: AdminPage;
  icon: React.ReactNode;
  tone: HeaderTone;
  actions?: React.ReactNode;
}) {
  const t = await getTranslations(`admin.hc.adminPages.${page}`);
  return (
    <VendorPageHeader icon={icon} tone={tone} title={t("title")} description={t("description")} actions={actions} />
  );
}

type HeaderProps = { actions?: React.ReactNode };

export function AdminOrdersHeader() {
  return <AdminHeader page="orders" icon={<ShoppingBag />} tone="emerald" />;
}
export function AdminPreordersHeader() {
  return <AdminHeader page="preorders" icon={<CalendarClock />} tone="violet" />;
}
export function AdminReturnsHeader() {
  return <AdminHeader page="returns" icon={<Undo2 />} tone="rose" />;
}
export function AdminQuotesHeader() {
  return <AdminHeader page="quotes" icon={<FileText />} tone="sky" />;
}
export function AdminAbandonedHeader() {
  return <AdminHeader page="abandoned" icon={<ShoppingCart />} tone="amber" />;
}
export function AdminProductsHeader({ actions }: HeaderProps) {
  return <AdminHeader page="products" icon={<Package />} tone="violet" actions={actions} />;
}
export function AdminCollectionsHeader({ actions }: HeaderProps) {
  return <AdminHeader page="collections" icon={<Layers />} tone="sky" actions={actions} />;
}
export function AdminCategoriesHeader({ actions }: HeaderProps) {
  return <AdminHeader page="categories" icon={<FolderTree />} tone="orange" actions={actions} />;
}
export function AdminBrandsHeader({ actions }: HeaderProps) {
  return <AdminHeader page="brands" icon={<Tag />} tone="rose" actions={actions} />;
}
export function AdminInventoryHeader({ actions }: HeaderProps) {
  return <AdminHeader page="inventory" icon={<Warehouse />} tone="teal" actions={actions} />;
}
export function AdminLocationsHeader({ actions }: HeaderProps) {
  return <AdminHeader page="locations" icon={<MapPin />} tone="emerald" actions={actions} />;
}
export function AdminTransfersHeader({ actions }: HeaderProps) {
  return <AdminHeader page="transfers" icon={<ArrowRightLeft />} tone="cyan" actions={actions} />;
}
export function AdminReviewsHeader({ actions }: HeaderProps) {
  return <AdminHeader page="reviews" icon={<Star />} tone="amber" actions={actions} />;
}
export function AdminCustomersHeader({ actions }: HeaderProps) {
  return <AdminHeader page="customers" icon={<Users />} tone="sky" actions={actions} />;
}
export function AdminVendorsHeader({ actions }: HeaderProps) {
  return <AdminHeader page="vendors" icon={<Store />} tone="emerald" actions={actions} />;
}
export function AdminStaffHeader({ actions }: HeaderProps) {
  return <AdminHeader page="staff" icon={<UsersRound />} tone="sky" actions={actions} />;
}
export function AdminDiscountsHeader({ actions }: HeaderProps) {
  return <AdminHeader page="discounts" icon={<TicketPercent />} tone="rose" actions={actions} />;
}
export function AdminBlogPostsHeader({ actions }: HeaderProps) {
  return <AdminHeader page="blogPosts" icon={<Newspaper />} tone="indigo" actions={actions} />;
}
export function AdminBlogCommentsHeader({ actions }: HeaderProps) {
  return <AdminHeader page="blogComments" icon={<MessageSquareText />} tone="sky" actions={actions} />;
}
export function AdminBlogCategoriesHeader({ actions }: HeaderProps) {
  return <AdminHeader page="blogCategories" icon={<Tags />} tone="orange" actions={actions} />;
}

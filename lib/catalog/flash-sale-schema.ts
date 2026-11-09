import * as z from "zod";

/** What the admin flash-sale form sends (lib/catalog/flash-sales.ts checks the rest). */
export const FlashSaleBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  items: z
    .array(
      z.object({
        productId: z.string().trim().regex(/^[a-f0-9]{24}$/i),
        discountPercent: z.coerce.number().min(1).max(90),
        quantityLimit: z.coerce.number().int().min(0).max(1_000_000).nullable().optional(),
      }),
    )
    .min(1)
    .max(100),
});


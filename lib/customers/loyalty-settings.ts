import { ValidationError } from "@/lib/api/errors";
import { isPlainObject } from "@/lib/utils";

/**
 * Shape checks for Settings → Loyalty points. Each number must be a real
 * value inside its range; whole numbers where a count of points is meant.
 * Written back normalized, so the stored values are the ones checked.
 */
export function validateLoyaltySettings(data: Record<string, unknown>) {
  if (data.enabled !== undefined && typeof data.enabled !== "boolean") {
    throw new ValidationError("Loyalty points on/off must be true or false");
  }

  const number = (
    key: string,
    label: string,
    min: number,
    max: number,
    whole: boolean,
    target: Record<string, unknown> = data,
  ) => {
    if (target[key] === undefined) return;
    const value = Number(target[key]);
    if (!Number.isFinite(value) || value < min || value > max) {
      throw new ValidationError(`${label} must be between ${min} and ${max}`);
    }
    if (whole && !Number.isInteger(value)) {
      throw new ValidationError(`${label} must be a whole number`);
    }
    target[key] = whole ? value : Math.round(value * 100) / 100;
  };

  number("spendPerPoint", "Spend per point", 0.01, 1_000_000, false);
  number("redeemPoints", "Points per redemption step", 1, 1_000_000, true);
  number("redeemValue", "Credit per redemption step", 0.01, 1_000_000, false);
  number("minRedeemPoints", "Fewest points to redeem", 1, 1_000_000, true);
  number("creditExpiryDays", "Credit lifetime", 0, 3650, true);

  if (data.tierBonus !== undefined) {
    if (!isPlainObject(data.tierBonus)) {
      throw new ValidationError("Tier bonuses are invalid");
    }
    const bonus = data.tierBonus as Record<string, unknown>;
    for (const tier of ["silver", "gold", "platinum"] as const) {
      number(tier, `The ${tier} bonus`, 0, 1000, true, bonus);
    }
    data.tierBonus = {
      ...(bonus.silver !== undefined ? { silver: bonus.silver } : {}),
      ...(bonus.gold !== undefined ? { gold: bonus.gold } : {}),
      ...(bonus.platinum !== undefined ? { platinum: bonus.platinum } : {}),
    };
  }

  if (
    data.redeemPoints !== undefined &&
    data.minRedeemPoints !== undefined &&
    Number(data.minRedeemPoints) < Number(data.redeemPoints)
  ) {
    throw new ValidationError("The fewest points to redeem can't be below one redemption step");
  }
}

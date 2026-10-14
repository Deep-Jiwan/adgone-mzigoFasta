import { z } from "zod";

/**
 * Normalises Tanzanian mobile numbers to E.164 (+255XXXXXXXXX).
 * Accepts 0712345678, 712345678, 255712345678 and +255712345678, with spaces or dashes.
 */
export function normalizeTzPhone(input: string): string | null {
  const digits = input.replace(/[\s-]/g, "").replace(/^\+/, "");
  let national: string | undefined;
  if (/^255[67]\d{8}$/.test(digits)) national = digits.slice(3);
  else if (/^0[67]\d{8}$/.test(digits)) national = digits.slice(1);
  else if (/^[67]\d{8}$/.test(digits)) national = digits;
  return national ? `+255${national}` : null;
}

export const TzPhone = z.string().transform((value, ctx) => {
  const normalized = normalizeTzPhone(value);
  if (!normalized) {
    ctx.addIssue({ code: "custom", message: "must be a Tanzanian mobile number" });
    return z.NEVER;
  }
  return normalized;
});

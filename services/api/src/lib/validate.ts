import type { Context } from "hono";
import type { z } from "zod";
import { ApiError } from "./errors";

export async function body<T extends z.ZodType>(c: Context, schema: T): Promise<z.infer<T>> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw new ApiError(400, "INVALID_JSON", "Request body must be JSON");
  }
  return parse(schema, raw);
}

export function parse<T extends z.ZodType>(schema: T, raw: unknown): z.infer<T> {
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new ApiError(400, "VALIDATION_FAILED", "Request is not valid", {
      issues: result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  }
  return result.data;
}

/** An error the client is meant to see. `code` is stable and machine-readable; `message` is for humans. */
export class ApiError extends Error {
  constructor(
    readonly status: 400 | 401 | 402 | 403 | 404 | 409 | 410 | 413 | 415 | 422 | 423 | 429 | 500 | 503,
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export const notFound = (what: string) => new ApiError(404, "NOT_FOUND", `${what} not found`);
export const forbidden = (message = "Not allowed") => new ApiError(403, "FORBIDDEN", message);

interface PgError {
  code?: string;
  constraint_name?: string;
}

/** Turns database constraint violations that guard business rules into API errors. */
export function fromPgError(err: unknown): ApiError | null {
  const e = err as PgError;
  if (!e || typeof e.code !== "string") return null;
  switch (e.constraint_name) {
    case "wallet_never_negative":
      return new ApiError(402, "INSUFFICIENT_BALANCE", "Wallet balance is too low. Top up to take this job.");
    case "deliveries_one_active_per_driver":
      return new ApiError(409, "DRIVER_BUSY", "Finish your current delivery first.");
    case "vehicles_plate_key":
      return new ApiError(409, "PLATE_TAKEN", "This plate is already registered.");
    case "drivers_nida_no_key":
      return new ApiError(409, "NIDA_TAKEN", "This NIDA number is already registered.");
    case "drivers_user_id_key":
      return new ApiError(409, "ALREADY_REGISTERED", "You are already registered as a driver.");
    case "shop_members_shop_id_phone_key":
      return new ApiError(409, "ALREADY_MEMBER", "This phone number is already on the shop.");
    case "ratings_delivery_id_from_role_key":
      return new ApiError(409, "ALREADY_RATED", "You have already rated this delivery.");
    case "pickup_locations_one_default":
      return new ApiError(409, "DEFAULT_EXISTS", "The shop already has a default pickup location.");
  }
  return null;
}

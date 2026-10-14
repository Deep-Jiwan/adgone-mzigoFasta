import postgres from "postgres";

export type Db = postgres.Sql;
export type Tx = postgres.TransactionSql;
/** Either a pooled connection or a transaction; most queries work with both. */
export type Q = Db | Tx;

export function createDb(url: string, options: postgres.Options<Record<string, postgres.PostgresType>> = {}): Db {
  return postgres(url, {
    max: 5,
    // Hyperdrive and Workers: skip the type-discovery round trip on every connection.
    fetch_types: false,
    onnotice: () => {},
    // int8 / numeric come back as strings by default; all our values fit safely in a JS number.
    types: {
      int8: { to: 20, from: [20], serialize: (x: number) => String(x), parse: (x: string) => Number(x) },
      numeric: { to: 1700, from: [1700], serialize: (x: number) => String(x), parse: (x: string) => Number(x) },
    },
    ...options,
  }) as unknown as Db;
}

/** SQL fragment for a PostGIS geography point. */
export function point(sql: Q, p: { lat: number; lng: number }) {
  return sql`ST_SetSRID(ST_MakePoint(${p.lng}, ${p.lat}), 4326)::geography`;
}

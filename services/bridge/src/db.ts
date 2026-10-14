import postgres from "postgres";

export type Db = postgres.Sql;

export function createDb(url: string, max = 5): Db {
  return postgres(url, {
    max,
    onnotice: () => {},
    types: {
      int8: { to: 20, from: [20], serialize: (x: number) => String(x), parse: (x: string) => Number(x) },
      numeric: { to: 1700, from: [1700], serialize: (x: number) => String(x), parse: (x: string) => Number(x) },
    },
  }) as unknown as Db;
}

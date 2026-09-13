import { Pool, type QueryResult, type QueryResultRow } from "pg";
import "dotenv/config";

export const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ??
    "postgres://nas:nas@localhost:5432/nas",
});

export async function query<T extends QueryResultRow = any>(
  text: string,
  params: readonly any[] = []
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params as any[]);
}

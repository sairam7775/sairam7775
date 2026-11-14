/** Rows asked for per request. Supabase's API answers at most 1,000 rows
 *  per request by default (the project's "Max rows" setting) and drops
 *  the rest without an error, so a whole-table read must page. */
export const PAGE_ROWS = 1000;

type PageResult<T> = { data: T[] | null; error: unknown; count?: number | null };

/** Every row of a query, read a page at a time. `page(from, to)` must
 *  apply a stable, unique order and `.range(from, to)`, and should ask
 *  for `{ count: "exact" }`: with the count, reading stops when every row
 *  has arrived, however few rows the server sends per page; without it, a
 *  short page ends the read. Any failed page throws, so a caller never
 *  gets part of a table. */
export async function selectAll<T>(page: (from: number, to: number) => PromiseLike<PageResult<T>>, pageRows = PAGE_ROWS): Promise<T[]> {
  const rows: T[] = [];
  for (;;) {
    const { data, error, count } = await page(rows.length, rows.length + pageRows - 1);
    if (error) throw error;
    const got = data ?? [];
    if (got.length > pageRows) throw new Error(`a page returned ${got.length} rows, more than the ${pageRows} asked for`);
    rows.push(...got);
    if (count != null) {
      if (rows.length >= count) return rows;
      // Rows went missing between pages: refuse rather than return part.
      if (!got.length) throw new Error(`read ${rows.length} of ${count} rows before the pages ran out`);
    } else if (got.length < pageRows) {
      return rows;
    }
  }
}

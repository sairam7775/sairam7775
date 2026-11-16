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
 *  gets part of a table.
 *
 *  If the count changes between pages, a row was added or removed while
 *  reading, and the offsets after it have shifted: a row can be skipped or
 *  read twice. The read then starts again from the first page, up to
 *  `READ_ATTEMPTS` times, and throws if the table never holds still. */
export const READ_ATTEMPTS = 3;

export async function selectAll<T>(page: (from: number, to: number) => PromiseLike<PageResult<T>>, pageRows = PAGE_ROWS): Promise<T[]> {
  for (let attempt = 0; attempt < READ_ATTEMPTS; attempt++) {
    const read = await readOnce(page, pageRows);
    if (read) return read.rows;
  }
  throw new Error(`the row count changed while reading, ${READ_ATTEMPTS} times in a row`);
}

/** One pass from the first page; `null` when the count changed mid-read. */
async function readOnce<T>(page: (from: number, to: number) => PromiseLike<PageResult<T>>, pageRows: number): Promise<{ rows: T[] } | null> {
  const rows: T[] = [];
  let firstCount: number | null | undefined;
  for (;;) {
    const { data, error, count } = await page(rows.length, rows.length + pageRows - 1);
    if (error) throw error;
    const got = data ?? [];
    if (got.length > pageRows) throw new Error(`a page returned ${got.length} rows, more than the ${pageRows} asked for`);
    if (firstCount === undefined) firstCount = count ?? null;
    else if ((count ?? null) !== firstCount) return null;
    rows.push(...got);
    if (count != null) {
      if (rows.length >= count) return { rows };
      // Rows went missing between pages: refuse rather than return part.
      if (!got.length) throw new Error(`read ${rows.length} of ${count} rows before the pages ran out`);
    } else if (got.length < pageRows) {
      return { rows };
    }
  }
}

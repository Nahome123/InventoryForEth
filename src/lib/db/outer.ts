import { sql } from "drizzle-orm";

/**
 * Fully qualified references to an outer query's id, for correlated sub-queries.
 * Drizzle leaves column names unqualified ("id") when a query selects from a single table,
 * and inside a sub-query on another table that "id" silently means the sub-query table's own id.
 */
export const SALES_ID = sql.raw(`"sales"."id"`);
export const ORDERS_ID = sql.raw(`"customer_orders"."id"`);

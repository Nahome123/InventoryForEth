import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getSettings } from "@/lib/analytics";
import { listSales } from "@/lib/sales-query";
import { formatMoney } from "@/lib/money";
import { PageHeader, Pagination } from "@/components/ui";
import { SalesList } from "../sales-list";

export const metadata = { title: "Voided sales" };
const PAGE = 50;

export default async function VoidedSalesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requireUser("recordSales");
  const db = await getDb();
  const s = await getSettings(db);
  const page = Math.min(10_000, Math.max(1, Number((await searchParams).page) || 1));
  const { rows, count, revenue } = await listSales(db, { status: "voided" }, s.timezone, PAGE, (page - 1) * PAGE);
  const money = (c: number) => formatMoney(c, s.currency);
  // listSales counts revenue from completed sales only, so add up the voided totals here.
  const voidedTotal = revenue + rows.reduce((a, r) => a + r.sale.totalCents, 0);

  return (
    <>
      <PageHeader
        title="Voided sales"
        subtitle={count ? `${count} voided sale${count === 1 ? "" : "s"} · ${money(voidedTotal)} cancelled${count > PAGE ? " on this page" : ""}. These don't count in sales history or profit.` : undefined}
        actions={
          <Link className="btn-secondary" href="/sales">
            ← Sales history
          </Link>
        }
      />
      <SalesList rows={rows} money={money} timezone={s.timezone} empty="No voided sales." voided />
      <Pagination page={page} hasMore={page * PAGE < count} makeHref={(p) => `?page=${p}`} />
    </>
  );
}

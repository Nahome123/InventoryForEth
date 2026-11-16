import { redirect } from "next/navigation";
import { getCurrentUser, hasAnyUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getSettings } from "@/lib/analytics";
import { can, ROLE_LABELS, type Permission } from "@/lib/permissions";
import { MobileNav, Sidebar, type NavItem } from "@/components/nav";
import { logoutAction } from "../auth-actions";

const NAV: (NavItem & { perm?: Permission })[] = [
  { href: "/", label: "Home", icon: "LayoutDashboard", mobile: true },
  { href: "/sales/new", label: "New sale", icon: "ShoppingCart", mobile: true, perm: "recordSales" },
  { href: "/sales", label: "Sales history", icon: "Receipt", perm: "recordSales" },
  { href: "/orders", label: "Customer orders", icon: "ClipboardList", mobile: true, perm: "manageOrders" },
  { href: "/products", label: "Products", icon: "Package", mobile: true, perm: "viewInventory" },
  { href: "/inventory", label: "Inventory", icon: "Boxes", perm: "viewInventory" },
  { href: "/analytics", label: "Demand & restock", icon: "BarChart3", perm: "viewAnalytics" },
  { href: "/import", label: "Import / export", icon: "Upload", perm: "importExport" },
  { href: "/settings", label: "Settings", icon: "Settings", perm: "manageUsers" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect((await hasAnyUser()) ? "/login" : "/setup");
  const s = await getSettings(await getDb());
  const items = NAV.filter((n) => !n.perm || can(user.role, n.perm)).map(({ perm: _perm, ...n }) => n);

  return (
    <div className="flex min-h-dvh">
      <Sidebar items={items} storeName={s.storeName} userName={user.fullName} roleLabel={ROLE_LABELS[user.role]} logout={logoutAction} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileNav items={items} storeName={s.storeName} logout={logoutAction} />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-24 pt-5 sm:px-6 lg:pb-10 lg:pt-8">{children}</main>
      </div>
    </div>
  );
}

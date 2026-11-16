import { redirect } from "next/navigation";
import { getCurrentUser, hasAnyUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getSettings } from "@/lib/analytics";
import { can, ROLE_LABELS, type Permission } from "@/lib/permissions";
import { MobileNav, TopNav, type NavItem } from "@/components/nav";
import { logoutAction } from "../auth-actions";

const NAV: (NavItem & { perm?: Permission })[] = [
  { href: "/", label: "Home", icon: "LayoutDashboard", mobile: true },
  { href: "/sales/new", label: "New sale", icon: "ShoppingCart", mobile: true, perm: "recordSales" },
  { href: "/sales", label: "Sales history", short: "Sales", icon: "Receipt", perm: "recordSales" },
  { href: "/orders", label: "Customer orders", short: "Orders", icon: "ClipboardList", mobile: true, perm: "manageOrders" },
  { href: "/products", label: "Products", icon: "Package", mobile: true, perm: "viewInventory" },
  { href: "/inventory", label: "Inventory", icon: "Boxes", perm: "viewInventory" },
  { href: "/analytics", label: "Demand & restock", short: "Analytics", icon: "BarChart3", perm: "viewAnalytics" },
  { href: "/import", label: "Import / export", short: "Import", icon: "Upload", perm: "importExport" },
  { href: "/settings", label: "Settings", icon: "Settings", perm: "manageUsers" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect((await hasAnyUser()) ? "/login" : "/setup");
  const s = await getSettings(await getDb());
  const items = NAV.filter((n) => !n.perm || can(user.role, n.perm)).map(({ perm: _perm, ...n }) => n);
  const nav = { items, storeName: s.storeName, userName: user.fullName, roleLabel: ROLE_LABELS[user.role], logout: logoutAction };

  return (
    <div className="flex min-h-dvh flex-col">
      <TopNav {...nav} canSell={can(user.role, "recordSales")} />
      <MobileNav {...nav} />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-28 pt-6 sm:px-6 lg:pb-14 lg:pt-10">{children}</main>
    </div>
  );
}

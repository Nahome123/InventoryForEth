import type { Role } from "./db/schema";

const MATRIX = {
  recordSales: ["owner", "manager", "cashier"],
  manageOrders: ["owner", "manager", "cashier"],
  viewInventory: ["owner", "manager", "cashier"],
  viewCosts: ["owner", "manager"],
  manageProducts: ["owner", "manager"],
  adjustStock: ["owner", "manager"],
  voidSales: ["owner", "manager"],
  editSales: ["owner", "manager"],
  viewAnalytics: ["owner", "manager"],
  importExport: ["owner", "manager"],
  manageUsers: ["owner"],
  manageSettings: ["owner"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof MATRIX;

export function can(role: Role, p: Permission): boolean {
  return (MATRIX[p] as readonly Role[]).includes(role);
}

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  manager: "Manager",
  cashier: "Sales staff",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  owner: "Everything, including users and store settings.",
  manager: "Products, stock, sales, orders, analytics and imports.",
  cashier: "Record sales, manage customer orders and look up stock.",
};

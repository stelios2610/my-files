export const PERMISSIONS = [
  { id: "order", label: "Όροφος", detail: "Τραπέζια και παραγγελία" },
  { id: "pay", label: "Είσπραξη", detail: "Πληρωμή και κλείσιμο τραπεζιού" },
  { id: "shift", label: "Βάρδια", detail: "Άνοιγμα και κλείσιμο ταμείου" },
  { id: "menu", label: "Μενού", detail: "Τιμές και συνταγές" },
  { id: "stock", label: "Αποθήκη", detail: "Υπόλοιπα και διορθώσεις" },
  { id: "documents", label: "Παραστατικά", detail: "Κλειστά τραπέζια και σήμανση ταμειακής" },
] as const;

export type Permission = (typeof PERMISSIONS)[number]["id"];

export const NAV_LINKS: { href: string; label: string; permission: Permission }[] = [
  { href: "/", label: "Όροφος", permission: "order" },
  { href: "/menu", label: "Μενού", permission: "menu" },
  { href: "/stock", label: "Αποθήκη", permission: "stock" },
  { href: "/shift", label: "Βάρδια", permission: "shift" },
  { href: "/documents", label: "Παραστατικά", permission: "documents" },
];

export function isPermission(value: string): value is Permission {
  return PERMISSIONS.some((item) => item.id === value);
}

export function parsePermissions(value: string | null | undefined): Permission[] {
  if (!value) return [];
  return value.split(",").filter(isPermission);
}

export function allows(staff: { role: string; permissions: readonly string[] }, permission: Permission): boolean {
  if (staff.role === "admin") return true;
  return staff.permissions.includes(permission);
}

export function defaultPermissions(role: "waiter" | "cashier"): Permission[] {
  if (role === "cashier") return ["order", "pay", "shift", "documents"];
  return ["order"];
}

import { Home, Layers, CreditCard, type LucideIcon } from "lucide-react";

export interface NavItem {
  key: "home" | "content" | "payments";
  href: string;
  icon: LucideIcon;
}

export const navItems: NavItem[] = [
  { key: "home", href: "/", icon: Home },
  { key: "content", href: "/content", icon: Layers },
  { key: "payments", href: "/payments", icon: CreditCard },
];

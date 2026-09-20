import { Layers, type LucideIcon } from "lucide-react";

export interface NavItem {
  key: "content";
  href: string;
  icon: LucideIcon;
}

export const navItems: NavItem[] = [{ key: "content", href: "/content", icon: Layers }];

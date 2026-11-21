import { Home, Layers, CreditCard, Mic, type LucideIcon } from "lucide-react";

export interface NavItem {
  key: "home" | "content" | "payments" | "recordingPermissions";
  href: string;
  icon: LucideIcon;
}

export const navItems: NavItem[] = [
  { key: "home", href: "/", icon: Home },
  { key: "content", href: "/content", icon: Layers },
  { key: "payments", href: "/payments", icon: CreditCard },
  { key: "recordingPermissions", href: "/recording-permissions", icon: Mic },
];

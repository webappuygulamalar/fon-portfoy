import type { ReactNode } from "react";

interface BadgeProps {
  variant?: "default" | "mint" | "gold" | "danger" | "warning";
  children: ReactNode;
}

export function Badge({ variant = "default", children }: BadgeProps) {
  const cls = variant === "default" ? "badge" : `badge badge-${variant}`;
  return <span className={cls}>{children}</span>;
}

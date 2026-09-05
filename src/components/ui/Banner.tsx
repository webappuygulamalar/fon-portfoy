import type { ReactNode } from "react";

interface BannerProps {
  variant: "info" | "warning" | "danger";
  children: ReactNode;
}

export function Banner({ variant, children }: BannerProps) {
  return <div className={`banner banner-${variant}`}>{children}</div>;
}

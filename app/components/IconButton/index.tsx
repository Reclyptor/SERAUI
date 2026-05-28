"use client";

import { type ButtonHTMLAttributes, type ReactNode } from "react";
import clsx from "clsx";

type Variant = "default" | "ghost" | "danger" | "primary";
type Size = "sm" | "md";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
}

const variantStyles: Record<Variant, string> = {
  default:
    "border border-border bg-background-secondary hover:bg-background-tertiary text-foreground-muted hover:text-foreground",
  ghost:
    "text-foreground-muted hover:text-foreground hover:bg-background-tertiary",
  danger: "bg-[#e74c3c] hover:bg-[#c0392b] text-white",
  primary: "bg-accent hover:bg-accent-hover text-background",
};

const sizeStyles: Record<Size, string> = {
  sm: "w-8 h-8",
  md: "w-10 h-10",
};

export function IconButton({
  children,
  variant = "ghost",
  size = "md",
  className,
  type = "button",
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      className={clsx(
        "shrink-0 flex items-center justify-center rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
        sizeStyles[size],
        variantStyles[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

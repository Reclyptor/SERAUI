"use client";

import { ReactNode, ButtonHTMLAttributes } from "react";
import clsx from "clsx";

type Variant = "default" | "danger" | "primary";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: Variant;
}

const variantStyles: Record<Variant, string> = {
  default:
    "border border-border bg-background-secondary hover:bg-background-tertiary text-foreground-muted hover:text-foreground",
  danger:
    "bg-[#e74c3c] hover:bg-[#c0392b] text-white border-transparent",
  primary:
    "bg-accent hover:bg-accent-hover text-background border-transparent",
};

export function IconButton({
  children,
  variant = "default",
  className,
  disabled,
  ...props
}: IconButtonProps) {
  return (
    <button
      className={clsx(
        "shrink-0 w-10 h-10 flex items-center justify-center rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
        variantStyles[variant],
        className
      )}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}

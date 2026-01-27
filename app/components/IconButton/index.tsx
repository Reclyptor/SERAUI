"use client";

import { ReactNode, ButtonHTMLAttributes } from "react";

type Variant = "default" | "danger";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: Variant;
}

const variantStyles: Record<Variant, string> = {
  default:
    "border border-[#3c3c3c] bg-[#252526] hover:bg-[#2d2d2d] hover:border-[#525252] text-[#888888] hover:text-[#cccccc]",
  danger:
    "bg-[#e74c3c] hover:bg-[#c0392b] text-white border-transparent",
};

export function IconButton({
  children,
  variant = "default",
  className = "",
  disabled,
  ...props
}: IconButtonProps) {
  return (
    <button
      className={`shrink-0 w-10 h-10 flex items-center justify-center rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variantStyles[variant]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}

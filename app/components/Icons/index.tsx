"use client";

interface IconProps {
  className?: string;
}

export function ImageIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 5V19" />
      <path d="M5 12H19" />
    </svg>
  );
}

export function SendIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 19V5" />
      <path d="M5 12L12 5L19 12" />
    </svg>
  );
}

export function StopIcon({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="6" width="12" height="12" rx="1" />
    </svg>
  );
}

export function ChevronIcon({ className = "w-2.5 h-2.5", isOpen = false }: IconProps & { isOpen?: boolean }) {
  return (
    <span
      className={`inline-flex items-center justify-center text-[9px] leading-none transition-transform ${className}`}
      style={{ transform: isOpen ? 'rotate(90deg)' : 'none' }}
    >
      ▸
    </span>
  );
}

export function CloseIcon({ className = "w-3 h-3" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

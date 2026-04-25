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

export function DotIcon({ className = "w-2 h-2" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 8 8" fill="currentColor">
      <circle cx="4" cy="4" r="3" />
    </svg>
  );
}

export function AgentIcon({ className = "w-3 h-3" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="8" cy="5" r="3" />
      <path d="M3 14c0-2.8 2.2-5 5-5s5 2.2 5 5" />
      <circle cx="12.5" cy="3.5" r="2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function ChevronUpDownIcon({ className = "w-3 h-3" }: IconProps) {
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
      <path d="M7 15L12 20L17 15" />
      <path d="M7 9L12 4L17 9" />
    </svg>
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

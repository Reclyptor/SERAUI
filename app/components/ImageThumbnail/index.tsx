"use client";

interface ImageThumbnailProps {
  src: string;
  alt?: string;
  onRemove?: () => void;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
}

const sizeStyles = {
  sm: "h-16 w-16",
  md: "h-20 w-20",
  lg: "max-w-[200px] max-h-[200px]",
};

export function ImageThumbnail({
  src,
  alt = "Image",
  onRemove,
  disabled = false,
  size = "md",
}: ImageThumbnailProps) {
  return (
    <div className="relative group">
      <img
        src={src}
        alt={alt}
        className={`${sizeStyles[size]} object-cover rounded border border-[#3c3c3c]`}
      />
      {onRemove && (
        <button
          onClick={onRemove}
          disabled={disabled}
          className="absolute -top-2 -right-2 w-5 h-5 bg-[#e74c3c] text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
          type="button"
        >
          ×
        </button>
      )}
    </div>
  );
}

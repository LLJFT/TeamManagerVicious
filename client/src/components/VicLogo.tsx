interface VicLogoProps {
  className?: string;
  withWordmark?: boolean;
  size?: number;
}

export function VicLogo({ className, withWordmark = false, size = 24 }: VicLogoProps) {
  if (!withWordmark) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 64 64"
        width={size}
        height={size}
        className={className}
        aria-label="Vicious"
        data-testid="img-vicious-logo"
      >
        <path d="M6 8 L20 8 L32 42 L44 8 L58 8 L36 58 L28 58 Z" fill="currentColor" />
      </svg>
    );
  }
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`} data-testid="img-vicious-logo">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
        <path d="M6 8 L20 8 L32 42 L44 8 L58 8 L36 58 L28 58 Z" fill="hsl(var(--primary))" />
      </svg>
      <span
        className="font-extrabold tracking-[0.18em]"
        style={{ fontSize: size * 0.7, lineHeight: 1 }}
      >
        VICIOUS
      </span>
    </span>
  );
}

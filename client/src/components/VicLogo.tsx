import logoUrl from "@assets/4_1777809074757.png";

interface VicLogoProps {
  className?: string;
  withWordmark?: boolean;
  size?: number;
}

export function VicLogo({ className, withWordmark = false, size = 24 }: VicLogoProps) {
  if (!withWordmark) {
    return (
      <img
        src={logoUrl}
        width={size}
        height={size}
        className={`rounded object-contain ${className ?? ""}`}
        alt="the bootcamp"
        data-testid="img-bootcamp-logo"
      />
    );
  }
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`} data-testid="img-bootcamp-logo">
      <img
        src={logoUrl}
        width={size}
        height={size}
        className="rounded object-contain"
        alt=""
        aria-hidden="true"
      />
      <span
        className="font-extrabold tracking-[0.18em] lowercase"
        style={{ fontSize: size * 0.7, lineHeight: 1 }}
      >
        the bootcamp
      </span>
    </span>
  );
}

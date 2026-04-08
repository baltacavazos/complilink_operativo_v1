const FULL_LOGO_SRC = "https://d2xsxph8kpxj0f.cloudfront.net/310519663473809458/cGpJC3DAdnBiVVBEKZfqbd/auditapatron-logo-final_01c8b00a.png";
const WORDMARK_LOGO_SRC = "https://d2xsxph8kpxj0f.cloudfront.net/310519663473809458/cGpJC3DAdnBiVVBEKZfqbd/auditapatron-wordmark-final_059d1915.png";
const ICON_LOGO_SRC = "https://d2xsxph8kpxj0f.cloudfront.net/310519663473809458/cGpJC3DAdnBiVVBEKZfqbd/auditapatron-icon-base_034a1256.png";

type AuditaPatronLogoVariant = "full" | "icon" | "compact";

type AuditaPatronLogoProps = {
  variant?: AuditaPatronLogoVariant;
  className?: string;
  imageClassName?: string;
  subtitleClassName?: string;
  showTagline?: boolean;
  futureQrReady?: boolean;
};

function joinClasses(...values: Array<string | undefined | false>) {
  return values.filter(Boolean).join(" ");
}

export const AUDITAPATRON_LOGO_ASSETS = {
  full: FULL_LOGO_SRC,
  wordmark: WORDMARK_LOGO_SRC,
  icon: ICON_LOGO_SRC,
} as const;

export function AuditaPatronLogo({
  variant = "full",
  className,
  imageClassName,
  subtitleClassName,
  showTagline,
  futureQrReady = false,
}: AuditaPatronLogoProps) {
  const isIcon = variant === "icon";
  const isCompact = variant === "compact";
  const resolvedShowTagline = showTagline ?? variant === "full";
  const source = isIcon ? ICON_LOGO_SRC : resolvedShowTagline ? FULL_LOGO_SRC : WORDMARK_LOGO_SRC;

  if (isIcon) {
    return (
      <div
        className={joinClasses("inline-flex items-center justify-center", className)}
        data-brand="auditapatron"
        data-qr-ready={futureQrReady ? "true" : "false"}
      >
        <img
          src={source}
          alt="AuditaPatron"
          className={joinClasses("h-12 w-12 object-contain", imageClassName)}
          loading="eager"
          decoding="async"
        />
      </div>
    );
  }

  return (
    <div
      className={joinClasses("min-w-0", isCompact ? "inline-flex items-center" : "inline-flex flex-col justify-center", className)}
      data-brand="auditapatron"
      data-qr-ready={futureQrReady ? "true" : "false"}
    >
      <img
        src={source}
        alt={resolvedShowTagline ? "AuditaPatron - Conoce tus derechos" : "AuditaPatron"}
        className={joinClasses(
          isCompact ? "h-8 w-auto max-w-[220px] object-contain" : "h-auto w-full max-w-[420px] object-contain",
          imageClassName,
          subtitleClassName,
        )}
        loading="eager"
        decoding="async"
      />
    </div>
  );
}

export function AuditaPatronLogoWordmark(props: Omit<AuditaPatronLogoProps, "variant">) {
  return <AuditaPatronLogo variant="compact" showTagline={false} {...props} />;
}

export function AuditaPatronLogoIcon(props: Omit<AuditaPatronLogoProps, "variant" | "showTagline">) {
  return <AuditaPatronLogo variant="icon" showTagline={false} {...props} />;
}

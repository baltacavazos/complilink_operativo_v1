const FULL_LOGO_SRC = "https://d2xsxph8kpxj0f.cloudfront.net/310519663473809458/cGpJC3DAdnBiVVBEKZfqbd/auditapatron-logo-final_01c8b00a.png";
const WORDMARK_LOGO_SRC = "https://d2xsxph8kpxj0f.cloudfront.net/310519663473809458/cGpJC3DAdnBiVVBEKZfqbd/auditapatron-wordmark-final_059d1915.png";
const ICON_LOGO_SRC = "https://d2xsxph8kpxj0f.cloudfront.net/310519663473809458/cGpJC3DAdnBiVVBEKZfqbd/auditapatron-icon-base_034a1256.png";

const APPBAR_LABEL = "AUDITAPATRON";

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
        data-brand-variant="icon"
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

  if (isCompact) {
    return (
      <div
        className={joinClasses("inline-flex min-w-0 items-center gap-2.5", className)}
        data-brand="auditapatron"
        data-brand-variant="appbar"
        data-qr-ready={futureQrReady ? "true" : "false"}
      >
        <div
          className={joinClasses(
            "inline-flex min-w-0 items-center gap-2.5 rounded-full px-0.5 py-0.5",
            imageClassName,
          )}
        >
          <img
            src={ICON_LOGO_SRC}
            alt="AuditaPatron"
            className="h-7 w-7 shrink-0 object-contain sm:h-8 sm:w-8 lg:h-9 lg:w-9"
            loading="eager"
            decoding="async"
          />
          <span
            className={joinClasses(
              "truncate text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-[#143c86] leading-none dark:text-slate-50 sm:text-[0.8rem] lg:text-[0.92rem]",
              subtitleClassName,
            )}
          >
            {APPBAR_LABEL}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={joinClasses("min-w-0 inline-flex flex-col justify-center", className)}
      data-brand="auditapatron"
      data-brand-variant="full"
      data-qr-ready={futureQrReady ? "true" : "false"}
    >
      <img
        src={source}
        alt={resolvedShowTagline ? "AuditaPatron - Conoce tus derechos" : "AuditaPatron"}
        className={joinClasses("h-auto w-full max-w-[420px] object-contain", imageClassName, subtitleClassName)}
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

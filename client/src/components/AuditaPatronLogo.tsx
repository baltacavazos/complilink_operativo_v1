import * as React from "react";

const FULL_LOGO_SRC = "https://d2xsxph8kpxj0f.cloudfront.net/310519663473809458/cGpJC3DAdnBiVVBEKZfqbd/auditapatron-logo-final_01c8b00a.png";
const WORDMARK_LOGO_SRC = "https://d2xsxph8kpxj0f.cloudfront.net/310519663473809458/cGpJC3DAdnBiVVBEKZfqbd/auditapatron-wordmark-final_059d1915.png";
const ICON_LOGO_SRC = "https://d2xsxph8kpxj0f.cloudfront.net/310519663473809458/cGpJC3DAdnBiVVBEKZfqbd/auditapatron-icon-base_034a1256.png";
const HEADER_LOCKUP_LIGHT_SRC = "https://d2xsxph8kpxj0f.cloudfront.net/310519663473809458/cGpJC3DAdnBiVVBEKZfqbd/header-lockup-light_3758f303.png";
const HEADER_LOCKUP_DARK_SRC = "https://d2xsxph8kpxj0f.cloudfront.net/310519663473809458/cGpJC3DAdnBiVVBEKZfqbd/header-lockup-dark_6fe9c4c8.png";

type AuditaPatronLogoVariant = "full" | "icon" | "compact";
type AuditaPatronLogoSurface = "light" | "dark" | "adaptive";

type AuditaPatronLogoProps = {
  variant?: AuditaPatronLogoVariant;
  surface?: AuditaPatronLogoSurface;
  className?: string;
  imageClassName?: string;
  subtitleClassName?: string;
  showTagline?: boolean;
  futureQrReady?: boolean;
};

function joinClasses(...values: Array<string | undefined | false>) {
  return values.filter(Boolean).join(" ");
}

const darkSurfaceImageTreatment = "brightness-0 invert saturate-0 contrast-[1.08] drop-shadow-[0_8px_18px_rgba(255,255,255,0.12)]";
const adaptiveSurfaceImageTreatment = "dark:brightness-0 dark:invert dark:saturate-0 dark:contrast-[1.08] dark:drop-shadow-[0_8px_18px_rgba(255,255,255,0.12)]";
const compactLightImageClassName = "block h-5 w-auto shrink-0 object-contain sm:h-6 lg:h-7";
const compactDarkImageClassName = "block h-6 w-auto shrink-0 object-contain drop-shadow-[0_8px_18px_rgba(255,255,255,0.08)] sm:h-7 lg:h-8";

export const AUDITAPATRON_LOGO_ASSETS = {
  full: FULL_LOGO_SRC,
  wordmark: WORDMARK_LOGO_SRC,
  icon: ICON_LOGO_SRC,
  headerLight: HEADER_LOCKUP_LIGHT_SRC,
  headerDark: HEADER_LOCKUP_DARK_SRC,
} as const;

export function AuditaPatronLogo({
  variant = "full",
  surface = "light",
  className,
  imageClassName,
  subtitleClassName,
  showTagline,
  futureQrReady = false,
}: AuditaPatronLogoProps) {
  const isIcon = variant === "icon";
  const isCompact = variant === "compact";
  const isDarkSurface = surface === "dark";
  const isAdaptiveSurface = surface === "adaptive";
  const resolvedShowTagline = showTagline ?? variant === "full";
  const source = isIcon ? ICON_LOGO_SRC : resolvedShowTagline ? FULL_LOGO_SRC : WORDMARK_LOGO_SRC;

  if (isIcon) {
    return (
      <div
        className={joinClasses("inline-flex items-center justify-center", className)}
        data-brand="auditapatron"
        data-brand-variant="icon"
        data-brand-surface={surface}
        data-qr-ready={futureQrReady ? "true" : "false"}
      >
        <img
          src={source}
          alt="AuditaPatron"
          className={joinClasses(
            "h-12 w-12 object-contain",
            isDarkSurface && darkSurfaceImageTreatment,
            isAdaptiveSurface && adaptiveSurfaceImageTreatment,
            imageClassName,
          )}
          loading="eager"
          decoding="async"
        />
      </div>
    );
  }

  if (isCompact) {
    if (isAdaptiveSurface) {
      return (
        <div
          className={joinClasses("inline-flex min-w-0 items-center", className)}
          data-brand="auditapatron"
          data-brand-variant="appbar"
          data-brand-surface={surface}
          data-qr-ready={futureQrReady ? "true" : "false"}
        >
          <img
            src={HEADER_LOCKUP_LIGHT_SRC}
            alt="AuditaPatron"
            className={joinClasses(compactLightImageClassName, "dark:hidden", imageClassName, subtitleClassName)}
            loading="eager"
            decoding="async"
          />
          <img
            src={HEADER_LOCKUP_DARK_SRC}
            alt="AuditaPatron"
            className={joinClasses(compactDarkImageClassName, "hidden dark:block", imageClassName, subtitleClassName)}
            loading="eager"
            decoding="async"
          />
        </div>
      );
    }

    return (
      <div
        className={joinClasses("inline-flex min-w-0 items-center", className)}
        data-brand="auditapatron"
        data-brand-variant="appbar"
        data-brand-surface={surface}
        data-qr-ready={futureQrReady ? "true" : "false"}
      >
        <img
          src={isDarkSurface ? HEADER_LOCKUP_DARK_SRC : HEADER_LOCKUP_LIGHT_SRC}
          alt="AuditaPatron"
          className={joinClasses(
            isDarkSurface ? compactDarkImageClassName : compactLightImageClassName,
            imageClassName,
            subtitleClassName,
          )}
          loading="eager"
          decoding="async"
        />
      </div>
    );
  }

  return (
    <div
      className={joinClasses("min-w-0 inline-flex flex-col justify-center", className)}
      data-brand="auditapatron"
      data-brand-variant="full"
      data-brand-surface={surface}
      data-qr-ready={futureQrReady ? "true" : "false"}
    >
      <img
        src={source}
        alt={resolvedShowTagline ? "AuditaPatron - Conoce tus derechos" : "AuditaPatron"}
        className={joinClasses(
          "h-auto w-full max-w-[420px] object-contain",
          isDarkSurface && darkSurfaceImageTreatment,
          isAdaptiveSurface && adaptiveSurfaceImageTreatment,
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

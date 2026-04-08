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

function LogoMagnifier({ className }: { className?: string }) {
  return (
    <span className={joinClasses("relative inline-flex h-5 w-5 shrink-0", className)} aria-hidden="true">
      <span className="absolute inset-[10%] rounded-full border-[0.16em] border-[#143c86] bg-white/95 dark:border-teal-300 dark:bg-slate-950/90" />
      <span className="absolute right-[2%] top-[56%] h-[34%] w-[16%] rotate-[-42deg] rounded-full bg-[#63d4d3] shadow-[0_6px_14px_-10px_rgba(45,212,191,0.95)] dark:bg-teal-300" />
      <span className="absolute left-[31%] top-[31%] h-[10%] w-[10%] rounded-full bg-[#143c86]/18 dark:bg-teal-200/20" />
      <span className="absolute right-[27%] top-[28%] h-[9%] w-[9%] rounded-full bg-[#143c86]/18 dark:bg-teal-200/18" />
      <span className="absolute left-[34%] bottom-[29%] h-[9%] w-[9%] rounded-full bg-[#143c86]/14 dark:bg-teal-200/16" />
    </span>
  );
}

function AuditaPatronWordmark({ className }: { className?: string }) {
  return (
    <span
      className={joinClasses(
        "inline-flex items-end gap-[0.14em] font-black uppercase leading-none text-[#143c86] dark:text-slate-50",
        className,
      )}
      aria-label="AuditaPatron"
    >
      <span className="tracking-[-0.085em]">AUDITAPATRON</span>
      <LogoMagnifier className="mb-[0.08em] h-[0.76em] w-[0.76em]" />
    </span>
  );
}

export function AuditaPatronLogo({
  variant = "full",
  className,
  imageClassName,
  subtitleClassName,
  showTagline,
  futureQrReady = false,
}: AuditaPatronLogoProps) {
  const resolvedShowTagline = showTagline ?? variant === "full";
  const isIcon = variant === "icon";
  const isCompact = variant === "compact";

  if (isIcon) {
    return (
      <div
        className={joinClasses("inline-flex items-center justify-center", className)}
        data-brand="auditapatron"
        data-qr-ready={futureQrReady ? "true" : "false"}
      >
        <span
          className={joinClasses(
            "inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200/80 bg-white/95 shadow-[0_12px_32px_-22px_rgba(15,23,42,0.5)] dark:border-white/10 dark:bg-slate-950/85",
            imageClassName,
          )}
        >
          <LogoMagnifier className="h-7 w-7" />
        </span>
      </div>
    );
  }

  return (
    <div
      className={joinClasses("min-w-0", isCompact ? "inline-flex items-center" : "inline-flex flex-col justify-center", className)}
      data-brand="auditapatron"
      data-qr-ready={futureQrReady ? "true" : "false"}
    >
      <AuditaPatronWordmark
        className={joinClasses(
          isCompact
            ? "text-[1.9rem] sm:text-[2.15rem]"
            : "text-[2.28rem] sm:text-[3rem] lg:text-[3.45rem]",
          imageClassName,
        )}
      />
      {resolvedShowTagline ? (
        <p
          className={joinClasses(
            "mt-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-[#143c86]/78 dark:text-slate-300 sm:text-[0.82rem]",
            subtitleClassName,
          )}
        >
          CONOCE TUS DERECHOS
        </p>
      ) : null}
    </div>
  );
}

export function AuditaPatronLogoWordmark(props: Omit<AuditaPatronLogoProps, "variant">) {
  return <AuditaPatronLogo variant="compact" {...props} />;
}

export function AuditaPatronLogoIcon(props: Omit<AuditaPatronLogoProps, "variant" | "showTagline">) {
  return <AuditaPatronLogo variant="icon" showTagline={false} {...props} />;
}

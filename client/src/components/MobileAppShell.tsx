import { AuditaPatronLogoIcon } from "@/components/AuditaPatronLogo";
import { Home, LogIn, SearchCheck } from "lucide-react";

type MobileAppShellSection = "home" | "auditar" | "acceso";

type MobileAppShellProps = {
  current: MobileAppShellSection;
  title: string;
  subtitle: string;
};

const items: Array<{
  key: MobileAppShellSection;
  label: string;
  href: string;
  icon: typeof Home;
}> = [
  {
    key: "home",
    label: "Inicio",
    href: "/",
    icon: Home,
  },
  {
    key: "auditar",
    label: "Auditar",
    href: "/auditar",
    icon: SearchCheck,
  },
  {
    key: "acceso",
    label: "Entrar",
    href: "/acceso",
    icon: LogIn,
  },
];

export default function MobileAppShell({ current, title, subtitle }: MobileAppShellProps) {
  return (
    <div className="sticky top-3 z-40 mb-4 sm:hidden">
      <div className="overflow-hidden rounded-[1.6rem] border border-slate-200/90 bg-white/96 p-3 shadow-[0_22px_45px_-30px_rgba(15,23,42,0.32)] backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-[1rem] border border-slate-200 bg-slate-50 shadow-sm">
            <AuditaPatronLogoIcon imageClassName="h-7 w-7 object-contain" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-950">{title}</p>
            <p className="mt-0.5 truncate text-xs text-slate-500">{subtitle}</p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {items.map(item => {
            const Icon = item.icon;
            const active = item.key === current;

            return (
              <a
                key={item.key}
                href={item.href}
                className={`rounded-[1rem] border px-3 py-2 text-center transition ${
                  active
                    ? "border-slate-950 bg-slate-950 text-white shadow-sm"
                    : "border-slate-200 bg-slate-50 text-slate-700"
                }`}
              >
                <Icon className="mx-auto h-4 w-4" strokeWidth={1.9} />
                <p className={`mt-1 text-[11px] font-semibold ${active ? "text-white" : "text-slate-700"}`}>
                  {item.label}
                </p>
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}

import { useAuth } from "@/_core/hooks/useAuth";
import { AuditaPatronLogoIcon, AuditaPatronLogoWordmark } from "@/components/AuditaPatronLogo";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { LogOut, PanelLeft, ShieldCheck, UserRound, type LucideIcon } from "lucide-react";
import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";

export type DashboardNavigationItem = {
  icon: LucideIcon;
  label: string;
  path: string;
  badge?: string;
};

type DashboardLayoutProps = {
  children: React.ReactNode;
  title: string;
  subtitle: string;
  navigation: DashboardNavigationItem[];
  headerActions?: React.ReactNode;
};

const SIDEBAR_WIDTH_KEY = "complilink-sidebar-width";
const DEFAULT_WIDTH = 296;
const MIN_WIDTH = 220;
const MAX_WIDTH = 440;

export default function DashboardLayout({
  children,
  title,
  subtitle,
  navigation,
  headerActions,
}: DashboardLayoutProps) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_WIDTH;
    const saved = window.localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? Number.parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarWidth));
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="container flex min-h-screen items-center justify-center py-10">
          <div className="w-full max-w-xl rounded-3xl border border-border/60 bg-card/95 p-8 shadow-[0_24px_80px_-30px_rgba(10,22,40,0.35)] backdrop-blur">
            <div className="mb-8 flex items-center gap-4">
              <AuditaPatronLogoIcon imageClassName="h-14 w-14 rounded-2xl border border-border/70 object-contain p-1 shadow-[0_18px_40px_-24px_rgba(15,23,42,0.42)]" />
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  AuditaPatron · Consola operativa
                </p>
                <h1 className="text-2xl font-semibold tracking-tight">Acceso seguro y unificado</h1>
              </div>
            </div>
            <p className="text-base leading-7 text-muted-foreground">
              Esta plataforma protege expedientes laborales multi-tenant con trazabilidad integral por
              <strong className="text-foreground"> tenant_id</strong>, <strong className="text-foreground">case_id</strong> y <strong className="text-foreground">trace_id</strong>.
              Inicia sesión con Manus, Google o un código enviado por correo para abrir el tablero ejecutivo, gestionar casos y operar el intake documental seguro.
            </p>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="rounded-2xl bg-muted/60 px-4 py-3 text-sm text-muted-foreground">
                Entorno diseñado para contexto corporativo mexicano, cumplimiento, auditoría defensible y acceso federado.
              </div>
              <Button
                size="lg"
                className="shadow-lg shadow-primary/15"
                onClick={() => {
                  window.location.href = getLoginUrl();
                }}
              >
                Iniciar sesión
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent
        navigation={navigation}
        title={title}
        subtitle={subtitle}
        headerActions={headerActions}
        setSidebarWidth={setSidebarWidth}
      >
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  title: string;
  subtitle: string;
  navigation: DashboardNavigationItem[];
  headerActions?: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  title,
  subtitle,
  navigation,
  headerActions,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const {
    user,
    realUser,
    logout,
    canToggleUserView,
    isViewingAsUser,
    enterUserView,
    exitUserView,
  } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const activeNavigationItem = useMemo(() => {
    return navigation.find((item) => item.path === location) ?? navigation[0];
  }, [location, navigation]);

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!isResizing) return;
      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const nextWidth = event.clientX - sidebarLeft;
      if (nextWidth >= MIN_WIDTH && nextWidth <= MAX_WIDTH) {
        setSidebarWidth(nextWidth);
      }
    };

    const handleMouseUp = () => setIsResizing(false);

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  const userInitials = useMemo(() => {
    const source = user?.name || user?.email || "CL";
    return source
      .split(" ")
      .slice(0, 2)
      .map((chunk) => chunk.charAt(0).toUpperCase())
      .join("");
  }, [user?.email, user?.name]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar collapsible="icon" className="border-r border-sidebar-border/80 bg-sidebar/95" disableTransition={isResizing}>
          <SidebarHeader className="border-b border-sidebar-border/70 px-3 py-4">
            <div className="flex items-start gap-3 px-2">
              <button
                onClick={toggleSidebar}
                className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-sidebar-border/70 bg-sidebar text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                aria-label="Alternar navegación"
              >
                <PanelLeft className="h-4 w-4" />
              </button>
              {!isCollapsed ? (
                <div className="min-w-0 space-y-2">
                  <div className="min-w-0 space-y-2">
                    <AuditaPatronLogoWordmark
                      className="inline-flex max-w-full"
                      imageClassName="max-w-[210px]"
                      subtitleClassName="text-[0.78rem] tracking-[0.14em]"
                    />
                    <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
                  </div>
                  <div className="rounded-2xl border border-sidebar-border/70 bg-background/70 px-3 py-3 text-xs leading-5 text-muted-foreground">
                    Estación de mando para expedientes laborales, visibilidad documental y auditoría integral.
                  </div>
                </div>
              ) : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0 px-2 py-3">
            <SidebarMenu className="gap-1">
              {navigation.map((item) => {
                const isActive = item.path === location;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      tooltip={item.label}
                      onClick={() => setLocation(item.path)}
                      className={cn(
                        "h-11 rounded-2xl px-3 font-medium transition-all",
                        isActive
                          ? "bg-sidebar-primary/12 text-sidebar-primary shadow-sm"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                      {!isCollapsed && item.badge ? (
                        <Badge variant="secondary" className="ml-auto rounded-full bg-background text-[11px] text-foreground">
                          {item.badge}
                        </Badge>
                      ) : null}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="border-t border-sidebar-border/70 p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex w-full items-center gap-3 rounded-2xl border border-sidebar-border/70 bg-background/60 px-2 py-2 text-left transition-colors hover:bg-sidebar-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring group-data-[collapsible=icon]:justify-center">
                  <Avatar className="h-10 w-10 border border-sidebar-border/60">
                    <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                    <p className="truncate text-sm font-medium text-sidebar-foreground">{realUser?.name || user?.name || "Usuario"}</p>
                    <p className="truncate text-xs text-muted-foreground">{realUser?.email || user?.email || "Sesión protegida"}</p>
                    {canToggleUserView ? (
                      <p className="truncate text-[11px] font-medium text-sidebar-foreground/70">
                        {isViewingAsUser ? "Vista activa: usuario normal" : "Vista activa: CEO maestro"}
                      </p>
                    ) : null}
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Cerrar sesión</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={cn(
            "absolute right-0 top-0 z-50 h-full w-1 cursor-col-resize transition-colors hover:bg-primary/20",
            isCollapsed && "hidden",
          )}
          onMouseDown={() => {
            if (!isCollapsed) setIsResizing(true);
          }}
        />
      </div>

      <SidebarInset className="bg-[radial-gradient(circle_at_top,_rgba(15,103,177,0.10),_transparent_38%),linear-gradient(180deg,rgba(248,250,252,0.96),rgba(241,245,249,0.92))]">
        <div className="sticky top-0 z-30 border-b border-border/70 bg-background/88 backdrop-blur-xl">
          <div className="container flex min-h-16 items-center justify-between gap-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              {isMobile ? <SidebarTrigger className="h-9 w-9 rounded-xl border border-border bg-background" /> : null}
              <div className="min-w-0">
                <p className="truncate text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  {activeNavigationItem?.label ?? title}
                </p>
                <h1 className="truncate text-lg font-semibold tracking-tight text-foreground">
                  {title}
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {canToggleUserView ? (
                <>
                  <Badge
                    variant="secondary"
                    className={cn(
                      "hidden rounded-full px-3 py-1 text-[11px] font-semibold md:inline-flex",
                      isViewingAsUser
                        ? "bg-amber-100 text-amber-800"
                        : "bg-emerald-100 text-emerald-800",
                    )}
                  >
                    {isViewingAsUser ? "Vista usuario demo" : "Modo CEO maestro"}
                  </Badge>
                  <Button
                    variant="outline"
                    className="rounded-full bg-white"
                    onClick={() => {
                      if (isViewingAsUser) {
                        exitUserView();
                        setLocation("/ceo");
                        return;
                      }

                      enterUserView();
                      setLocation("/auditar");
                    }}
                  >
                    {isViewingAsUser ? (
                      <ShieldCheck className="mr-2 h-4 w-4" />
                    ) : (
                      <UserRound className="mr-2 h-4 w-4" />
                    )}
                    {isViewingAsUser ? "Volver a CEO" : "Ver como usuario"}
                  </Button>
                </>
              ) : null}
              {headerActions}
            </div>
          </div>
        </div>
        <main className="container flex-1 py-6">{children}</main>
      </SidebarInset>
    </>
  );
}

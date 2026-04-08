import { useEffect, useState } from "react";

import { AuditaPatronLogoIcon } from "@/components/AuditaPatronLogo";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";

interface ManusDialogProps {
  title?: string;
  logo?: string;
  open?: boolean;
  onLogin: () => void;
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void;
}

export function ManusDialog({
  title,
  logo,
  open = false,
  onLogin,
  onOpenChange,
  onClose,
}: ManusDialogProps) {
  const [internalOpen, setInternalOpen] = useState(open);

  useEffect(() => {
    if (!onOpenChange) {
      setInternalOpen(open);
    }
  }, [open, onOpenChange]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (onOpenChange) {
      onOpenChange(nextOpen);
    } else {
      setInternalOpen(nextOpen);
    }

    if (!nextOpen) {
      onClose?.();
    }
  };

  return (
    <Dialog
      open={onOpenChange ? open : internalOpen}
      onOpenChange={handleOpenChange}
    >
      <DialogContent className="w-[400px] gap-0 rounded-[20px] border border-[rgba(0,0,0,0.08)] bg-[#f8f8f7] p-0 py-5 text-center shadow-[0px_4px_11px_0px_rgba(0,0,0,0.08)] backdrop-blur-2xl transition-colors duration-300 dark:border-white/10 dark:bg-slate-950 dark:shadow-[0_24px_70px_-38px_rgba(2,6,23,0.95)]">
        <div className="flex flex-col items-center gap-2 p-5 pt-12">
          <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-[rgba(0,0,0,0.08)] bg-white transition-colors duration-300 dark:border-white/10 dark:bg-slate-900">
            {logo ? (
              <img
                src={logo}
                alt="AuditaPatron"
                className="h-10 w-10 rounded-md object-cover"
              />
            ) : (
              <AuditaPatronLogoIcon imageClassName="h-10 w-10 rounded-md object-cover" />
            )}
          </div>

          {/* Title and subtitle */}
          {title ? (
            <DialogTitle className="text-xl font-semibold leading-[26px] tracking-[-0.44px] text-[#34322d] dark:text-slate-50">
              {title}
            </DialogTitle>
          ) : null}
          <DialogDescription className="text-sm leading-5 tracking-[-0.154px] text-[#858481] dark:text-slate-400">
            Inicia sesión con Manus para continuar dentro de AuditaPatron.
          </DialogDescription>
        </div>

        <DialogFooter className="px-5 py-5">
          {/* Login button */}
          <Button
            onClick={onLogin}
            className="h-10 w-full rounded-[10px] bg-[#1a1a19] text-sm font-medium leading-5 tracking-[-0.154px] text-white transition-colors duration-300 hover:bg-[#1a1a19]/90 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400"
          >
            Continuar con Manus
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

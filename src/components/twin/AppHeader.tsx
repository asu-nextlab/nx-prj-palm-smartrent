import { Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export function AppHeader({ title, subtitle }: { title?: string | undefined; subtitle?: string | undefined }) {
  const navigate = useNavigate();
  return (
    <header className="flex h-14 items-center gap-4 bg-ink px-5 text-ink-foreground">
      <Link to="/" className="flex items-center gap-3">
        <img src="/smartrent-logo.svg" alt="SmartRent" width={132} height={18} className="invert" />
        <span className="hidden border-l border-ink-foreground/20 pl-3 font-display text-[0.65rem] font-semibold tracking-[0.18em] text-brand sm:inline">DIGITAL TWIN</span>
      </Link>
      {title && (
        <div className="ml-4 hidden min-w-0 md:block">
          <div className="truncate font-display text-sm font-semibold">{title}</div>
          {subtitle && <div className="truncate text-xs text-ink-foreground/60">{subtitle}</div>}
        </div>
      )}
      <div className="ml-auto flex items-center gap-2">
        <Button asChild variant="ghost" size="sm" className="text-ink-foreground hover:bg-ink-foreground/10 hover:text-ink-foreground">
          <Link to="/sites">All sites</Link>
        </Button>
        <Button variant="ghost" size="sm" className="text-ink-foreground/70 hover:bg-ink-foreground/10 hover:text-ink-foreground"
          onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/auth" }); }}>
          Sign out
        </Button>
      </div>
    </header>
  );
}

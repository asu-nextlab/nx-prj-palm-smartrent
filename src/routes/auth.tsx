import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Lovable's Google sign-in only works on Lovable-hosted domains, so local development
// against a separate dev database uses email + password instead. Enabled only by
// VITE_DEV_LOGIN=true in an untracked .env.local, and never in production builds.
const DEV_LOGIN = import.meta.env.DEV && import.meta.env["VITE_DEV_LOGIN"] === "true";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — SmartRent Digital Twin" },
      { name: "description", content: "Sign in with your ASU Google account to manage SmartRent digital twin sites." },
      { property: "og:title", content: "Sign in — SmartRent Digital Twin" },
      { property: "og:description", content: "ASU team access to SmartRent digital twin sites." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

const isAsu = (email?: string | null) => !!email?.toLowerCase().endsWith("@asu.edu");

function AuthPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const check = async (email?: string | null) => {
      if (isAsu(email)) navigate({ to: "/sites" });
      else {
        await supabase.auth.signOut();
        toast.error("Only @asu.edu Google accounts can sign in.");
      }
    };
    if (new URLSearchParams(window.location.search).get("denied")) toast.error("Only @asu.edu Google accounts can sign in.");
    supabase.auth.getSession().then(({ data }) => { if (data.session) void check(data.session.user.email); });
    const { data } = supabase.auth.onAuthStateChange((e, s) => { if (s && e === "SIGNED_IN") void check(s.user.email); });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-4">
      <div className="w-full max-w-sm rounded-xl bg-card p-8 shadow-2xl">
        <img src="/favicon.svg" alt="" width={36} height={36} />
        <h1 className="mt-4 text-2xl font-semibold">Sign in</h1>
        <p className="mt-1 text-sm text-muted-foreground">SmartRent Digital Twin — ASU accounts only</p>
        <Button className="mt-6 w-full" onClick={async () => {
          const r = await lovable.auth.signInWithOAuth("google", {
            redirect_uri: window.location.origin + "/auth",
            extraParams: { hd: "asu.edu", prompt: "select_account" },
          });
          if (r.error) toast.error(String(r.error.message ?? r.error));
        }}>Continue with ASU Google</Button>
        {DEV_LOGIN && <DevLogin />}
      </div>
    </div>
  );
}

function DevLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async (mode: "in" | "up"): Promise<void> => {
    if (!isAsu(email)) { toast.error("Use an @asu.edu email (the database only allows ASU accounts)."); return; }
    setBusy(true);
    const { error } = mode === "in"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (error) toast.error(error.message);
  };
  return (
    <div className="mt-6 space-y-2 border-t pt-4">
      <p className="text-xs font-semibold text-warn">Local dev login (dev database only)</p>
      <Input type="email" placeholder="you@asu.edu" value={email} onChange={(e) => setEmail(e.target.value)} />
      <Input type="password" placeholder="Password (6+ characters)" value={password} onChange={(e) => setPassword(e.target.value)} />
      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" disabled={busy} onClick={() => run("in")}>Sign in</Button>
        <Button variant="outline" className="flex-1" disabled={busy} onClick={() => run("up")}>Create account</Button>
      </div>
    </div>
  );
}

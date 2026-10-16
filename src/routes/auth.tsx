import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";

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
      </div>
    </div>
  );
}

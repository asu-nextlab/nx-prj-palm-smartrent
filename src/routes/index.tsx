import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SmartRent Digital Twin — Explore communities in 3D" },
      { name: "description", content: "Place Blender or SketchUp site models on the map, manage every apartment in a spreadsheet and inspect smart devices." },
      { property: "og:title", content: "SmartRent Digital Twin" },
      { property: "og:description", content: "Geolocated 3D apartment communities with editable unit data and smart-device inspection." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="flex min-h-screen flex-col bg-ink text-ink-foreground">
      <header className="flex items-center justify-between px-8 py-6">
        <img src="/smartrent-logo.svg" alt="SmartRent" width={152} height={20} className="invert" />
        <Button asChild variant="ghost" className="text-ink-foreground hover:bg-ink-foreground/10 hover:text-ink-foreground"><Link to="/auth">Sign in</Link></Button>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-8 pb-24">
        <p className="eyebrow !text-brand">Digital twin platform</p>
        <h1 className="mt-4 max-w-3xl text-5xl font-semibold leading-[1.05] md:text-7xl">Every building, every home, every device — in one live model.</h1>
        <p className="mt-6 max-w-xl text-lg text-ink-foreground/70">
          Each site, apartment, device.
        </p>
        <div className="mt-10 flex gap-3">
          <Button asChild size="lg" className="bg-brand text-ink hover:bg-brand/90"><Link to="/sites">Open the platform</Link></Button>
        </div>
        <div className="mt-20 grid gap-6 border-t border-ink-foreground/15 pt-8 sm:grid-cols-3">
          {[["Geolocate", "Position your site model on OpenStreetMap and adjust its rotation."], ["Ingest", "Apartment objects with the prefix APT_ are added to the site's apartment spreadsheet, one row per apartment."], ["Inspect", "Device objects with the prefix DEV_ inside an apartment can be selected in the 3D viewer."]].map(([t, d]) => (
            <div key={t}><div className="font-display text-ink-foreground/60">{t}</div><div className="mt-1 text-sm text-ink-foreground/60">{d}</div></div>
          ))}
        </div>
      </main>
    </div>
  );
}

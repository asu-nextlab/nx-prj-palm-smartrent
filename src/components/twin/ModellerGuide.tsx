import type { ReactNode } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportSampleGlb } from "@/lib/twin/build";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const C = ({ children }: { children: ReactNode }) => (
  <code className="rounded bg-muted px-1 py-0.5 text-xs text-foreground">{children}</code>
);

const DEVICE_KINDS = ["thermostat", "lock", "fridge", "tv", "washer", "dryer", "dishwasher", "oven", "light", "hub", "sensor", "camera", "leak"];

async function downloadSample() {
  const blob = await exportSampleGlb();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "smartrent-sample-site.glb";
  a.click();
}

export function ModellerGuide() {
  return (
    <section className="mt-14 rounded-xl border bg-card p-6 text-sm">
      <p className="eyebrow">For modellers</p>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold">Building a new site in Blender</h3>
        <Button type="button" variant="outline" size="sm" onClick={downloadSample}>
          <Download className="h-4 w-4" /> Download sample GLB file
        </Button>
      </div>
      <Tabs defaultValue="workflow" className="mt-4">
        <TabsList className="flex h-auto flex-wrap justify-start">
          <TabsTrigger value="workflow">1. Workflow</TabsTrigger>
          <TabsTrigger value="naming">2. Naming</TabsTrigger>
          <TabsTrigger value="devices">3. Devices</TabsTrigger>
          <TabsTrigger value="data">4. Apartment data</TabsTrigger>
          <TabsTrigger value="export">5. Export & upload</TabsTrigger>
          <TabsTrigger value="check">Checklist</TabsTrigger>
        </TabsList>
        <div className="mt-4 text-muted-foreground">
          <TabsContent value="workflow">
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>Set <b>Scene → Units</b> to Metric, unit scale 1.0 (1 Blender unit = 1 meter).</li>
              <li>Centre the complex on the world origin (0, 0, 0). Ground level is Z = 0.</li>
              <li>Point the site's north toward Blender's <b>−Y</b> axis. Rotation can be fine-tuned in the app.</li>
              <li>Model the site context (ground, roads, paths, trees, parking) — these can be named freely.</li>
              <li>Model each featured apartment as its own parent object (empty or mesh), with walls, furniture and devices parented beneath it.</li>
              <li>Name everything using the conventions in the next tabs, then export as GLB.</li>
            </ol>
          </TabsContent>
          <TabsContent value="naming">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Apartment parent: <C>APT_&lt;number&gt;</C>, e.g. <C>APT_4301</C>. The part after <C>APT_</C> becomes the apartment number — unique per site.</li>
              <li>Exterior walls / roof inside an apartment: <C>SHELL</C>. Hidden automatically when looking inside.</li>
              <li>Devices: <C>DEV_&lt;kind&gt;</C>, e.g. <C>DEV_fridge</C>. Suffix duplicates: <C>DEV_tv_living</C>, <C>DEV_tv_bedroom</C>.</li>
              <li>Furniture and other parts: any name not starting with <C>APT_</C> or <C>DEV_</C>.</li>
              <li>Use underscores, not spaces or dots. Remove Blender's <C>.001</C> suffixes.</li>
            </ul>
            <pre className="mt-3 overflow-x-auto rounded-md bg-muted p-3 text-xs text-foreground">{`Site
├─ Ground, Road_Main, Tree_01 …
└─ APT_4301
   ├─ SHELL
   ├─ Sofa, Bed, Kitchen …
   ├─ DEV_thermostat
   ├─ DEV_fridge
   └─ DEV_lock_front`}</pre>
          </TabsContent>
          <TabsContent value="devices">
            <p>Devices must be <b>children of the apartment</b> (Ctrl+P → Object). The word after <C>DEV_</C> sets the device type:</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {DEVICE_KINDS.map((k) => <C key={k}>DEV_{k}</C>)}
            </div>
            <p className="mt-3">Unknown kinds import as a generic device. Keep each device a single compact object so it's easy to click.</p>
          </TabsContent>
          <TabsContent value="data">
            <p>Select the apartment parent → <b>Object Properties → Custom Properties</b> → add:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li><C>beds</C>, <C>baths</C>, <C>area_sqft</C> (numbers)</li>
              <li><C>floor</C> (number — otherwise worked out from height, ~3 m per floor)</li>
              <li><C>layout</C> (text, e.g. "2B2B Corner")</li>
            </ul>
            <p className="mt-2">All optional, missing values can be filled in the apartment spreadsheet. Spreadsheet edits don't change the GLB.</p>
          </TabsContent>
          <TabsContent value="export">
            <ol className="list-decimal space-y-1.5 pl-5">
              <li><b>File → Export → glTF 2.0</b>, Format: <b>glTF Binary (.glb)</b>.</li>
              <li>Tick <b>Include → Custom Properties</b>; keep <b>+Y Up</b> enabled under Transform.</li>
              <li>Apply modifiers, embed textures. Aim for under ~50 MB.</li>
              <li>SketchUp: name groups/components the same way and export GLB via a glTF exporter extension.</li>
              <li>Click <b>Upload site model</b>, enter name and coordinates, then adjust with the map placement and nudge tools.</li>
            </ol>
          </TabsContent>
          <TabsContent value="check">
            <ul className="list-disc space-y-1 pl-5">
              <li>Units are meters and the site is centred at the origin.</li>
              <li>Every featured apartment is named <C>APT_&lt;number&gt;</C> with a unique number.</li>
              <li>All devices are parented inside their apartment and start with <C>DEV_</C>.</li>
              <li>No leftover <C>.001</C> name suffixes.</li>
              <li>Custom Properties ticked on export. Tip: <button type="button" onClick={downloadSample} className="font-medium text-brand-deep underline underline-offset-4">download the sample GLB file</button> as a reference.</li>
            </ul>
          </TabsContent>
        </div>
      </Tabs>
    </section>
  );
}

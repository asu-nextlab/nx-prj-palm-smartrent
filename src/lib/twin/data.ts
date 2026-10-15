import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Site = Database["public"]["Tables"]["sites"]["Row"];
export type Building = Database["public"]["Tables"]["buildings"]["Row"];
export type Unit = Database["public"]["Tables"]["units"]["Row"];
export type Device = Database["public"]["Tables"]["devices"]["Row"];

export const sitesQuery = queryOptions({
  queryKey: ["sites"],
  queryFn: async () => {
    const { data, error } = await supabase.from("sites").select("*, units(count)").order("created_at");
    if (error) throw error;
    return data;
  },
});

export const siteQuery = (id: string) => queryOptions({
  queryKey: ["site", id],
  queryFn: async () => {
    const [s, b, u] = await Promise.all([
      supabase.from("sites").select("*").eq("id", id).single(),
      supabase.from("buildings").select("*").eq("site_id", id).order("name"),
      supabase.from("units").select("*").eq("site_id", id).order("apt_number"),
    ]);
    if (s.error) throw s.error;
    if (b.error) throw b.error;
    if (u.error) throw u.error;
    let glbUrl: string | null = null;
    if (s.data.model_path) {
      const { data, error } = await supabase.storage.from("models").createSignedUrl(s.data.model_path, 60 * 60 * 6);
      if (error) throw error;
      glbUrl = data.signedUrl;
    }
    return { site: s.data, buildings: b.data, units: u.data, glbUrl };
  },
  staleTime: 1000 * 60 * 30,
});

export const devicesQuery = (unitId: string) => queryOptions({
  queryKey: ["devices", unitId],
  queryFn: async () => {
    const { data, error } = await supabase.from("devices").select("*").eq("unit_id", unitId).order("name");
    if (error) throw error;
    return data;
  },
});

/** Every device on a site, tagged with its apartment's object name, so the 3D view can
 *  hide DEV_ meshes whose row was deleted and show markers for rows with no mesh. */
export const siteDevicesQuery = (siteId: string) => queryOptions({
  queryKey: ["site-devices", siteId],
  queryFn: async () => {
    const { data, error } = await supabase.from("devices").select("*, units!inner(site_id, object_name)").eq("units.site_id", siteId);
    if (error) throw error;
    return data.map(({ units, ...d }) => ({ ...d, unit_object_name: units.object_name }));
  },
});
export type SiteDevice = Device & { unit_object_name: string };

/** First unused DEV_ name for a new device in an apartment, e.g. DEV_lock or DEV_lock_2. */
export function nextDeviceObjectName(kind: string, taken: Iterable<string>) {
  const used = new Set([...taken].map((n) => n.toLowerCase()));
  const base = `DEV_${kind}`;
  if (!used.has(base.toLowerCase())) return base;
  for (let i = 2; ; i++) if (!used.has(`${base}_${i}`.toLowerCase())) return `${base}_${i}`;
}

export async function addDevice(row: Database["public"]["Tables"]["devices"]["Insert"]) {
  const { data, error } = await supabase.from("devices").insert(row).select().single();
  if (error) throw error;
  return data;
}

/** Deletes the device row only; the uploaded GLB is never modified (its mesh is hidden instead). */
export async function deleteDevice(id: string) {
  const { data, error } = await supabase.from("devices").delete().eq("id", id).select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("Device wasn't deleted. It may already be gone, or you don't have access.");
}

export const meQuery = queryOptions({
  queryKey: ["me"],
  queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null,
});

export const creatorName = (u: { email?: string; user_metadata?: Record<string, unknown> } | null | undefined) =>
  String(u?.user_metadata?.["full_name"] ?? u?.user_metadata?.["name"] ?? u?.email ?? "Unknown");

/** Removes a site, its stored model and (by cascade) all apartment and device data. Only the creator may do this. */
export async function deleteSite(site: { id: string; model_path: string | null }) {
  const { data, error } = await supabase.from("sites").delete().eq("id", site.id).select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("Only the person who uploaded this site can delete it.");
  if (site.model_path) await supabase.storage.from("models").remove([site.model_path]);
}

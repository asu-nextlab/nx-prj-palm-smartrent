import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Returns the referrer-restricted Google Map Tiles key to signed-in team members only.
 *  Sessions are created from the browser so Google sees the app's referrer. */
export const getGoogleKey = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const key = process.env["GOOGLE_MAP_TILES_KEY"];
    if (!key) throw new Error("Google Map Tiles key is not configured");
    return { key };
  });

/** Browser-side: fetch the key, then open 2D tile sessions (referer is sent by the browser). */
export async function getGoogleTiles() {
  const { key } = await getGoogleKey();
  const session = async (mapType: "satellite" | "roadmap") => {
    const res = await fetch(`https://tile.googleapis.com/v1/createSession?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mapType, language: "en-US", region: "US" }),
    });
    if (!res.ok) throw new Error(`Google tiles request failed [${res.status}]: ${await res.text()}`);
    return ((await res.json()) as { session: string }).session;
  };
  const [satellite, roadmap] = await Promise.all([session("satellite"), session("roadmap")]);
  return { key, sessions: { satellite, roadmap } };
}

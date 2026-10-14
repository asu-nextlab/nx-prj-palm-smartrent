import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Returns the Google Map Tiles key plus fresh 2D tile sessions to signed-in team members only.
 *  The key is referrer-restricted in Google Cloud; tiles are fetched directly by the browser. */
export const getGoogleTiles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const key = process.env["GOOGLE_MAP_TILES_KEY"];
    if (!key) throw new Error("Google Map Tiles key is not configured");
    const session = async (mapType: "satellite" | "roadmap") => {
      const res = await fetch(`https://tile.googleapis.com/v1/createSession?key=${key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mapType, language: "en-US", region: "US" }),
      });
      if (!res.ok) {
        const body = await res.text();
        console.error(`Google createSession failed [${res.status}]: ${body}`);
        throw new Error(`Google tiles request failed [${res.status}]: ${body}`);
      }
      return ((await res.json()) as { session: string }).session;
    };
    const [satellite, roadmap] = await Promise.all([session("satellite"), session("roadmap")]);
    return { key, sessions: { satellite, roadmap } };
  });

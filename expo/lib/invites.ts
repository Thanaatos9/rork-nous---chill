/**
 * Space invite codes.
 *
 * A space has exactly ONE permanent invite code — think of it as the address of
 * the space rather than a ticket handed to a specific person. It never expires
 * and has no usage limit; anyone holding it joins as an observer and the owner
 * decides afterwards who may participate. If the code leaks, the owner
 * regenerates it, which invalidates the previous one.
 *
 * Codes live in the `invite_codes` table (one row per space). The historical
 * per-person columns (`role`, `max_uses`, `expires_at`) are kept for schema
 * compatibility but are always written as observer / unlimited / never.
 */
import { supabase } from "@/lib/supabase";
import type { InviteCode } from "@/lib/types";

/** Ambiguous glyphs (0/O, 1/I) are excluded so codes stay easy to dictate. */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateSpaceCode(length = 7): string {
  let out = "";
  for (let i = 0; i < length; i++) out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return out;
}

function isConflict(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "23505" || /duplicate|already exists|conflict/i.test(error.message ?? "");
}

/** Reads the space's code, tolerating legacy spaces that still hold several rows. */
async function readSpaceInviteCode(spaceId: string): Promise<InviteCode | null> {
  const { data, error } = await supabase
    .from("invite_codes")
    .select("*")
    .eq("space_id", spaceId)
    .order("created_at", { ascending: true })
    .limit(1);
  if (error) throw error;
  return ((data ?? [])[0] as InviteCode | undefined) ?? null;
}

async function insertSpaceInviteCode(spaceId: string, userId: string): Promise<InviteCode> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await supabase
      .from("invite_codes")
      .insert({
        code: generateSpaceCode(),
        space_id: spaceId,
        role: "observer",
        max_uses: null,
        use_count: 0,
        expires_at: null,
        created_by: userId,
      })
      .select("*")
      .single();
    if (!error) return data as InviteCode;
    if (!isConflict(error)) throw error;

    // Either the random code collided, or another device just created the
    // space code. Re-read before burning another attempt.
    const existing = await readSpaceInviteCode(spaceId);
    if (existing) return existing;
  }
  throw new Error("Impossible de générer le code de l'espace. Réessaie.");
}

/** Returns the space's invite code, creating it on the fly if it has none yet. */
export async function ensureSpaceInviteCode(spaceId: string, userId: string): Promise<InviteCode> {
  const existing = await readSpaceInviteCode(spaceId);
  if (existing) return existing;
  return insertSpaceInviteCode(spaceId, userId);
}

/**
 * Replaces the space's code with a fresh one. Existing members keep their
 * access — only the old code stops working.
 */
export async function regenerateSpaceInviteCode(spaceId: string, userId: string): Promise<InviteCode> {
  const { error } = await supabase.from("invite_codes").delete().eq("space_id", spaceId);
  if (error) throw error;
  return insertSpaceInviteCode(spaceId, userId);
}

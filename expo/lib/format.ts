import type { Space } from "./types";

const MONTHS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

export function formatDate(value: string | null | undefined): string {
  const d = toDate(value);
  if (!d) return "";
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Day-first numeric format: JJ/MM/AAAA (e.g. 30/07/2026). */
export function formatDMY(value: string | Date | null | undefined): string {
  const d = value instanceof Date ? value : toDate(value);
  if (!d || isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

export function formatDateShort(value: string | null | undefined): string {
  const d = toDate(value);
  if (!d) return "";
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function formatRelative(value: string | null | undefined): string {
  const d = toDate(value);
  if (!d) return "";
  const diff = Date.now() - d.getTime();
  const sec = Math.round(diff / 1000);
  const min = Math.round(sec / 60);
  const hr = Math.round(min / 60);
  const day = Math.round(hr / 24);
  if (sec < 45) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  if (hr < 24) return `il y a ${hr} h`;
  if (day === 1) return "hier";
  if (day < 7) return `il y a ${day} j`;
  return formatDateShort(value);
}

export function formatDuration(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "string" && isNaN(Number(value))) return value;
  const minutes = typeof value === "number" ? value : Number(value);
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m}`;
}

export function daysBetween(from: Date, to: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

export type SeasonState = "upcoming" | "live" | "ending" | "ended" | "unlocked";

export interface SeasonStatus {
  state: SeasonState;
  label: string;
  daysLeft: number | null;
  progress: number; // 0..1
}

export function getSeasonStatus(space: Pick<Space, "season_start" | "season_end" | "season_unlocked">): SeasonStatus {
  const now = new Date();
  const start = toDate(space.season_start);
  const end = toDate(space.season_end);

  if (space.season_unlocked) {
    return { state: "unlocked", label: "Saison débloquée", daysLeft: 0, progress: 1 };
  }

  if (start && now < start) {
    const d = daysBetween(now, start);
    return { state: "upcoming", label: d <= 1 ? "Commence bientôt" : `Démarre dans ${d} j`, daysLeft: d, progress: 0 };
  }

  if (end) {
    const d = daysBetween(now, end);
    if (d < 0) return { state: "ended", label: "Saison terminée", daysLeft: 0, progress: 1 };
    const total = start ? Math.max(1, daysBetween(start, end)) : null;
    const elapsed = start ? daysBetween(start, now) : null;
    const progress = total && elapsed !== null ? Math.min(1, Math.max(0, elapsed / total)) : 0.5;
    const label = d === 0 ? "Dernier jour" : d <= 7 ? `Plus que ${d} j` : `${d} jours restants`;
    return { state: d <= 7 ? "ending" : "live", label, daysLeft: d, progress };
  }

  return { state: "live", label: "Saison en cours", daysLeft: null, progress: 0.5 };
}

/** Normalises a tags value that could arrive as array, JSON string, or comma list. */
export function normalizeTags(tags: unknown): string[] {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags.map((t) => String(t)).filter(Boolean);
  if (typeof tags === "string") {
    const s = tags.trim();
    if (s.startsWith("[")) {
      try {
        const parsed = JSON.parse(s);
        return Array.isArray(parsed) ? parsed.map((t) => String(t)) : [];
      } catch {
        return [];
      }
    }
    return s.split(",").map((t) => t.trim()).filter(Boolean);
  }
  return [];
}

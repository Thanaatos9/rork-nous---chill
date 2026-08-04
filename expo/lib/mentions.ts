/**
 * Mentions — "@" in a comment box.
 *
 * A mention is stored twice, on purpose: as plain text inside the comment
 * ("@Samuel a raison") so the body stays readable everywhere — in the app, in a
 * push banner, in an email one day — and as a list of user ids on the row, so
 * the database knows who to notify without ever having to parse French.
 *
 * The text is therefore the display name as it stood when the comment was
 * written. Renaming yourself later leaves old mentions reading the old name;
 * the notification already happened, and rewriting history to match a new name
 * would be worse.
 */

export interface MentionCandidate {
  id: string;
  name: string;
}

const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The "@…" being typed right before the caret, if any.
 *
 * An "@" only opens a mention at the start of the text or after whitespace, so
 * an email address never turns the picker on. The query itself stops at the
 * first space: display names contain spaces ("Hugo And Sam"), but a query that
 * kept growing across them would keep the list open for the rest of the
 * sentence. You type enough to find the person, then pick.
 */
export function mentionQuery(text: string, cursor: number): { query: string; start: number } | null {
  const upTo = text.slice(0, Math.max(0, Math.min(cursor, text.length)));
  const at = upTo.lastIndexOf("@");
  if (at === -1) return null;
  if (at > 0 && !/\s/.test(upTo[at - 1])) return null;
  const query = upTo.slice(at + 1);
  if (/\s/.test(query)) return null;
  return { query, start: at };
}

/** Replaces the "@…" being typed with the chosen name, and a trailing space. */
export function applyMention(
  text: string,
  start: number,
  cursor: number,
  name: string
): { text: string; cursor: number } {
  const inserted = `@${name} `;
  const next = text.slice(0, start) + inserted + text.slice(cursor);
  return { text: next, cursor: start + inserted.length };
}

/** The people whose name matches what is being typed, longest names last. */
export function matchMentions<T extends MentionCandidate>(
  candidates: T[],
  query: string,
  limit = 6
): T[] {
  const q = query.trim().toLowerCase();
  const matching = q
    ? candidates.filter((c) => c.name.toLowerCase().includes(q))
    : candidates;
  return matching.slice(0, limit);
}

/**
 * Which candidates the finished text actually mentions.
 *
 * Read from the body rather than from what was tapped in the picker: a name
 * typed by hand counts, and a mention deleted before sending does not. Shares
 * `splitMentions` so that "@Samuel" notifies Samuel and not the Sam who also
 * happens to be in the space — the longest name wins the run of text, once.
 */
export function mentionedIds(text: string, candidates: MentionCandidate[]): string[] {
  const ids: string[] = [];
  for (const part of splitMentions(text, candidates)) {
    if (!part.mention) continue;
    const name = part.text.slice(1).toLowerCase();
    const person = candidates.find((c) => c.name.trim().toLowerCase() === name);
    if (person && !ids.includes(person.id)) ids.push(person.id);
  }
  return ids;
}

/**
 * Splits a comment into plain runs and mention runs, for rendering.
 *
 * Longest names first so "@Hugo And Sam" is not cut short by a "@Hugo" who is
 * also in the space.
 */
export function splitMentions(
  text: string,
  candidates: MentionCandidate[]
): { text: string; mention: boolean }[] {
  const names = candidates
    .map((c) => c.name.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  if (names.length === 0) return [{ text, mention: false }];

  const pattern = new RegExp(`@(?:${names.map(escapeRegex).join("|")})`, "gi");
  const parts: { text: string; mention: boolean }[] = [];
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > last) parts.push({ text: text.slice(last, index), mention: false });
    parts.push({ text: match[0], mention: true });
    last = index + match[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), mention: false });
  return parts.length > 0 ? parts : [{ text, mention: false }];
}

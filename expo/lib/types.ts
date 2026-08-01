/** Domain types mirroring the existing "Gather" Supabase schema. */

export type MemberRole = "owner" | "member" | "observer";

export interface Profile {
  id: string;
  name: string | null;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
  updated_at: string;
}

export interface Space {
  id: string;
  name: string;
  description: string | null;
  cover_url: string | null;
  created_by: string;
  season_start: string | null;
  season_end: string | null;
  season_unlocked: boolean;
  created_at: string;
}

export interface SpaceMember {
  space_id: string;
  user_id: string;
  role: MemberRole;
  can_create_episodes: boolean;
  joined_at: string;
  profile?: Profile | null;
}

/**
 * The single permanent invite code of a space (one row per space). Anyone with
 * the code joins as an observer; regenerating it invalidates the previous one.
 */
export interface InviteCode {
  id: string;
  code: string;
  space_id: string;
  use_count: number;
  created_by: string;
  created_at: string;
}

export interface Episode {
  id: string;
  space_id: string;
  title: string;
  date: string | null;
  place: string | null;
  duration: string | number | null;
  tags: string[] | null;
  cover_url: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  media?: EpisodeMedia[];
  media_count?: number;
}

export interface EpisodeMedia {
  id: string;
  episode_id: string;
  url: string;
  type: string | null;
  created_at: string;
}

export interface EpisodeLike {
  id: string;
  episode_id: string;
  user_id: string;
  created_at: string;
}

export interface Review {
  id: string;
  episode_id: string;
  author_id: string;
  space_id: string | null;
  rating: number | null;
  favorite_moment: string | null;
  awkward_moment: string | null;
  funny_quote: string | null;
  summary: string | null;
  song: string | null;
  created_at: string;
  updated_at: string;
  profile?: Profile | null;
}

export interface EpisodeComment {
  id: string;
  episode_id: string;
  author_id: string;
  body: string;
  created_at: string;
  profile?: Profile | null;
  reactions?: CommentReaction[];
}

export interface CommentReaction {
  comment_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

export interface Idea {
  id: string;
  space_id: string;
  title: string;
  description: string | null;
  status: string | null;
  proposed_by: string | null;
  created_at: string;
  profile?: Profile | null;
  votes?: IdeaVote[];
}

export interface IdeaVote {
  idea_id: string;
  user_id: string;
}

export interface AppNotification {
  id: string;
  user_id: string;
  space_id: string | null;
  title: string | null;
  body: string | null;
  url: string | null;
  read_at: string | null;
  created_at: string;
}

export interface Synthese {
  id: string;
  space_id: string;
  video_url: string | null;
  content?: string | null;
  [key: string]: unknown;
}

/** A space joined with the current user's membership row. */
export interface SpaceWithMembership extends Space {
  membership: SpaceMember;
  member_count?: number;
}

/** Whether the current user can actively participate (write) in a space. */
export function canParticipate(member: Pick<SpaceMember, "role" | "can_create_episodes"> | null | undefined): boolean {
  if (!member) return false;
  if (member.role === "owner") return true;
  if (member.role === "member" && member.can_create_episodes) return true;
  return false;
}

export function isOwner(member: Pick<SpaceMember, "role"> | null | undefined): boolean {
  return member?.role === "owner";
}

/** Display role accounting for un-promoted members being treated as observers. */
export function effectiveRole(
  member: Pick<SpaceMember, "role" | "can_create_episodes"> | null | undefined
): MemberRole {
  if (!member) return "observer";
  if (member.role === "member" && !member.can_create_episodes) return "observer";
  return member.role;
}

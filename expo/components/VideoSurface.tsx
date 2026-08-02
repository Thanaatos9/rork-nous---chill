import { useEvent } from "expo";
import { Image } from "expo-image";
import { createVideoPlayer, useVideoPlayer, VideoView, type VideoPlayer, type VideoThumbnail } from "expo-video";
import { Play } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { AppText } from "@/components/ui/Text";

/**
 * Everything the app knows about showing a video rather than a photo.
 *
 * A photo has a size the layout can read; a video does not, and a native video
 * surface left without an explicit width falls back to its own pixel size —
 * a 1280×720 clip laid out 1280 points wide inside a 390 point screen, which
 * reads on the phone as a violently zoomed-in crop. Every surface here is
 * therefore given both dimensions in points, and plays with contentFit
 * "contain" so nothing of the frame is ever cut.
 *
 * The other half of the difference is the still frame: a video has no natural
 * thumbnail, so an album tile falls back to a black square that says nothing
 * about what was filmed. `VideoPoster` extracts a real frame instead.
 */

/** Most clips are landscape, and the guess only costs black bars — never a crop. */
export const DEFAULT_VIDEO_ASPECT = 16 / 9;

/**
 * The natural width/height ratio of the loaded video, or `null` while it is
 * unknown — the source is still loading, or the platform is web, where
 * expo-video does not expose video tracks at all.
 */
export function useVideoAspectRatio(player: VideoPlayer): number | null {
  const event = useEvent(player, "videoTrackChange", { videoTrack: player.videoTrack });
  const size = event?.videoTrack?.size;
  if (!size || !size.width || !size.height) return null;
  return size.width / size.height;
}

/**
 * One extracted frame per URL, kept for the session: the same clip shows up in
 * the album, in the hero and behind the viewer, and pulling a frame out of it
 * again each time is a visible stutter. `null` is cached too — a file the
 * device cannot decode should be asked about once, not on every render.
 */
const posterCache = new Map<string, VideoThumbnail | null>();

/** Each entry holds a native bitmap; a long session browsing seasons of videos
 *  would otherwise keep every frame it ever decoded. Oldest goes first. */
const POSTER_CACHE_MAX = 80;

function rememberPoster(url: string, thumbnail: VideoThumbnail | null): void {
  posterCache.set(url, thumbnail);
  while (posterCache.size > POSTER_CACHE_MAX) {
    const oldest = posterCache.keys().next().value;
    if (oldest === undefined) break;
    // Dropped, not released: a tile still on screen may be drawing it.
    posterCache.delete(oldest);
  }
}

/**
 * Extraction spins up a real decoder, so a grid of clips is done one at a time
 * rather than all at once on the first frame of the screen.
 */
let posterQueue: Promise<unknown> = Promise.resolve();

async function extractPoster(url: string): Promise<VideoThumbnail | null> {
  const player = createVideoPlayer(url);
  try {
    player.muted = true;
    // A hair into the clip rather than at 0s: the very first frame of a phone
    // recording is often black while the sensor settles.
    const [thumbnail] = await player.generateThumbnailsAsync([0.2], { maxWidth: 720 });
    return thumbnail ?? null;
  } finally {
    player.release();
  }
}

/**
 * A still frame from the video, once it has been extracted. Returns `null` on
 * web (expo-video throws there) and whenever the file refuses to give one up —
 * callers fall back to a plain surface.
 */
export function useVideoPoster(url: string | null): VideoThumbnail | null {
  const [poster, setPoster] = useState<VideoThumbnail | null>(() => (url ? posterCache.get(url) ?? null : null));

  useEffect(() => {
    if (!url || Platform.OS === "web") return;
    if (posterCache.has(url)) {
      setPoster(posterCache.get(url) ?? null);
      return;
    }

    let alive = true;
    posterQueue = posterQueue
      .then(() => (posterCache.has(url) ? posterCache.get(url) ?? null : extractPoster(url)))
      .then((thumbnail) => {
        rememberPoster(url, thumbnail ?? null);
        if (alive) setPoster(thumbnail ?? null);
      })
      .catch((e) => {
        // A missing frame is a cosmetic loss: the tile keeps its play button.
        console.log("[video] impossible d'extraire une image de la vidéo:", e);
        rememberPoster(url, null);
      });

    return () => {
      alive = false;
    };
  }, [url]);

  return poster;
}

/**
 * A video shown as a still: its own first frame when the device can extract
 * one, a black surface otherwise, with a play affordance on top so it never
 * passes for a photo.
 */
export function VideoPoster({
  url,
  contentFit = "cover",
  play = "small",
  label,
  style,
}: {
  url: string;
  /** "cover" for poster slots that are meant to crop, "contain" to keep the whole frame. */
  contentFit?: "cover" | "contain";
  play?: "small" | "large" | "none";
  label?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const poster = useVideoPoster(url);

  return (
    <View style={[{ backgroundColor: "#0A0A0B", alignItems: "center", justifyContent: "center", gap: 10, overflow: "hidden" }, style]}>
      {poster ? <Image source={poster} style={StyleSheet.absoluteFill} contentFit={contentFit} transition={150} /> : null}

      {play === "large" ? (
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: "rgba(0,0,0,0.45)", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.85)", alignItems: "center", justifyContent: "center" }}>
          <Play size={28} color="#fff" fill="#fff" style={{ marginLeft: 3 }} />
        </View>
      ) : null}

      {play === "small" ? (
        <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(0,0,0,0.45)", borderWidth: 1, borderColor: "rgba(255,255,255,0.8)", alignItems: "center", justifyContent: "center" }}>
          <Play size={16} color="#fff" fill="#fff" style={{ marginLeft: 2 }} />
        </View>
      ) : null}

      {label ? (
        <AppText style={{ color: "rgba(255,255,255,0.85)", fontWeight: "600", fontSize: 13, textShadowColor: "rgba(0,0,0,0.6)", textShadowRadius: 4 }}>{label}</AppText>
      ) : null}
    </View>
  );
}

/**
 * A video playing in the flow of a screen, sized to its own shape.
 *
 * The box follows the clip's ratio instead of a fixed 16:9 frame — a portrait
 * clip filmed on a phone otherwise sits as a thin strip between two thick black
 * bars. The ratio is clamped: a raw 9:16 would run taller than the screen and
 * push everything else out of view, so a very tall clip settles for a 3:4 box
 * and the small letterbox that comes with it.
 */
export function InlineVideo({
  url,
  style,
  nativeControls = true,
}: {
  url: string;
  style?: StyleProp<ViewStyle>;
  nativeControls?: boolean;
}) {
  const player = useVideoPlayer(url, (p) => {
    p.loop = false;
  });
  const natural = useVideoAspectRatio(player);
  const aspectRatio = Math.min(Math.max(natural ?? DEFAULT_VIDEO_ASPECT, 0.75), 2.4);

  return (
    <VideoView
      player={player}
      style={[{ width: "100%", aspectRatio, backgroundColor: "#000" }, style]}
      contentFit="contain"
      nativeControls={nativeControls}
      allowsFullscreen
    />
  );
}

/**
 * A video filling a page of the fullscreen viewer. Both dimensions are given in
 * points on purpose — see the note at the top of this file: a native video
 * surface with a missing dimension measures itself in source pixels and blows
 * far past the screen.
 */
export function FullscreenVideo({ url, width, height, active }: { url: string; width: number; height: number; active: boolean }) {
  const player = useVideoPlayer(url, (p) => {
    p.loop = true;
  });

  useEffect(() => {
    if (active) player.play();
    else player.pause();
  }, [active, player]);

  return (
    <VideoView
      player={player}
      style={{ width, height, backgroundColor: "#000" }}
      contentFit="contain"
      nativeControls
      allowsFullscreen
    />
  );
}

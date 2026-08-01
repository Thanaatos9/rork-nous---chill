import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useVideoPlayer, VideoView } from "expo-video";
import { Play, X } from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import { Dimensions, Modal, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, View } from "react-native";
import { AppText } from "@/components/ui/Text";
import { IconButton } from "@/components/ui/Button";
import { colors, radius, spacing } from "@/constants/theme";
import type { EpisodeMedia } from "@/lib/types";

const W = Dimensions.get("window").width;

function VideoPage({ uri, active }: { uri: string; active: boolean }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
  });
  useEffect(() => {
    if (active) player.play();
    else player.pause();
  }, [active, player]);
  return <VideoView player={player} style={{ flex: 1 }} contentFit="contain" nativeControls allowsFullscreen />;
}

function FullscreenViewer({ media, initialIndex, onClose }: { media: EpisodeMedia[]; initialIndex: number; onClose: () => void }) {
  const [active, setActive] = useState<number>(initialIndex);
  const scrollRef = useRef<ScrollView>(null);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setActive(Math.round(e.nativeEvent.contentOffset.x / W));
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          contentOffset={{ x: initialIndex * W, y: 0 }}
          onMomentumScrollEnd={onScroll}
        >
          {media.map((m, i) => (
            <View key={m.id} style={{ width: W, height: "100%", alignItems: "center", justifyContent: "center" }}>
              {m.type === "video" ? (
                <VideoPage uri={m.url} active={i === active} />
              ) : (
                <Image source={{ uri: m.url }} style={{ width: W, height: "100%" }} contentFit="contain" transition={150} />
              )}
            </View>
          ))}
        </ScrollView>
        <View style={{ position: "absolute", top: 54, right: spacing.lg }}>
          <IconButton icon={<X size={22} color="#fff" />} onPress={onClose} size={44} style={{ backgroundColor: "rgba(255,255,255,0.15)" }} accessibilityLabel="Fermer la galerie" />
        </View>
        {media.length > 1 ? (
          <View style={{ position: "absolute", bottom: 50, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 6 }}>
            {media.map((m, i) => (
              <View key={m.id} style={{ width: i === active ? 22 : 7, height: 7, borderRadius: 4, backgroundColor: i === active ? "#fff" : "rgba(255,255,255,0.4)" }} />
            ))}
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

export function MediaGallery({ media, height = 360, emoji = "🎬" }: { media: EpisodeMedia[]; height?: number; emoji?: string }) {
  const [index, setIndex] = useState<number>(0);
  const [viewer, setViewer] = useState<number | null>(null);

  if (!media || media.length === 0) {
    return (
      <LinearGradient colors={["#3A1418", "#1A1012"]} style={{ height, alignItems: "center", justifyContent: "center" }}>
        <AppText style={{ fontSize: 74, opacity: 0.5 }}>{emoji}</AppText>
      </LinearGradient>
    );
  }

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.round(e.nativeEvent.contentOffset.x / W));
  };

  return (
    <View style={{ height }}>
      <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={onScroll}>
        {media.map((m, i) => (
          <Pressable key={m.id} onPress={() => setViewer(i)} style={{ width: W, height }}>
            {m.type === "video" ? (
              <View style={{ flex: 1, backgroundColor: "#0A0A0B", alignItems: "center", justifyContent: "center", gap: 10 }}>
                <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center" }}>
                  <Play size={28} color="#fff" fill="#fff" style={{ marginLeft: 3 }} />
                </View>
                <AppText style={{ color: "rgba(255,255,255,0.7)", fontWeight: "600", fontSize: 13 }}>Lire la vidéo</AppText>
              </View>
            ) : (
              <Image source={{ uri: m.url }} style={{ width: W, height }} contentFit="cover" transition={200} />
            )}
          </Pressable>
        ))}
      </ScrollView>

      {media.length > 1 ? (
        <View style={{ position: "absolute", bottom: spacing.md, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 6 }}>
          {media.map((m, i) => (
            <View key={m.id} style={{ width: i === index ? 20 : 6, height: 6, borderRadius: 3, backgroundColor: i === index ? "#fff" : "rgba(255,255,255,0.45)" }} />
          ))}
        </View>
      ) : null}

      {viewer !== null ? <FullscreenViewer media={media} initialIndex={viewer} onClose={() => setViewer(null)} /> : null}
    </View>
  );
}

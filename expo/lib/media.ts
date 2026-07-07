import { File } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";
import { MEDIA_BUCKET, supabase } from "./supabase";

export interface PickedAsset {
  uri: string;
  type: "image" | "video";
  mimeType: string;
}

function toPicked(asset: ImagePicker.ImagePickerAsset): PickedAsset {
  const isVideo = asset.type === "video";
  return {
    uri: asset.uri,
    type: isVideo ? "video" : "image",
    mimeType: asset.mimeType ?? (isVideo ? "video/mp4" : "image/jpeg"),
  };
}

/** Pick one or more photos/videos from the library (compressed at pick time). */
export async function pickFromLibrary(multiple = true): Promise<PickedAsset[]> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images", "videos"],
    allowsMultipleSelection: multiple,
    selectionLimit: 10,
    quality: 0.5,
    videoExportPreset: ImagePicker.VideoExportPreset.H264_1280x720,
  });
  if (result.canceled) return [];
  return result.assets.map(toPicked);
}

/** Capture a single photo with the camera (no camera in the cloud simulator). */
export async function captureWithCamera(): Promise<PickedAsset[]> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) throw new Error("L'accès à la caméra a été refusé.");
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ["images", "videos"],
    quality: 0.5,
    videoExportPreset: ImagePicker.VideoExportPreset.H264_1280x720,
  });
  if (result.canceled) return [];
  return result.assets.map(toPicked);
}

/** Pick a single image for a cover / avatar, with editing enabled. */
export async function pickCoverImage(): Promise<PickedAsset | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [3, 4],
    quality: 0.6,
  });
  if (result.canceled || result.assets.length === 0) return null;
  return toPicked(result.assets[0]);
}

/** Pick a single square image for an avatar. */
export async function pickAvatarImage(): Promise<PickedAsset | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.6,
  });
  if (result.canceled || result.assets.length === 0) return null;
  return toPicked(result.assets[0]);
}

/**
 * Reads a picked asset into an ArrayBuffer, whatever the URI type.
 * Pickers return `file://` paths on native, but `data:`/`blob:` URIs on web —
 * the expo-file-system File API only accepts real file paths, so anything else
 * goes through fetch.
 */
async function readAssetBytes(uri: string): Promise<ArrayBuffer> {
  const isFilePath = uri.startsWith("file://");
  if (Platform.OS !== "web" && isFilePath) {
    try {
      return await new File(uri).arrayBuffer();
    } catch (e) {
      console.log("[media] File API read failed, falling back to fetch:", e);
    }
  }
  const response = await fetch(uri);
  if (!response.ok && response.status !== 0) {
    throw new Error("Impossible de lire le fichier sélectionné.");
  }
  return await response.arrayBuffer();
}

/** Uploads a local asset to the episode-media bucket and returns a public URL. */
export async function uploadToBucket(folder: string, asset: PickedAsset): Promise<string> {
  const ext = asset.type === "video" ? "mp4" : asset.mimeType.includes("png") ? "png" : "jpg";
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const arrayBuffer = await readAssetBytes(asset.uri);
  if (!arrayBuffer || arrayBuffer.byteLength === 0) {
    throw new Error("Le fichier sélectionné est vide.");
  }

  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, arrayBuffer, {
    contentType: asset.mimeType,
    upsert: false,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

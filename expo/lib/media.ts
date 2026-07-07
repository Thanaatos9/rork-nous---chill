import { decode } from "base64-arraybuffer";
import * as FileSystem from "expo-file-system/legacy";
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
 * Pickers return `file://` paths on native, but `data:`/`blob:` URIs on web.
 * `fetch` handles all of these on every platform, so it is the primary path;
 * on native we fall back to the legacy base64 file reader if fetch fails.
 * The new expo-file-system `File` API is deliberately avoided: it throws
 * "invalid path" for non-file URIs and "this.validatePath is not a function"
 * on web.
 */
async function readAssetBytes(uri: string): Promise<ArrayBuffer> {
  try {
    const response = await fetch(uri);
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > 0) return buffer;
    console.log("[media] fetch returned an empty buffer, trying fallback");
  } catch (e) {
    console.log("[media] fetch read failed, trying fallback:", e);
  }

  if (Platform.OS !== "web") {
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return decode(base64);
    } catch (e) {
      console.log("[media] legacy file read failed:", e);
    }
  }

  throw new Error("Impossible de lire le fichier sélectionné. Réessaie avec une autre image.");
}

/**
 * Uploads a local asset trying several folders in order, returning the first
 * public URL that succeeds. The storage RLS policy parses the first path
 * segment as a uuid, so callers provide uuid-prefixed candidate folders.
 */
export async function uploadToBucketWithFallback(folders: string[], asset: PickedAsset): Promise<string> {
  let lastError: unknown = null;
  for (const folder of folders) {
    try {
      return await uploadToBucket(folder, asset);
    } catch (e) {
      console.log(`[media] upload to "${folder}" failed:`, e);
      lastError = e;
    }
  }
  throw lastError ?? new Error("Aucun dossier de destination valide pour l'envoi.");
}

/**
 * Uploads a local asset to the episode-media bucket and returns a public URL.
 * IMPORTANT: the storage security policy expects the FIRST folder of the path
 * to be a uuid (the space id, or the user id). Passing a plain word like
 * "covers" fails with: invalid input syntax for type uuid.
 */
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

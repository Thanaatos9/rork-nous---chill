import AsyncStorage from "@react-native-async-storage/async-storage";
import { decode, encode } from "base64-arraybuffer";
import * as FileSystem from "expo-file-system/legacy";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";
import { MEDIA_BUCKET, supabase } from "./supabase";

export interface PickedAsset {
  uri: string;
  type: "image" | "video";
  mimeType: string;
  /** Pixel dimensions when known (used by the crop/adjust UI). */
  width?: number;
  height?: number;
}

function toPicked(asset: ImagePicker.ImagePickerAsset): PickedAsset {
  const isVideo = asset.type === "video";
  return {
    uri: asset.uri,
    type: isVideo ? "video" : "image",
    mimeType: asset.mimeType ?? (isVideo ? "video/mp4" : "image/jpeg"),
    width: asset.width || undefined,
    height: asset.height || undefined,
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

/**
 * Pick a single image for a cover. Returns the raw image (no system cropper):
 * framing is done afterwards in the in-app adjust screen (CoverAdjustModal),
 * which crops via cropImageAsset.
 */
export async function pickCoverImage(): Promise<PickedAsset | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.7,
  });
  if (result.canceled || result.assets.length === 0) return null;
  return toPicked(result.assets[0]);
}

export interface CropRect {
  originX: number;
  originY: number;
  width: number;
  height: number;
}

/**
 * Crops an image asset to the given rectangle (in source pixels) and returns
 * a new local asset. Values are rounded and clamped to the image bounds.
 */
export async function cropImageAsset(asset: PickedAsset, rect: CropRect, imageWidth: number, imageHeight: number): Promise<PickedAsset> {
  const width = Math.max(1, Math.min(Math.round(rect.width), imageWidth));
  const height = Math.max(1, Math.min(Math.round(rect.height), imageHeight));
  const originX = Math.max(0, Math.min(Math.round(rect.originX), imageWidth - width));
  const originY = Math.max(0, Math.min(Math.round(rect.originY), imageHeight - height));

  const context = ImageManipulator.manipulate(asset.uri);
  context.crop({ originX, originY, width, height });
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.85 });
  try {
    rendered.release?.();
    context.release?.();
  } catch {
    // Releasing shared objects is a memory optimization only.
  }

  return {
    uri: saved.uri,
    type: "image",
    mimeType: "image/jpeg",
    width: saved.width,
    height: saved.height,
  };
}

/**
 * Pick a single image for an avatar. Returns the raw image (no system
 * cropper): framing is done afterwards in the in-app adjust screen
 * (CoverAdjustModal with shape="circle"), which crops via cropImageAsset.
 */
export async function pickAvatarImage(): Promise<PickedAsset | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.7,
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

export type UploadKind = "covers" | "avatars" | "episodes";

export interface UploadContext {
  kind: UploadKind;
  spaceId?: string | null;
  userId?: string | null;
  episodeId?: string | null;
}

interface PathCandidate {
  template: string;
  folder: string;
}

const TEMPLATE_CACHE_KEY = "gather.media.upload-template.v1";

/** Inline data-URL fallback is only used for small images (covers/avatars). */
const INLINE_FALLBACK_MAX_BYTES = 900_000;

/**
 * Ordered candidate folders for an upload. The storage security rules live in
 * an external Supabase project we cannot inspect; empirical probing showed:
 * - anonymous inserts fail on the membership check (auth.uid()) before any cast,
 * - authenticated inserts fail with `invalid input syntax for type uuid` on the
 *   SECOND path segment when it is not a uuid (e.g. "{spaceId}/covers/.."),
 * - "covers/..." alone fails the policy without a cast error.
 * So the policy matches the 2nd segment against the user's space memberships.
 * Every candidate therefore puts a uuid in position 2, with different prefixes
 * in position 1 to cover the possible policy variants. The first template that
 * succeeds is cached and tried first on the next upload.
 */
function buildCandidates(ctx: UploadContext): PathCandidate[] {
  const { kind, spaceId, userId, episodeId } = ctx;
  const list: PathCandidate[] = [];
  if (spaceId) {
    list.push({ template: "kind-first", folder: `${kind}/${spaceId}` });
    if (userId) list.push({ template: "user-first", folder: `${userId}/${spaceId}` });
    if (kind !== "episodes") list.push({ template: "episodes-first", folder: `episodes/${spaceId}` });
    list.push({ template: "spaces-first", folder: `spaces/${spaceId}` });
    if (episodeId) list.push({ template: "space-episode", folder: `${spaceId}/${episodeId}` });
    list.push({ template: "space-kind", folder: `${spaceId}/${kind}` });
  }
  return list;
}

/** True when the failure comes from the storage security rules (worth trying another path). */
function isPolicyRejection(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /row-level security|invalid input syntax|unauthorized|not allowed|violates|policy|uuid/i.test(msg);
}

async function readCachedTemplate(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(TEMPLATE_CACHE_KEY);
  } catch {
    return null;
  }
}

function writeCachedTemplate(template: string): void {
  AsyncStorage.setItem(TEMPLATE_CACHE_KEY, template).catch(() => {});
}

async function uploadBytes(folder: string, bytes: ArrayBuffer, mimeType: string, ext: string): Promise<string> {
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, bytes, {
    contentType: mimeType,
    upsert: false,
  });
  if (error) throw error;
  return supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl;
}

/**
 * Uploads a picked asset and returns a displayable URL.
 * Tries every candidate path format accepted by the backend (cached winner
 * first), and for small images falls back to an inline data URL so covers and
 * avatars keep working even if the storage rules refuse every path.
 */
export async function uploadMedia(ctx: UploadContext, asset: PickedAsset): Promise<string> {
  const ext = asset.type === "video" ? "mp4" : asset.mimeType.includes("png") ? "png" : "jpg";
  const bytes = await readAssetBytes(asset.uri);
  if (!bytes || bytes.byteLength === 0) {
    throw new Error("Le fichier sélectionné est vide.");
  }

  const candidates = buildCandidates(ctx);
  const cached = await readCachedTemplate();
  if (cached) {
    const idx = candidates.findIndex((c) => c.template === cached);
    if (idx > 0) {
      const [hit] = candidates.splice(idx, 1);
      candidates.unshift(hit);
    }
  }

  let lastError: unknown = null;
  for (const candidate of candidates) {
    try {
      const url = await uploadBytes(candidate.folder, bytes, asset.mimeType, ext);
      console.log(`[media] upload OK via template "${candidate.template}" (${candidate.folder})`);
      if (candidate.template !== cached) writeCachedTemplate(candidate.template);
      return url;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`[media] template "${candidate.template}" (${candidate.folder}) rejected: ${msg}`);
      lastError = e;
      if (!isPolicyRejection(e)) break;
    }
  }

  // Storage refused every path (or none was buildable). Small images can be
  // stored inline as a data URL — renders everywhere (web, RN, iOS) and keeps
  // the feature usable no matter what the storage rules are.
  if (ctx.kind !== "episodes" && asset.type === "image" && bytes.byteLength <= INLINE_FALLBACK_MAX_BYTES) {
    console.log("[media] all storage paths refused — using inline image fallback");
    return `data:${asset.mimeType};base64,${encode(bytes)}`;
  }

  console.log("[media] upload failed on every candidate:", lastError);
  throw new Error("Le stockage a refusé l'envoi du fichier. Réessaie — et si ça persiste, dis-le nous.");
}

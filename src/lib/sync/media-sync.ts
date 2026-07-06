import { db } from '$lib/db/schema';
import { blobToBase64, base64ToBlob } from '$lib/utils/base64';
import { mediaList, mediaUpload, mediaGet } from './content-client';

// Defensive cap: the attach pipeline already limits photos (compressPhoto)
// and videos (5MB), so this only guards legacy oversized blobs. Base64
// inflates x1.33 and Apps Script bodies cap around 50MB.
export const MAX_SYNC_BYTES = 20 * 1024 * 1024;

export function diffMedia(
  referenced: string[], localIds: string[], serverIds: string[],
): { upload: string[]; download: string[] } {
  const local = new Set(localIds);
  const server = new Set(serverIds);
  return {
    upload: referenced.filter((id) => local.has(id) && !server.has(id)),
    download: referenced.filter((id) => !local.has(id) && server.has(id)),
  };
}

export async function syncMedia(referenced: string[], url: string, secret: string): Promise<void> {
  const serverIds = await mediaList(url, secret);
  const localIds = (await db.media.toCollection().primaryKeys()) as string[];
  const { upload, download } = diffMedia(referenced, localIds, serverIds);

  for (const id of upload) {
    const m = await db.media.get(id);
    if (!m || m.size_bytes > MAX_SYNC_BYTES) continue;
    await mediaUpload(url, secret, id, m.mime, await blobToBase64(m.blob));
  }

  for (const id of download) {
    const got = await mediaGet(url, secret, id);
    if (!got) continue;
    const blob = base64ToBlob(got.data, got.mime);
    await db.media.add({
      id,
      type: got.mime.startsWith('video/') ? 'video' : 'photo',
      blob,
      thumbnail_blob: null, // matches the attach path, which stores none for photos
      mime: got.mime,
      size_bytes: blob.size,
      created_at: new Date().toISOString(),
    });
  }
}

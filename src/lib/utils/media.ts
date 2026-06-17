export const MAX_PHOTO_DIM = 1600;
export const PHOTO_QUALITY = 0.82;
export const MAX_VIDEO_BYTES = 5 * 1024 * 1024;
export const VIDEO_MIME_PREFIX = 'video/';

export function photoMimeOK(mime: string): boolean {
  return mime === 'image/jpeg' || mime === 'image/png' || mime === 'image/webp';
}

export interface ValidationResult {
  ok: boolean;
  reason?: string;
}

export function validateVideo(file: File): ValidationResult {
  if (!file.type.startsWith(VIDEO_MIME_PREFIX)) {
    return { ok: false, reason: `Unsupported mime: ${file.type}` };
  }
  if (file.size > MAX_VIDEO_BYTES) {
    return { ok: false, reason: `Video size ${(file.size / 1024 / 1024).toFixed(1)}MB exceeds 5MB limit` };
  }
  return { ok: true };
}

export async function compressPhoto(file: File): Promise<{ blob: Blob; mime: string; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const ratio = Math.min(1, MAX_PHOTO_DIM / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * ratio);
  const height = Math.round(bitmap.height * ratio);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, width, height);

  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('toBlob failed'))),
      'image/jpeg',
      PHOTO_QUALITY,
    ),
  );
  return { blob, mime: 'image/jpeg', width, height };
}

export async function videoThumbnail(file: File): Promise<Blob | null> {
  if (!file.type.startsWith('video/')) return null;
  const video = document.createElement('video');
  video.src = URL.createObjectURL(file);
  video.muted = true;
  await video.play().catch(() => undefined);
  await new Promise((r) => setTimeout(r, 250));
  video.pause();
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth || 320;
  canvas.height = video.videoHeight || 240;
  canvas.getContext('2d')!.drawImage(video, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(video.src);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.75));
}

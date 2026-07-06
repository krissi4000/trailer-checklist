import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '$lib/db/schema';
import { diffMedia, syncMedia, MAX_SYNC_BYTES } from '$lib/sync/media-sync';
import { mediaList, mediaUpload, mediaGet } from '$lib/sync/content-client';
import { blobToBase64 } from '$lib/utils/base64';

vi.mock('$lib/sync/content-client', () => ({
  mediaList: vi.fn(),
  mediaUpload: vi.fn(),
  mediaGet: vi.fn(),
}));

const URL_ = 'https://example.test/exec';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('diffMedia (pure)', () => {
  it('uploads local-not-server, downloads server-not-local, referenced only', () => {
    const d = diffMedia(['a', 'b', 'c'], ['a', 'x'], ['b', 'x']);
    expect(d.upload).toEqual(['a']); // referenced, local, not on server
    expect(d.download).toEqual(['b']); // referenced, on server, not local
    // 'c' is referenced but nowhere: unreachable, ignored. 'x' is unreferenced: ignored.
  });
});

describe('syncMedia', () => {
  async function putLocalMedia(id: string, bytes: Uint8Array) {
    await db.media.add({
      id, type: 'photo', blob: new Blob([bytes.buffer as ArrayBuffer], { type: 'image/jpeg' }),
      thumbnail_blob: null, mime: 'image/jpeg', size_bytes: bytes.length,
      created_at: '2026-07-06T00:00:00Z',
    });
  }

  it('uploads referenced local blobs the server lacks', async () => {
    await putLocalMedia('m1', new Uint8Array([1, 2, 3]));
    vi.mocked(mediaList).mockResolvedValue([]);
    await syncMedia(['m1'], URL_, 's');
    expect(mediaUpload).toHaveBeenCalledWith(URL_, 's', 'm1', 'image/jpeg', expect.any(String));
    expect(mediaGet).not.toHaveBeenCalled();
  });

  it('downloads referenced server blobs the device lacks and stores them', async () => {
    vi.mocked(mediaList).mockResolvedValue(['m2']);
    vi.mocked(mediaGet).mockResolvedValue({
      mime: 'image/jpeg',
      data: await blobToBase64(new Blob([new Uint8Array([9, 8, 7])])),
    });
    await syncMedia(['m2'], URL_, 's');
    const stored = await db.media.get('m2');
    expect(stored?.type).toBe('photo');
    expect(stored?.mime).toBe('image/jpeg');
    expect(stored?.thumbnail_blob).toBeNull();
    expect(new Uint8Array(await stored!.blob.arrayBuffer())).toEqual(new Uint8Array([9, 8, 7]));
  });

  it('skips oversized blobs on upload', async () => {
    await db.media.add({
      id: 'big', type: 'video', blob: new Blob([new Uint8Array(10)], { type: 'video/mp4' }),
      thumbnail_blob: null, mime: 'video/mp4',
      size_bytes: MAX_SYNC_BYTES + 1, // size check uses the recorded size
      created_at: '2026-07-06T00:00:00Z',
    });
    vi.mocked(mediaList).mockResolvedValue([]);
    await syncMedia(['big'], URL_, 's');
    expect(mediaUpload).not.toHaveBeenCalled();
  });
});

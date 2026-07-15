import { describe, expect, it } from 'vitest';
import { blobToBase64, base64ToBlob } from '$lib/utils/base64';

describe('base64 blob helpers', () => {
  it('roundtrips binary data and preserves the mime type', async () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255]);
    const blob = new Blob([bytes], { type: 'image/jpeg' });
    const b64 = await blobToBase64(blob);
    const back = base64ToBlob(b64, 'image/jpeg');
    expect(back.type).toBe('image/jpeg');
    expect(new Uint8Array(await back.arrayBuffer())).toEqual(bytes);
  });

  it('handles blobs larger than the chunk size', async () => {
    const big = new Uint8Array(100_000).map((_, i) => i % 256);
    const back = base64ToBlob(await blobToBase64(new Blob([big])), 'application/octet-stream');
    expect(new Uint8Array(await back.arrayBuffer())).toEqual(big);
  });
});

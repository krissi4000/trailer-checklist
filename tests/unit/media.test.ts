import { describe, expect, it } from 'vitest';
import { validateVideo, photoMimeOK } from '$lib/utils/media';

describe('media validation', () => {
  it('photoMimeOK accepts common image types', () => {
    expect(photoMimeOK('image/jpeg')).toBe(true);
    expect(photoMimeOK('image/png')).toBe(true);
    expect(photoMimeOK('image/webp')).toBe(true);
    expect(photoMimeOK('video/mp4')).toBe(false);
  });

  it('validateVideo warns when too large', () => {
    const sixMB = 6 * 1024 * 1024;
    const result = validateVideo({ size: sixMB, type: 'video/mp4' } as File);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/size/i);
  });

  it('validateVideo accepts small mp4', () => {
    const r = validateVideo({ size: 2 * 1024 * 1024, type: 'video/mp4' } as File);
    expect(r.ok).toBe(true);
  });

  it('validateVideo rejects non-video mime', () => {
    const r = validateVideo({ size: 100, type: 'application/pdf' } as File);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/mime/i);
  });
});

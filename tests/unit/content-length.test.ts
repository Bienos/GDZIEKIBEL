import { describe, expect, it } from 'vitest';
import { exceedsMaxRequestBodyBytes, MAX_REQUEST_BODY_BYTES } from '@/lib/http/content-length';

function requestWithContentLength(value: string | null): Request {
  const headers: Record<string, string> = value === null ? {} : { 'content-length': value };
  return new Request('https://example.com', { headers });
}

describe('exceedsMaxRequestBodyBytes', () => {
  it('is false for a body well under the limit', () => {
    expect(exceedsMaxRequestBodyBytes(requestWithContentLength('100'))).toBe(false);
  });

  it('is false for a body exactly at the limit', () => {
    expect(
      exceedsMaxRequestBodyBytes(requestWithContentLength(String(MAX_REQUEST_BODY_BYTES))),
    ).toBe(false);
  });

  it('is true for a body one byte over the limit', () => {
    expect(
      exceedsMaxRequestBodyBytes(requestWithContentLength(String(MAX_REQUEST_BODY_BYTES + 1))),
    ).toBe(true);
  });

  it('is true for a clearly oversized body', () => {
    expect(exceedsMaxRequestBodyBytes(requestWithContentLength('50000000'))).toBe(true);
  });

  it('is false when content-length is absent — a fast-path guard, not a guarantee', () => {
    expect(exceedsMaxRequestBodyBytes(requestWithContentLength(null))).toBe(false);
  });

  it('respects a caller-supplied limit override', () => {
    expect(exceedsMaxRequestBodyBytes(requestWithContentLength('500'), 100)).toBe(true);
  });
});

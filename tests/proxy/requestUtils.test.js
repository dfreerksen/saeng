import { describe, it, expect } from 'vitest';
import { applyHeaderOverrides, rewritePath } from '../../src/proxy/requestUtils.js';

describe('applyHeaderOverrides()', () => {
  it('sets a new header when it does not already exist', () => {
    const headers = {};
    const result = applyHeaderOverrides(headers, [{ name: 'X-Custom', value: 'yes' }]);
    expect(result['x-custom']).toBe('yes');
  });

  it('lowercases the header name', () => {
    const headers = {};
    applyHeaderOverrides(headers, [{ name: 'Content-Type', value: 'text/plain' }]);
    expect(headers['content-type']).toBe('text/plain');
    expect(headers['Content-Type']).toBeUndefined();
  });

  it('replaces an existing header rather than duplicating it', () => {
    const headers = { 'content-type': 'application/json' };
    applyHeaderOverrides(headers, [{ name: 'Content-Type', value: 'text/plain' }]);
    expect(headers['content-type']).toBe('text/plain');
    expect(Object.keys(headers)).toHaveLength(1);
  });

  it('applies multiple overrides in array order', () => {
    const headers = {};
    applyHeaderOverrides(headers, [
      { name: 'X-One', value: '1' },
      { name: 'X-Two', value: '2' },
    ]);
    expect(headers['x-one']).toBe('1');
    expect(headers['x-two']).toBe('2');
  });

  it('skips entries with an empty/falsy name', () => {
    const headers = {};
    applyHeaderOverrides(headers, [{ name: '', value: 'ignored' }]);
    expect(headers).toEqual({});
  });

  it('returns the same headers object it was given', () => {
    const headers = {};
    const result = applyHeaderOverrides(headers, []);
    expect(result).toBe(headers);
  });

  it('is a no-op when overrides is not an array', () => {
    const headers = { existing: 'value' };
    expect(applyHeaderOverrides(headers, undefined)).toEqual({ existing: 'value' });
    expect(applyHeaderOverrides(headers, null)).toEqual({ existing: 'value' });
  });

  it('leaves headers untouched for an empty overrides array', () => {
    const headers = { existing: 'value' };
    applyHeaderOverrides(headers, []);
    expect(headers).toEqual({ existing: 'value' });
  });
});

describe('rewritePath()', () => {
  it('returns the path unchanged when pathRewriteFrom is unset', () => {
    expect(rewritePath({ pathRewriteFrom: '', pathRewriteTo: '/v2' }, '/api/users')).toBe('/api/users');
  });

  it('rewrites an exact match of pathRewriteFrom', () => {
    const mapping = { pathRewriteFrom: '/api', pathRewriteTo: '/v2' };
    expect(rewritePath(mapping, '/api')).toBe('/v2');
  });

  it('rewrites a matched prefix followed by a slash', () => {
    const mapping = { pathRewriteFrom: '/api', pathRewriteTo: '/v2' };
    expect(rewritePath(mapping, '/api/users')).toBe('/v2/users');
  });

  it('does not match a prefix that merely starts with the same characters', () => {
    const mapping = { pathRewriteFrom: '/api', pathRewriteTo: '/v2' };
    expect(rewritePath(mapping, '/apiextra')).toBe('/apiextra');
  });

  it('preserves the query string on a rewritten path', () => {
    const mapping = { pathRewriteFrom: '/api', pathRewriteTo: '/v2' };
    expect(rewritePath(mapping, '/api/users?page=2')).toBe('/v2/users?page=2');
  });

  it('preserves the query string on a non-matching path', () => {
    const mapping = { pathRewriteFrom: '/api', pathRewriteTo: '/v2' };
    expect(rewritePath(mapping, '/other?page=2')).toBe('/other?page=2');
  });

  it('falls back to "/" when the rewritten path would be empty', () => {
    const mapping = { pathRewriteFrom: '/api', pathRewriteTo: '' };
    expect(rewritePath(mapping, '/api')).toBe('/');
  });

  it('treats a missing pathRewriteTo as an empty prefix', () => {
    const mapping = { pathRewriteFrom: '/api' };
    expect(rewritePath(mapping, '/api/users')).toBe('/users');
  });

  it('defaults a nullish pathWithQuery to "/" before matching', () => {
    const mapping = { pathRewriteFrom: '/', pathRewriteTo: '/v2' };
    expect(rewritePath(mapping, null)).toBe('/v2');
  });
});

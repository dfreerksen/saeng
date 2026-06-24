import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderMockTemplate } from '../../src/proxy/mockTemplate.js';

describe('renderMockTemplate()', () => {
  it('returns the template unchanged when it contains no placeholders', () => {
    expect(renderMockTemplate('plain text', {})).toBe('plain text');
  });

  it('returns empty string for empty or falsy templates', () => {
    expect(renderMockTemplate('', {})).toBe('');
    expect(renderMockTemplate(null, {})).toBeNull();
    expect(renderMockTemplate(undefined, {})).toBeUndefined();
  });

  it('leaves unknown placeholders intact', () => {
    expect(renderMockTemplate('{{unknown.thing}}', {})).toBe('{{unknown.thing}}');
  });

  describe('generated values', () => {
    beforeEach(() => vi.useFakeTimers({ now: new Date('2026-01-15T12:00:00.000Z') }));
    afterEach(() => vi.useRealTimers());

    it('replaces {{timestamp}} with the current Unix time in milliseconds', () => {
      const result = renderMockTemplate('ts={{timestamp}}', {});
      expect(result).toBe(`ts=${Date.now()}`);
    });

    it('replaces {{isoDate}} with the current ISO date string', () => {
      const result = renderMockTemplate('date={{isoDate}}', {});
      expect(result).toBe('date=2026-01-15T12:00:00.000Z');
    });

    it('replaces {{uuid}} with a valid UUID v4', () => {
      const result = renderMockTemplate('id={{uuid}}', {});
      const uuid = result.slice(3);
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it('generates a unique UUID for each placeholder occurrence', () => {
      const result = renderMockTemplate('{{uuid}},{{uuid}}', {});
      const [a, b] = result.split(',');
      expect(a).not.toBe(b);
    });
  });

  describe('request values', () => {
    const context = {
      method: 'POST',
      path: '/api/users',
      url: '/api/users?page=2',
      body: '{"name":"Alice"}',
      host: 'myapp.local',
      headers: { 'content-type': 'application/json', 'x-request-id': 'abc123' },
      match: [],
    };

    it('replaces {{request.method}}', () => {
      expect(renderMockTemplate('{{request.method}}', context)).toBe('POST');
    });

    it('replaces {{request.path}}', () => {
      expect(renderMockTemplate('{{request.path}}', context)).toBe('/api/users');
    });

    it('replaces {{request.url}} (includes query string)', () => {
      expect(renderMockTemplate('{{request.url}}', context)).toBe('/api/users?page=2');
    });

    it('replaces {{request.body}}', () => {
      expect(renderMockTemplate('{{request.body}}', context)).toBe('{"name":"Alice"}');
    });

    it('replaces {{request.host}}', () => {
      expect(renderMockTemplate('{{request.host}}', context)).toBe('myapp.local');
    });

    it('replaces {{request.header.X-Request-Id}} (case-insensitive lookup)', () => {
      expect(renderMockTemplate('{{request.header.X-Request-Id}}', context)).toBe('abc123');
      expect(renderMockTemplate('{{request.header.x-request-id}}', context)).toBe('abc123');
    });

    it('returns empty string for a missing request header', () => {
      expect(renderMockTemplate('{{request.header.X-Missing}}', context)).toBe('');
    });

    it('returns empty string for request fields when context is empty', () => {
      expect(renderMockTemplate('{{request.method}}', {})).toBe('');
      expect(renderMockTemplate('{{request.body}}', {})).toBe('');
      expect(renderMockTemplate('{{request.host}}', {})).toBe('');
    });
  });

  describe('regex match groups', () => {
    it('replaces {{match.0}} with the full regex match', () => {
      const context = { match: ['/api/users/42', '42'] };
      expect(renderMockTemplate('{{match.0}}', context)).toBe('/api/users/42');
    });

    it('replaces {{match.1}} with the first capture group', () => {
      const context = { match: ['/api/users/42', '42'] };
      expect(renderMockTemplate('id={{match.1}}', context)).toBe('id=42');
    });

    it('replaces multiple capture groups', () => {
      const context = { match: ['/api/users/42/posts/7', '42', '7'] };
      expect(renderMockTemplate('user={{match.1}},post={{match.2}}', context))
        .toBe('user=42,post=7');
    });

    it('returns empty string for an out-of-range group index', () => {
      const context = { match: ['/api'] };
      expect(renderMockTemplate('{{match.5}}', context)).toBe('');
    });

    it('returns empty string when no match is available', () => {
      expect(renderMockTemplate('{{match.0}}', {})).toBe('');
    });

    it('returns empty string for a non-numeric match index', () => {
      const context = { match: ['/api'] };
      expect(renderMockTemplate('{{match.abc}}', context)).toBe('');
    });

    it('returns empty string for a negative match index', () => {
      const context = { match: ['/api', '42'] };
      expect(renderMockTemplate('{{match.-1}}', context)).toBe('');
    });

    it('returns empty string for a non-participating capture group', () => {
      const context = { match: ['/api/foo', undefined] };
      expect(renderMockTemplate('{{match.1}}', context)).toBe('');
    });
  });

  describe('mixed placeholders', () => {
    it('interpolates multiple different placeholder types in one template', () => {
      const context = {
        method: 'GET',
        path: '/api/echo',
        url: '/api/echo',
        body: '',
        host: 'echo.local',
        headers: {},
        match: ['/api/echo'],
      };
      const template = '{"method":"{{request.method}}","path":"{{match.0}}","host":"{{request.host}}"}';
      const result = renderMockTemplate(template, context);
      expect(result).toBe('{"method":"GET","path":"/api/echo","host":"echo.local"}');
    });

    it('handles whitespace inside braces gracefully', () => {
      const context = { method: 'GET' };
      expect(renderMockTemplate('{{ request.method }}', context)).toBe('GET');
    });

    it('leaves unclosed {{ intact', () => {
      expect(renderMockTemplate('prefix {{request.method', { method: 'GET' })).toBe('prefix {{request.method');
    });

    it('leaves empty braces {{}} intact', () => {
      expect(renderMockTemplate('before {{}} after', {})).toBe('before {{}} after');
    });

    it('interpolates consecutive placeholders with no separator', () => {
      const context = { method: 'GET', host: 'app.local' };
      expect(renderMockTemplate('{{request.method}}{{request.host}}', context)).toBe('GETapp.local');
    });

    it('treats placeholders as case-insensitive', () => {
      const context = {
        method: 'POST',
        body: 'data',
        host: 'myapp.local',
        headers: { 'x-id': '99' },
        match: ['/full', '42'],
      };
      expect(renderMockTemplate('{{UUID}}', context)).toMatch(/^[0-9a-f-]+$/);
      expect(renderMockTemplate('{{Request.Method}}', context)).toBe('POST');
      expect(renderMockTemplate('{{REQUEST.BODY}}', context)).toBe('data');
      expect(renderMockTemplate('{{Request.Host}}', context)).toBe('myapp.local');
      expect(renderMockTemplate('{{Request.Header.X-Id}}', context)).toBe('99');
      expect(renderMockTemplate('{{MATCH.1}}', context)).toBe('42');
      expect(renderMockTemplate('{{IsoDate}}', context)).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(renderMockTemplate('{{TIMESTAMP}}', context)).toMatch(/^\d+$/);
    });
  });
});

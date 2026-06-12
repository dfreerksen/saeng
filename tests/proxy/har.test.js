import { describe, it, expect } from 'vitest';
import { buildHar } from '../../src/proxy/har.js';

const BASE_ENTRY = {
  id: 1,
  timestamp: 1700000000000,
  method: 'GET',
  hostname: 'myapp.local',
  path: '/users?page=2',
  https: false,
  status: 200,
  latencyMs: 42,
  error: null,
};

describe('buildHar()', () => {
  it('produces a HAR 1.2 document with a creator and one entry per log entry', () => {
    const har = buildHar([BASE_ENTRY], '1.2.3');
    expect(har.log.version).toBe('1.2');
    expect(har.log.creator).toEqual({ name: 'Saeng', version: '1.2.3' });
    expect(har.log.entries).toHaveLength(1);
  });

  it('builds the request URL from https, hostname, and path', () => {
    const har = buildHar([{ ...BASE_ENTRY, https: true, hostname: 'api.myapp.local', path: '/v1/things' }], '1.0.0');
    expect(har.log.entries[0].request.url).toBe('https://api.myapp.local/v1/things');
  });

  it('extracts the query string into request.queryString', () => {
    const har = buildHar([BASE_ENTRY], '1.0.0');
    expect(har.log.entries[0].request.queryString).toEqual([{ name: 'page', value: '2' }]);
  });

  it('maps method, status, startedDateTime, and timings from the log entry', () => {
    const har = buildHar([BASE_ENTRY], '1.0.0');
    const entry = har.log.entries[0];
    expect(entry.request.method).toBe('GET');
    expect(entry.response.status).toBe(200);
    expect(entry.startedDateTime).toBe(new Date(BASE_ENTRY.timestamp).toISOString());
    expect(entry.time).toBe(42);
    expect(entry.timings.wait).toBe(42);
  });

  it('uses status 0 and time 0 when the entry has no status/latency yet', () => {
    const har = buildHar([{ ...BASE_ENTRY, status: null, latencyMs: null }], '1.0.0');
    const entry = har.log.entries[0];
    expect(entry.response.status).toBe(0);
    expect(entry.time).toBe(0);
  });

  it('converts header objects into HAR header arrays, splitting array values', () => {
    const har = buildHar([{
      ...BASE_ENTRY,
      requestHeaders: { host: 'myapp.local', 'content-type': 'application/json' },
      responseHeaders: { 'set-cookie': ['a=1', 'b=2'] },
    }], '1.0.0');
    const { request, response } = har.log.entries[0];
    expect(request.headers).toEqual(
      expect.arrayContaining([
        { name: 'host', value: 'myapp.local' },
        { name: 'content-type', value: 'application/json' },
      ])
    );
    expect(response.headers).toEqual([
      { name: 'set-cookie', value: 'a=1' },
      { name: 'set-cookie', value: 'b=2' },
    ]);
  });

  it('includes postData and request bodySize when a request body was captured', () => {
    const har = buildHar([{
      ...BASE_ENTRY,
      requestHeaders: { 'content-type': 'application/json' },
      requestBody: '{"a":1}',
    }], '1.0.0');
    const { request } = har.log.entries[0];
    expect(request.postData).toEqual({ mimeType: 'application/json', text: '{"a":1}' });
    expect(request.bodySize).toBe(Buffer.byteLength('{"a":1}', 'utf8'));
  });

  it('omits postData and reports bodySize -1 when no request body was captured', () => {
    const har = buildHar([BASE_ENTRY], '1.0.0');
    const { request } = har.log.entries[0];
    expect(request.postData).toBeUndefined();
    expect(request.bodySize).toBe(-1);
  });

  it('includes response content text and size when a response body was captured', () => {
    const har = buildHar([{
      ...BASE_ENTRY,
      responseHeaders: { 'content-type': 'application/json' },
      responseBody: '{"ok":true}',
    }], '1.0.0');
    const { content, bodySize } = har.log.entries[0].response;
    expect(content).toEqual({
      size: Buffer.byteLength('{"ok":true}', 'utf8'),
      mimeType: 'application/json',
      text: '{"ok":true}',
    });
    expect(bodySize).toBe(Buffer.byteLength('{"ok":true}', 'utf8'));
  });

  it('defaults response mimeType to x-unknown and size 0 when no body was captured', () => {
    const har = buildHar([BASE_ENTRY], '1.0.0');
    const { content, bodySize } = har.log.entries[0].response;
    expect(content).toEqual({ size: 0, mimeType: 'x-unknown' });
    expect(bodySize).toBe(-1);
  });

  it('includes a comment with the proxy error message when present', () => {
    const har = buildHar([{ ...BASE_ENTRY, error: 'connect ECONNREFUSED 127.0.0.1:3000' }], '1.0.0');
    expect(har.log.entries[0].comment).toBe('connect ECONNREFUSED 127.0.0.1:3000');
  });

  it('omits comment when there is no error', () => {
    const har = buildHar([BASE_ENTRY], '1.0.0');
    expect(har.log.entries[0].comment).toBeUndefined();
  });

  it('includes _mocked: true when the entry was served from a mock', () => {
    const har = buildHar([{ ...BASE_ENTRY, mocked: true }], '1.0.0');
    expect(har.log.entries[0]._mocked).toBe(true);
  });

  it('omits _mocked when the entry was not mocked', () => {
    const har = buildHar([{ ...BASE_ENTRY, mocked: false }], '1.0.0');
    expect(har.log.entries[0]._mocked).toBeUndefined();
  });
});

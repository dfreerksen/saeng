import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import { serveMock } from '../../src/proxy/mockResponder.js';

function makeReq({ method = 'GET', url = '/api', headers = {} } = {}) {
  const req = new EventEmitter();
  req.method = method;
  req.url = url;
  req.headers = headers;
  return req;
}

function makeRes() {
  return { writeHead: vi.fn(), end: vi.fn() };
}

function endRequestBody(req, body = '') {
  if (body) req.emit('data', Buffer.from(body));
  req.emit('end');
}

describe('serveMock() — basic response', () => {
  it('writes the mock status code and body', () => {
    const req = makeReq();
    const res = makeRes();
    serveMock({ statusCode: 201, body: 'hello', headers: [] }, req, res, null, null, null);
    endRequestBody(req);
    expect(res.writeHead).toHaveBeenCalledWith(201, expect.objectContaining({ 'x-saeng-mock': 'true' }));
    expect(res.end).toHaveBeenCalledWith('hello');
  });

  it('reads the request body from the stream when bufferedBody is not provided', () => {
    const req = makeReq();
    const res = makeRes();
    serveMock({ statusCode: 200, body: '{{request.body}}', headers: [] }, req, res, null, null, null);
    endRequestBody(req, 'the-body');
    expect(res.end).toHaveBeenCalledWith('the-body');
  });

  it('uses bufferedBody instead of reading the request stream when provided', () => {
    const req = makeReq();
    const res = makeRes();
    serveMock({ statusCode: 200, body: '{{request.body}}', headers: [] }, req, res, null, null, null, Buffer.from('buffered'));
    expect(res.end).toHaveBeenCalledWith('buffered');
  });

  it('does not listen on the request stream when bufferedBody is provided', () => {
    const req = makeReq();
    const onSpy = vi.spyOn(req, 'on');
    const res = makeRes();
    serveMock({ statusCode: 200, body: 'x', headers: [] }, req, res, null, null, null, Buffer.from('buffered'));
    expect(onSpy).not.toHaveBeenCalled();
  });
});

describe('serveMock() — headers', () => {
  it('defaults content-type to text/plain when the mock does not set one', () => {
    const req = makeReq();
    const res = makeRes();
    serveMock({ statusCode: 200, body: 'x', headers: [] }, req, res, null, null, null);
    endRequestBody(req);
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({ 'content-type': 'text/plain; charset=utf-8' }));
  });

  it('honors a content-type set via mock.headers', () => {
    const req = makeReq();
    const res = makeRes();
    serveMock({ statusCode: 200, body: '{}', headers: [{ name: 'Content-Type', value: 'application/json' }] }, req, res, null, null, null);
    endRequestBody(req);
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({ 'content-type': 'application/json' }));
  });

  it('applies arbitrary mock headers', () => {
    const req = makeReq();
    const res = makeRes();
    serveMock({ statusCode: 200, body: 'x', headers: [{ name: 'X-Custom', value: 'yes' }] }, req, res, null, null, null);
    endRequestBody(req);
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({ 'x-custom': 'yes' }));
  });

  it('always sets x-saeng-mock to true', () => {
    const req = makeReq();
    const res = makeRes();
    serveMock({ statusCode: 200, body: 'x', headers: [{ name: 'x-saeng-mock', value: 'false' }] }, req, res, null, null, null);
    endRequestBody(req);
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({ 'x-saeng-mock': 'true' }));
  });
});

describe('serveMock() — template rendering', () => {
  it('renders request context variables', () => {
    const req = makeReq({ method: 'POST', url: '/api/users?x=1' });
    const res = makeRes();
    serveMock({ statusCode: 200, body: '{{request.method}} {{request.path}}', headers: [] }, req, res, null, null, null);
    endRequestBody(req);
    expect(res.end).toHaveBeenCalledWith('POST /api/users');
  });

  it('renders regex capture groups from the path match', () => {
    const req = makeReq({ url: '/api/users/42' });
    const res = makeRes();
    const match = '/api/users/42'.match(/^\/api\/users\/(\d+)$/);
    serveMock({ statusCode: 200, body: 'id={{match.1}}', headers: [] }, req, res, null, match, null);
    endRequestBody(req);
    expect(res.end).toHaveBeenCalledWith('id=42');
  });

  it('treats an empty mock body as an empty string', () => {
    const req = makeReq();
    const res = makeRes();
    serveMock({ statusCode: 204, headers: [] }, req, res, null, null, null);
    endRequestBody(req);
    expect(res.end).toHaveBeenCalledWith('');
  });
});

describe('serveMock() — delay', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('responds immediately when delayMs is 0', () => {
    const req = makeReq();
    const res = makeRes();
    serveMock({ statusCode: 200, body: 'x', headers: [], delayMs: 0 }, req, res, null, null, null);
    endRequestBody(req);
    expect(res.end).toHaveBeenCalled();
  });

  it('delays the response by delayMs when set', () => {
    const req = makeReq();
    const res = makeRes();
    serveMock({ statusCode: 200, body: 'x', headers: [], delayMs: 500 }, req, res, null, null, null);
    endRequestBody(req);
    expect(res.end).not.toHaveBeenCalled();
    vi.advanceTimersByTime(499);
    expect(res.end).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(res.end).toHaveBeenCalledWith('x');
  });
});

describe('serveMock() — request log recording', () => {
  it('marks the record as mocked', () => {
    const req = makeReq();
    const res = makeRes();
    const record = {};
    serveMock({ statusCode: 200, body: 'x', headers: [] }, req, res, record, null, null);
    endRequestBody(req);
    expect(record.mocked).toBe(true);
  });

  it('does not throw when record is null', () => {
    const req = makeReq();
    const res = makeRes();
    expect(() => {
      serveMock({ statusCode: 200, body: 'x', headers: [] }, req, res, null, null, null);
      endRequestBody(req);
    }).not.toThrow();
  });

  it('records responseHeaders only when requestLog.logHeaders is true', () => {
    const req = makeReq();
    const res = makeRes();
    const record = {};
    serveMock({ statusCode: 200, body: 'x', headers: [] }, req, res, record, null, { logHeaders: true });
    endRequestBody(req);
    expect(record.responseHeaders).toEqual(expect.objectContaining({ 'x-saeng-mock': 'true' }));
  });

  it('does not record responseHeaders when requestLog.logHeaders is false', () => {
    const req = makeReq();
    const res = makeRes();
    const record = {};
    serveMock({ statusCode: 200, body: 'x', headers: [] }, req, res, record, null, { logHeaders: false });
    endRequestBody(req);
    expect(record.responseHeaders).toBeUndefined();
  });

  it('records responseBody and responseBodyTruncated=false when requestLog.logBody is true', () => {
    const req = makeReq();
    const res = makeRes();
    const record = {};
    serveMock({ statusCode: 200, body: 'hello', headers: [] }, req, res, record, null, { logBody: true });
    endRequestBody(req);
    expect(record.responseBody).toBe('hello');
    expect(record.responseBodyTruncated).toBe(false);
  });

  it('does not record responseBody when requestLog.logBody is false', () => {
    const req = makeReq();
    const res = makeRes();
    const record = {};
    serveMock({ statusCode: 200, body: 'hello', headers: [] }, req, res, record, null, { logBody: false });
    endRequestBody(req);
    expect(record.responseBody).toBeUndefined();
  });
});

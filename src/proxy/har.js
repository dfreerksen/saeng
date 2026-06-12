const HAR_VERSION = '1.2';

// Converts a headers object (string or string[] values, as produced by
// Node's req/res.headers) into the array-of-{name,value} shape HAR expects.
function headerEntries(headers) {
  if (!headers) return [];
  const entries = [];
  for (const [name, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      for (const v of value) entries.push({ name, value: String(v) });
    } else if (value !== undefined) {
      entries.push({ name, value: String(value) });
    }
  }
  return entries;
}

function findHeader(headers, name) {
  if (!headers) return undefined;
  const lower = name.toLowerCase();
  const key = Object.keys(headers).find((k) => k.toLowerCase() === lower);
  if (key === undefined) return undefined;
  const value = headers[key];
  return Array.isArray(value) ? value[0] : value;
}

function buildUrl(entry) {
  const scheme = entry.https ? 'https' : 'http';
  return `${scheme}://${entry.hostname}${entry.path || '/'}`;
}

function queryStringEntries(url) {
  try {
    return [...new URL(url).searchParams].map(([name, value]) => ({ name, value }));
  } catch {
    return [];
  }
}

function buildRequest(entry, url) {
  const request = {
    method: entry.method,
    url,
    httpVersion: 'HTTP/1.1',
    cookies: [],
    headers: headerEntries(entry.requestHeaders),
    queryString: queryStringEntries(url),
    headersSize: -1,
    bodySize: entry.requestBody !== undefined ? Buffer.byteLength(entry.requestBody, 'utf8') : -1,
  };

  if (entry.requestBody !== undefined) {
    request.postData = {
      mimeType: findHeader(entry.requestHeaders, 'content-type') || 'application/octet-stream',
      text: entry.requestBody,
    };
  }

  return request;
}

function buildResponse(entry) {
  const hasBody = entry.responseBody !== undefined;

  return {
    status: entry.status ?? 0,
    statusText: '',
    httpVersion: 'HTTP/1.1',
    cookies: [],
    headers: headerEntries(entry.responseHeaders),
    content: {
      size: hasBody ? Buffer.byteLength(entry.responseBody, 'utf8') : 0,
      mimeType: findHeader(entry.responseHeaders, 'content-type') || 'x-unknown',
      ...(hasBody && { text: entry.responseBody }),
    },
    redirectURL: findHeader(entry.responseHeaders, 'location') || '',
    headersSize: -1,
    bodySize: hasBody ? Buffer.byteLength(entry.responseBody, 'utf8') : -1,
  };
}

function buildEntry(entry) {
  const url = buildUrl(entry);
  const time = entry.latencyMs ?? 0;

  return {
    startedDateTime: new Date(entry.timestamp).toISOString(),
    time,
    request: buildRequest(entry, url),
    response: buildResponse(entry),
    cache: {},
    timings: { send: 0, wait: time, receive: 0 },
    ...(entry.error && { comment: entry.error }),
    ...(entry.mocked && { _mocked: true }),
  };
}

// Builds a HAR 1.2 document (https://w3c.github.io/web-performance/specs/HAR/Overview.html)
// from RequestLog entries, for sharing/debugging proxy traffic with standard tooling.
function buildHar(entries, creatorVersion) {
  return {
    log: {
      version: HAR_VERSION,
      creator: { name: 'Saeng', version: creatorVersion },
      entries: entries.map(buildEntry),
    },
  };
}

export { buildHar };

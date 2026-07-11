import { renderMockTemplate } from './mockTemplate.js';
import { applyHeaderOverrides } from './requestUtils.js';

// Writes a mocked response directly to the client without contacting the
// backend, rendering template variables in the mock body and recording the
// mocked response on `record` (if request logging is enabled).
//
// `bufferedBody`, when provided, is the request body already drained by the
// caller (for mappings with a body condition) — reused here instead of
// re-reading `req`, whose stream has already ended.
export function serveMock(mock, req, res, record, match, requestLog, bufferedBody = null) {
  const respond = (requestBody) => {
    const context = {
      method: req.method,
      path: (req.url || '/').split('?')[0],
      url: req.url || '/',
      body: requestBody,
      host: (req.headers.host || '').split(':')[0],
      headers: req.headers,
      match: match || [],
    };

    const headers = applyHeaderOverrides({}, mock.headers);
    if (!('content-type' in headers)) headers['content-type'] = 'text/plain; charset=utf-8';
    headers['x-saeng-mock'] = 'true';
    const body = renderMockTemplate(mock.body || '', context);

    if (record) {
      record.mocked = true;
      if (requestLog?.logHeaders) record.responseHeaders = { ...headers };
      if (requestLog?.logBody) {
        record.responseBody = body;
        record.responseBodyTruncated = false;
      }
    }

    const sendResponse = () => {
      res.writeHead(mock.statusCode, headers);
      res.end(body);
    };

    if (mock.delayMs > 0) {
      setTimeout(sendResponse, mock.delayMs);
    } else {
      sendResponse();
    }
  };

  if (bufferedBody !== null) {
    respond(bufferedBody.toString('utf8'));
    return;
  }

  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', () => respond(Buffer.concat(chunks).toString('utf8')));
}

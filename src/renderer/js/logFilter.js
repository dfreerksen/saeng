export const FILTER_TABS = ['all', 'http', 'https', 'ws', 'json', 'xhr', 'doc', 'css', 'js', 'font', 'img', 'manifest', 'wasm', 'graphql', 'wml', 'other'];

function getHeader(headers, name) {
  if (!headers) return null;
  const key = name.toLowerCase();
  const found = Object.keys(headers).find((k) => k.toLowerCase() === key);
  if (!found) return null;
  const val = headers[found];
  return Array.isArray(val) ? val[0] : String(val);
}

function hasContentType(headers, substr) {
  return (getHeader(headers, 'content-type') || '').toLowerCase().includes(substr);
}

function pathExt(path, exts) {
  const p = (path || '').split('?')[0].toLowerCase();
  return exts.some((ext) => p.endsWith(ext));
}

export function matchesFilter(entry, filter) {
  switch (filter) {
    case 'all': return true;
    case 'http': return !entry.https;
    case 'https': return !!entry.https;
    case 'ws': return !!entry.websocket;
    case 'json':
      return hasContentType(entry.responseHeaders, 'json') || pathExt(entry.path, ['.json']);
    case 'xhr': {
      const mode = getHeader(entry.requestHeaders, 'sec-fetch-mode');
      const xrw = getHeader(entry.requestHeaders, 'x-requested-with');
      return mode === 'cors' || mode === 'same-origin'
        || (!!xrw && xrw.toLowerCase().includes('xmlhttprequest'));
    }
    case 'doc':
      return hasContentType(entry.responseHeaders, 'text/html') || pathExt(entry.path, ['.html', '.htm']);
    case 'css':
      return hasContentType(entry.responseHeaders, 'text/css') || pathExt(entry.path, ['.css']);
    case 'js':
      return hasContentType(entry.responseHeaders, 'javascript') || pathExt(entry.path, ['.js', '.mjs', '.cjs']);
    case 'font':
      return hasContentType(entry.responseHeaders, 'font/')
        || hasContentType(entry.responseHeaders, 'woff')
        || pathExt(entry.path, ['.woff', '.woff2', '.ttf', '.eot', '.otf']);
    case 'img':
      return hasContentType(entry.responseHeaders, 'image/')
        || pathExt(entry.path, ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.avif', '.bmp']);
    case 'manifest':
      return hasContentType(entry.responseHeaders, 'manifest')
        || pathExt(entry.path, ['.webmanifest'])
        || (entry.path || '').toLowerCase().endsWith('manifest.json');
    case 'wasm':
      return hasContentType(entry.responseHeaders, 'wasm') || pathExt(entry.path, ['.wasm']);
    case 'graphql':
      return (entry.path || '').toLowerCase().includes('graphql');
    case 'wml':
      return hasContentType(entry.responseHeaders, 'wml') || pathExt(entry.path, ['.wml']);
    case 'other': {
      const specific = FILTER_TABS.filter((f) => f !== 'all' && f !== 'other' && f !== 'http' && f !== 'https');
      return !specific.some((f) => matchesFilter(entry, f));
    }
    default: return true;
  }
}

// Applies a mapping's header overrides ({ name, value } pairs) onto a
// headers object, lowercasing names so they replace existing headers
// (which Node always reports with lowercase keys) rather than duplicating.
export function applyHeaderOverrides(headers, overrides) {
  if (Array.isArray(overrides)) {
    for (const { name, value } of overrides) {
      if (name) headers[name.toLowerCase()] = value;
    }
  }
  return headers;
}

// For absolute-form proxy request URLs (http://host/path?q=1), returns just
// the path + query string. Origin-form paths and unparsable URLs are
// returned unchanged.
export function toPathWithQuery(url) {
  if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
    return url;
  }
  try {
    const parsed = new URL(url);
    return parsed.pathname + parsed.search;
  } catch {
    return url;
  }
}

// Rewrites the path portion of `pathWithQuery` by replacing a matched
// mapping.pathRewriteFrom prefix with mapping.pathRewriteTo, preserving
// the query string. Only rewrites on an exact match or a `from + '/'`
// prefix (so `/api` doesn't match `/apiextra`). No-op when
// pathRewriteFrom is empty/unset.
export function rewritePath(mapping, pathWithQuery) {
  const from = mapping.pathRewriteFrom;
  if (!from) return pathWithQuery;

  const input = pathWithQuery || '/';
  const qIndex = input.indexOf('?');
  const pathname = qIndex === -1 ? input : input.slice(0, qIndex);
  const query = qIndex === -1 ? '' : input.slice(qIndex);

  const matches = pathname === from || pathname.startsWith(`${from}/`);
  if (!matches) return pathWithQuery;

  const rest = pathname.slice(from.length);
  const to = mapping.pathRewriteTo || '';
  const rewrittenPathname = `${to}${rest}` || '/';

  return rewrittenPathname + query;
}

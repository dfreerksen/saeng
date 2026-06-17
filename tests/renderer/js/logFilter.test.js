import { describe, it, expect } from 'vitest';
import { FILTER_TABS, matchesFilter } from '../../../src/renderer/js/logFilter.js';

// ── FILTER_TABS ────────────────────────────────────────────────────────────────

describe('FILTER_TABS', () => {
  it('starts with "all" and ends with "other"', () => {
    expect(FILTER_TABS[0]).toBe('all');
    expect(FILTER_TABS[FILTER_TABS.length - 1]).toBe('other');
  });

  it('contains the expected set of filter names', () => {
    expect(FILTER_TABS).toEqual(
      ['all', 'http', 'https', 'ws', 'json', 'xhr', 'doc', 'css', 'js', 'font', 'img', 'manifest', 'wasm', 'graphql', 'wml', 'other'],
    );
  });
});

// ── helpers ────────────────────────────────────────────────────────────────────

function entry(overrides = {}) {
  return {
    path: '/',
    https: false,
    websocket: false,
    requestHeaders: {},
    responseHeaders: {},
    ...overrides,
  };
}

// ── matchesFilter — all / unknown ──────────────────────────────────────────────

describe('matchesFilter() — all', () => {
  it('matches every entry', () => {
    expect(matchesFilter(entry(), 'all')).toBe(true);
    expect(matchesFilter(entry({ https: true }), 'all')).toBe(true);
  });
});

describe('matchesFilter() — unknown filter', () => {
  it('defaults to true for unknown filter values', () => {
    expect(matchesFilter(entry(), 'nonexistent')).toBe(true);
  });
});

// ── matchesFilter — http / https ───────────────────────────────────────────────

describe('matchesFilter() — http', () => {
  it('matches when https is false', () => {
    expect(matchesFilter(entry({ https: false }), 'http')).toBe(true);
  });

  it('does not match when https is true', () => {
    expect(matchesFilter(entry({ https: true }), 'http')).toBe(false);
  });
});

describe('matchesFilter() — https', () => {
  it('matches when https is true', () => {
    expect(matchesFilter(entry({ https: true }), 'https')).toBe(true);
  });

  it('does not match when https is false', () => {
    expect(matchesFilter(entry({ https: false }), 'https')).toBe(false);
  });
});

// ── matchesFilter — ws ─────────────────────────────────────────────────────────

describe('matchesFilter() — ws', () => {
  it('matches WebSocket entries', () => {
    expect(matchesFilter(entry({ websocket: true }), 'ws')).toBe(true);
  });

  it('does not match non-WebSocket entries', () => {
    expect(matchesFilter(entry({ websocket: false }), 'ws')).toBe(false);
  });
});

// ── matchesFilter — json ───────────────────────────────────────────────────────

describe('matchesFilter() — json', () => {
  it('matches via application/json content-type', () => {
    expect(matchesFilter(entry({ responseHeaders: { 'content-type': 'application/json' } }), 'json')).toBe(true);
  });

  it('matches via .json extension', () => {
    expect(matchesFilter(entry({ path: '/data/feed.json' }), 'json')).toBe(true);
  });

  it('does not match unrelated content-type', () => {
    expect(matchesFilter(entry({ responseHeaders: { 'content-type': 'text/html' } }), 'json')).toBe(false);
  });

  it('ignores query string when matching by extension', () => {
    expect(matchesFilter(entry({ path: '/data.json?v=1' }), 'json')).toBe(true);
  });
});

// ── matchesFilter — xhr ────────────────────────────────────────────────────────

describe('matchesFilter() — xhr', () => {
  it('matches sec-fetch-mode: cors', () => {
    expect(matchesFilter(entry({ requestHeaders: { 'sec-fetch-mode': 'cors' } }), 'xhr')).toBe(true);
  });

  it('matches sec-fetch-mode: same-origin', () => {
    expect(matchesFilter(entry({ requestHeaders: { 'sec-fetch-mode': 'same-origin' } }), 'xhr')).toBe(true);
  });

  it('does not match sec-fetch-mode: no-cors (subresource loads via HTML elements)', () => {
    expect(matchesFilter(entry({ requestHeaders: { 'sec-fetch-mode': 'no-cors' } }), 'xhr')).toBe(false);
  });

  it('matches x-requested-with: XMLHttpRequest (case-insensitive)', () => {
    expect(matchesFilter(entry({ requestHeaders: { 'x-requested-with': 'XMLHttpRequest' } }), 'xhr')).toBe(true);
    expect(matchesFilter(entry({ requestHeaders: { 'x-requested-with': 'xmlhttprequest' } }), 'xhr')).toBe(true);
  });

  it('does not match navigate fetch mode', () => {
    expect(matchesFilter(entry({ requestHeaders: { 'sec-fetch-mode': 'navigate' } }), 'xhr')).toBe(false);
  });

  it('does not match when no relevant headers are present', () => {
    expect(matchesFilter(entry(), 'xhr')).toBe(false);
  });
});

// ── matchesFilter — doc ────────────────────────────────────────────────────────

describe('matchesFilter() — doc', () => {
  it('matches text/html content-type', () => {
    expect(matchesFilter(entry({ responseHeaders: { 'content-type': 'text/html; charset=utf-8' } }), 'doc')).toBe(true);
  });

  it('matches .html extension', () => {
    expect(matchesFilter(entry({ path: '/index.html' }), 'doc')).toBe(true);
  });

  it('matches .htm extension', () => {
    expect(matchesFilter(entry({ path: '/page.htm' }), 'doc')).toBe(true);
  });

  it('does not match non-HTML entries', () => {
    expect(matchesFilter(entry({ path: '/script.js' }), 'doc')).toBe(false);
  });
});

// ── matchesFilter — css ────────────────────────────────────────────────────────

describe('matchesFilter() — css', () => {
  it('matches text/css content-type', () => {
    expect(matchesFilter(entry({ responseHeaders: { 'content-type': 'text/css' } }), 'css')).toBe(true);
  });

  it('matches .css extension', () => {
    expect(matchesFilter(entry({ path: '/styles/main.css' }), 'css')).toBe(true);
  });

  it('does not match non-CSS entries', () => {
    expect(matchesFilter(entry({ path: '/app.js' }), 'css')).toBe(false);
  });
});

// ── matchesFilter — js ─────────────────────────────────────────────────────────

describe('matchesFilter() — js', () => {
  it('matches application/javascript content-type', () => {
    expect(matchesFilter(entry({ responseHeaders: { 'content-type': 'application/javascript' } }), 'js')).toBe(true);
  });

  it('matches text/javascript content-type', () => {
    expect(matchesFilter(entry({ responseHeaders: { 'content-type': 'text/javascript' } }), 'js')).toBe(true);
  });

  it('matches .js extension', () => {
    expect(matchesFilter(entry({ path: '/app.js' }), 'js')).toBe(true);
  });

  it('matches .mjs extension', () => {
    expect(matchesFilter(entry({ path: '/module.mjs' }), 'js')).toBe(true);
  });

  it('matches .cjs extension', () => {
    expect(matchesFilter(entry({ path: '/legacy.cjs' }), 'js')).toBe(true);
  });

  it('does not match CSS entries', () => {
    expect(matchesFilter(entry({ path: '/styles.css' }), 'js')).toBe(false);
  });
});

// ── matchesFilter — font ───────────────────────────────────────────────────────

describe('matchesFilter() — font', () => {
  it('matches font/ content-type prefix', () => {
    expect(matchesFilter(entry({ responseHeaders: { 'content-type': 'font/woff2' } }), 'font')).toBe(true);
  });

  it('matches woff content-type substring', () => {
    expect(matchesFilter(entry({ responseHeaders: { 'content-type': 'application/font-woff' } }), 'font')).toBe(true);
  });

  it('matches .woff extension', () => {
    expect(matchesFilter(entry({ path: '/font.woff' }), 'font')).toBe(true);
  });

  it('matches .woff2 extension', () => {
    expect(matchesFilter(entry({ path: '/font.woff2' }), 'font')).toBe(true);
  });

  it('matches .ttf extension', () => {
    expect(matchesFilter(entry({ path: '/font.ttf' }), 'font')).toBe(true);
  });

  it('matches .eot extension', () => {
    expect(matchesFilter(entry({ path: '/font.eot' }), 'font')).toBe(true);
  });

  it('matches .otf extension', () => {
    expect(matchesFilter(entry({ path: '/font.otf' }), 'font')).toBe(true);
  });

  it('does not match image entries', () => {
    expect(matchesFilter(entry({ path: '/logo.png' }), 'font')).toBe(false);
  });
});

// ── matchesFilter — img ────────────────────────────────────────────────────────

describe('matchesFilter() — img', () => {
  it('matches image/ content-type prefix', () => {
    expect(matchesFilter(entry({ responseHeaders: { 'content-type': 'image/png' } }), 'img')).toBe(true);
  });

  it('matches .png extension', () => {
    expect(matchesFilter(entry({ path: '/logo.png' }), 'img')).toBe(true);
  });

  it('matches .jpg extension', () => {
    expect(matchesFilter(entry({ path: '/photo.jpg' }), 'img')).toBe(true);
  });

  it('matches .jpeg extension', () => {
    expect(matchesFilter(entry({ path: '/photo.jpeg' }), 'img')).toBe(true);
  });

  it('matches .gif extension', () => {
    expect(matchesFilter(entry({ path: '/anim.gif' }), 'img')).toBe(true);
  });

  it('matches .svg extension', () => {
    expect(matchesFilter(entry({ path: '/icon.svg' }), 'img')).toBe(true);
  });

  it('matches .webp extension', () => {
    expect(matchesFilter(entry({ path: '/photo.webp' }), 'img')).toBe(true);
  });

  it('matches .avif extension', () => {
    expect(matchesFilter(entry({ path: '/photo.avif' }), 'img')).toBe(true);
  });

  it('matches .ico extension', () => {
    expect(matchesFilter(entry({ path: '/favicon.ico' }), 'img')).toBe(true);
  });

  it('matches .bmp extension', () => {
    expect(matchesFilter(entry({ path: '/image.bmp' }), 'img')).toBe(true);
  });

  it('does not match font entries', () => {
    expect(matchesFilter(entry({ path: '/font.ttf' }), 'img')).toBe(false);
  });
});

// ── matchesFilter — manifest ───────────────────────────────────────────────────

describe('matchesFilter() — manifest', () => {
  it('matches manifest content-type substring', () => {
    expect(matchesFilter(entry({ responseHeaders: { 'content-type': 'application/manifest+json' } }), 'manifest')).toBe(true);
  });

  it('matches .webmanifest extension', () => {
    expect(matchesFilter(entry({ path: '/site.webmanifest' }), 'manifest')).toBe(true);
  });

  it('matches paths ending with manifest.json', () => {
    expect(matchesFilter(entry({ path: '/manifest.json' }), 'manifest')).toBe(true);
    expect(matchesFilter(entry({ path: '/assets/manifest.json' }), 'manifest')).toBe(true);
  });

  it('does not match an arbitrary .json file', () => {
    expect(matchesFilter(entry({ path: '/data.json' }), 'manifest')).toBe(false);
  });
});

// ── matchesFilter — wasm ───────────────────────────────────────────────────────

describe('matchesFilter() — wasm', () => {
  it('matches application/wasm content-type', () => {
    expect(matchesFilter(entry({ responseHeaders: { 'content-type': 'application/wasm' } }), 'wasm')).toBe(true);
  });

  it('matches .wasm extension', () => {
    expect(matchesFilter(entry({ path: '/module.wasm' }), 'wasm')).toBe(true);
  });

  it('does not match JS entries', () => {
    expect(matchesFilter(entry({ path: '/app.js' }), 'wasm')).toBe(false);
  });
});

// ── matchesFilter — graphql ────────────────────────────────────────────────────

describe('matchesFilter() — graphql', () => {
  it('matches paths containing "graphql"', () => {
    expect(matchesFilter(entry({ path: '/graphql' }), 'graphql')).toBe(true);
    expect(matchesFilter(entry({ path: '/api/graphql/query' }), 'graphql')).toBe(true);
  });

  it('matches case-insensitively', () => {
    expect(matchesFilter(entry({ path: '/GraphQL' }), 'graphql')).toBe(true);
  });

  it('does not match paths without "graphql"', () => {
    expect(matchesFilter(entry({ path: '/api/users' }), 'graphql')).toBe(false);
  });
});

// ── matchesFilter — wml ────────────────────────────────────────────────────────

describe('matchesFilter() — wml', () => {
  it('matches wml content-type substring', () => {
    expect(matchesFilter(entry({ responseHeaders: { 'content-type': 'text/vnd.wap.wml' } }), 'wml')).toBe(true);
  });

  it('matches .wml extension', () => {
    expect(matchesFilter(entry({ path: '/page.wml' }), 'wml')).toBe(true);
  });

  it('does not match HTML entries', () => {
    expect(matchesFilter(entry({ path: '/index.html' }), 'wml')).toBe(false);
  });
});

// ── matchesFilter — other ──────────────────────────────────────────────────────

describe('matchesFilter() — other', () => {
  it('matches a plain HTTP entry with no recognisable content type', () => {
    expect(matchesFilter(entry({ path: '/api/data', responseHeaders: {} }), 'other')).toBe(true);
  });

  it('matches an HTTPS entry with no recognisable content type', () => {
    expect(matchesFilter(entry({ path: '/api/data', https: true, responseHeaders: {} }), 'other')).toBe(true);
  });

  it('does not match an entry that fits the "js" filter', () => {
    expect(matchesFilter(entry({ path: '/app.js' }), 'other')).toBe(false);
  });

  it('does not match an entry that fits the "img" filter', () => {
    expect(matchesFilter(entry({ path: '/logo.png' }), 'other')).toBe(false);
  });

  it('does not match an entry that fits the "json" filter', () => {
    expect(matchesFilter(entry({ responseHeaders: { 'content-type': 'application/json' } }), 'other')).toBe(false);
  });
});

// ── matchesFilter — header lookup ──────────────────────────────────────────────

describe('matchesFilter() — case-insensitive header lookup', () => {
  it('finds content-type regardless of header name casing', () => {
    expect(matchesFilter(entry({ responseHeaders: { 'Content-Type': 'application/json' } }), 'json')).toBe(true);
    expect(matchesFilter(entry({ responseHeaders: { 'CONTENT-TYPE': 'application/json' } }), 'json')).toBe(true);
  });

  it('handles array header values by using the first element', () => {
    expect(matchesFilter(entry({ responseHeaders: { 'content-type': ['application/json', 'charset=utf-8'] } }), 'json')).toBe(true);
  });

  it('handles null/undefined headers gracefully', () => {
    expect(matchesFilter(entry({ responseHeaders: null }), 'json')).toBe(false);
    expect(matchesFilter(entry({ responseHeaders: undefined }), 'json')).toBe(false);
  });
});

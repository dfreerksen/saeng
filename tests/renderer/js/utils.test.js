// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  escapeHtml,
  validateDomainPart,
  splitDomain,
  setExpiryDisplay,
  DOMAIN_SUFFIXES,
  DEFAULT_SUFFIX,
} from '../../../src/renderer/js/utils.js';

// ── escapeHtml ─────────────────────────────────────────────────────

describe('escapeHtml()', () => {
  it('escapes &', () => expect(escapeHtml('a & b')).toBe('a &amp; b'));
  it('escapes <', () => expect(escapeHtml('<tag>')).toBe('&lt;tag&gt;'));
  it('escapes >', () => expect(escapeHtml('a > b')).toBe('a &gt; b'));
  it('escapes "', () => expect(escapeHtml('"quoted"')).toBe('&quot;quoted&quot;'));
  it('escapes all four characters in one string', () => {
    expect(escapeHtml('<a href="url">text & more</a>')).toBe(
      '&lt;a href=&quot;url&quot;&gt;text &amp; more&lt;/a&gt;'
    );
  });
  it('returns the input unchanged when nothing needs escaping', () => {
    expect(escapeHtml('hello world')).toBe('hello world');
  });
  it('coerces non-string input to string', () => {
    expect(escapeHtml(42)).toBe('42');
    expect(escapeHtml(null)).toBe('null');
  });
});

// ── validateDomainPart ─────────────────────────────────────────────

describe('validateDomainPart()', () => {
  it('accepts a simple alphanumeric label', () => {
    expect(validateDomainPart('myapp')).toBe(true);
  });

  it('accepts a single character', () => {
    expect(validateDomainPart('a')).toBe(true);
    expect(validateDomainPart('1')).toBe(true);
  });

  it('accepts labels with interior hyphens', () => {
    expect(validateDomainPart('my-app')).toBe(true);
    expect(validateDomainPart('foo-bar-baz')).toBe(true);
  });

  it('accepts mixed case', () => {
    expect(validateDomainPart('MyApp')).toBe(true);
  });

  it('rejects an empty string', () => {
    expect(validateDomainPart('')).toBe(false);
  });

  it('rejects a label starting with a hyphen', () => {
    expect(validateDomainPart('-myapp')).toBe(false);
  });

  it('rejects a label ending with a hyphen', () => {
    expect(validateDomainPart('myapp-')).toBe(false);
  });

  it('rejects labels with spaces', () => {
    expect(validateDomainPart('my app')).toBe(false);
  });

  it('rejects labels with dots', () => {
    expect(validateDomainPart('my.app')).toBe(false);
  });

  it('rejects labels with special characters', () => {
    expect(validateDomainPart('my_app')).toBe(false);
    expect(validateDomainPart('my@app')).toBe(false);
  });
});

// ── splitDomain ────────────────────────────────────────────────────

describe('splitDomain()', () => {
  it('splits a simple domain with the default suffix', () => {
    expect(splitDomain('myapp.local')).toEqual({ subdomain: '', domain: 'myapp', suffix: '.local' });
  });

  it('splits a domain with a subdomain', () => {
    expect(splitDomain('api.myapp.local')).toEqual({
      subdomain: 'api',
      domain: 'myapp',
      suffix: '.local',
    });
  });

  it('recognises all supported suffixes', () => {
    const cases = [
      ['myapp.test', '.test'],
      ['myapp.localhost', '.localhost'],
      ['myapp.co.local', '.co.local'],
      ['myapp.co.test', '.co.test'],
    ];
    for (const [input, expectedSuffix] of cases) {
      expect(splitDomain(input).suffix).toBe(expectedSuffix);
    }
  });

  it('falls back to the default suffix when none matches', () => {
    expect(splitDomain('myapp.dev').suffix).toBe(DEFAULT_SUFFIX);
  });

  it('DOMAIN_SUFFIXES matches the set of known suffixes', () => {
    expect(DOMAIN_SUFFIXES).toContain('.local');
    expect(DOMAIN_SUFFIXES).toContain('.test');
    expect(DOMAIN_SUFFIXES).toContain('.localhost');
  });

  it('picks the longest matching suffix (co.local before .local)', () => {
    // 'myapp.co.local' should match '.co.local', not '.local'
    expect(splitDomain('myapp.co.local').suffix).toBe('.co.local');
    expect(splitDomain('myapp.co.local').domain).toBe('myapp');
  });
});

// ── setExpiryDisplay ───────────────────────────────────────────────

describe('setExpiryDisplay()', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="caExpiryBox"></div>';
  });

  const future = (ms) => new Date(Date.now() + ms).toISOString();
  const past = (ms) => new Date(Date.now() - ms).toISOString();

  const DAY = 24 * 60 * 60 * 1000;

  it('shows "Expires" for a date well in the future', () => {
    setExpiryDisplay(future(365 * DAY));
    expect(document.getElementById('caExpiryBox').textContent).toMatch(/^Expires /);
  });

  it('shows "Expired" for a past date', () => {
    setExpiryDisplay(past(DAY));
    expect(document.getElementById('caExpiryBox').textContent).toMatch(/^Expired /);
  });

  it('adds ca-expiry--danger for dates within one week', () => {
    setExpiryDisplay(future(3 * DAY));
    expect(document.getElementById('caExpiryBox').classList.contains('ca-expiry--danger')).toBe(true);
  });

  it('adds ca-expiry--danger for expired dates', () => {
    setExpiryDisplay(past(DAY));
    expect(document.getElementById('caExpiryBox').classList.contains('ca-expiry--danger')).toBe(true);
  });

  it('adds ca-expiry--warning for dates within three months but beyond one week', () => {
    setExpiryDisplay(future(30 * DAY));
    expect(document.getElementById('caExpiryBox').classList.contains('ca-expiry--warning')).toBe(true);
    expect(document.getElementById('caExpiryBox').classList.contains('ca-expiry--danger')).toBe(false);
  });

  it('adds no urgency class for dates more than three months away', () => {
    setExpiryDisplay(future(120 * DAY));
    const el = document.getElementById('caExpiryBox');
    expect(el.classList.contains('ca-expiry--danger')).toBe(false);
    expect(el.classList.contains('ca-expiry--warning')).toBe(false);
  });

  it('clears previous urgency classes before applying new ones', () => {
    const el = document.getElementById('caExpiryBox');
    el.classList.add('ca-expiry--danger');
    setExpiryDisplay(future(120 * DAY)); // far future → no class
    expect(el.classList.contains('ca-expiry--danger')).toBe(false);
  });
});

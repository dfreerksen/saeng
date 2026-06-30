// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import {
  validateDomainPart,
  splitDomain,
  getExpiryInfo,
  DOMAIN_SUFFIXES,
  DEFAULT_SUFFIX,
} from '../../../src/renderer/js/utils.js';

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
      ['myapp.self', '.self'],
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
    expect(DOMAIN_SUFFIXES).toContain('.self');
  });

  it('picks the longest matching suffix (co.local before .local)', () => {
    expect(splitDomain('myapp.co.local').suffix).toBe('.co.local');
    expect(splitDomain('myapp.co.local').domain).toBe('myapp');
  });
});

// ── getExpiryInfo ──────────────────────────────────────────────────

describe('getExpiryInfo()', () => {
  const future = (ms) => new Date(Date.now() + ms).toISOString();
  const past = (ms) => new Date(Date.now() - ms).toISOString();
  const DAY = 24 * 60 * 60 * 1000;

  it('returns null for a falsy input', () => {
    expect(getExpiryInfo(null)).toBeNull();
    expect(getExpiryInfo('')).toBeNull();
  });

  it('returns text starting with "Expires" for a date well in the future', () => {
    expect(getExpiryInfo(future(365 * DAY)).text).toMatch(/^Expires /);
  });

  it('returns text starting with "Expired" for a past date', () => {
    expect(getExpiryInfo(past(DAY)).text).toMatch(/^Expired /);
  });

  it('returns urgency "danger" for dates within one week', () => {
    expect(getExpiryInfo(future(3 * DAY)).urgency).toBe('danger');
  });

  it('returns urgency "danger" for expired dates', () => {
    expect(getExpiryInfo(past(DAY)).urgency).toBe('danger');
  });

  it('returns urgency "warning" for dates within three months but beyond one week', () => {
    const info = getExpiryInfo(future(30 * DAY));
    expect(info.urgency).toBe('warning');
  });

  it('returns urgency null for dates more than three months away', () => {
    expect(getExpiryInfo(future(120 * DAY)).urgency).toBeNull();
  });
});

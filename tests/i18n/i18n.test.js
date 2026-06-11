import { describe, it, expect, beforeEach } from 'vitest';
import { load, t, getStrings, getSupportedLocales } from '../../src/i18n/i18n.js';

describe('getSupportedLocales()', () => {
  it('returns a non-empty array', () => {
    const locales = getSupportedLocales();
    expect(locales.length).toBeGreaterThan(0);
  });

  it('every locale has code, name, and dir fields', () => {
    for (const locale of getSupportedLocales()) {
      expect(locale).toHaveProperty('code');
      expect(locale).toHaveProperty('name');
      expect(locale).toHaveProperty('dir');
    }
  });

  it('every dir value is either ltr or rtl', () => {
    for (const locale of getSupportedLocales()) {
      expect(['ltr', 'rtl']).toContain(locale.dir);
    }
  });

  it('includes English', () => {
    const codes = getSupportedLocales().map((l) => l.code);
    expect(codes).toContain('en');
  });

  it('Arabic is marked as rtl', () => {
    const ar = getSupportedLocales().find((l) => l.code === 'ar');
    expect(ar).toBeDefined();
    expect(ar.dir).toBe('rtl');
  });
});

describe('load() and t()', () => {
  beforeEach(() => {
    load('en');
  });

  it('loads English strings', () => {
    const strings = getStrings();
    expect(Object.keys(strings).length).toBeGreaterThan(0);
  });

  it('returns the translated string for a known key', () => {
    expect(t('proxy.action.start')).toBe('Start Proxy');
  });

  it('returns the key itself for an unknown key', () => {
    expect(t('no.such.key')).toBe('no.such.key');
  });

  it('interpolates variables into the string', () => {
    // Use a key that contains a placeholder, or verify the mechanism directly
    // by checking that {name} is replaced
    const result = t('no.such.key.{name}', { name: 'test' });
    expect(result).toBe('no.such.key.test');
  });

  it('loads a supported locale other than English', () => {
    load('de');
    const strings = getStrings();
    expect(Object.keys(strings).length).toBeGreaterThan(0);
  });

  it('falls back to English when locale is unknown', () => {
    load('xx');
    expect(t('proxy.action.start')).toBe('Start Proxy');
  });

  it('handles a full locale tag by stripping the region suffix', () => {
    load('en-US');
    expect(t('proxy.action.start')).toBe('Start Proxy');
  });

  it('handles null/undefined locale by defaulting to English', () => {
    load(null);
    expect(t('proxy.action.start')).toBe('Start Proxy');
  });
});

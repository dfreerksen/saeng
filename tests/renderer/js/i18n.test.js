// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { t, loadStrings } from '../../../src/renderer/js/i18n.js';

const SAMPLE = {
  'proxy.action.start': 'Start Proxy',
  'greeting': 'Hello, {name}!',
};

beforeEach(() => {
  loadStrings({}); // reset module-level string state
});

describe('t()', () => {
  it('returns the key itself when no strings are loaded', () => {
    expect(t('some.key')).toBe('some.key');
  });

  it('returns the translated string for a known key', () => {
    loadStrings(SAMPLE);
    expect(t('proxy.action.start')).toBe('Start Proxy');
  });

  it('returns the key when the key is not in the loaded strings', () => {
    loadStrings(SAMPLE);
    expect(t('not.a.key')).toBe('not.a.key');
  });

  it('interpolates a single variable', () => {
    loadStrings(SAMPLE);
    expect(t('greeting', { name: 'David' })).toBe('Hello, David!');
  });

  it('interpolates multiple occurrences of the same variable', () => {
    loadStrings({ 'msg': '{x} and {x}' });
    expect(t('msg', { x: 'foo' })).toBe('foo and foo');
  });

  it('interpolates multiple different variables', () => {
    loadStrings({ 'msg': '{a} then {b}' });
    expect(t('msg', { a: '1', b: '2' })).toBe('1 then 2');
  });

  it('coerces variable values to strings', () => {
    loadStrings({ 'count': 'Total: {n}' });
    expect(t('count', { n: 42 })).toBe('Total: 42');
  });
});

describe('loadStrings()', () => {
  it('makes the new strings immediately available via t()', () => {
    loadStrings({ 'hello': 'World' });
    expect(t('hello')).toBe('World');
  });

  it('replaces the previous string set entirely', () => {
    loadStrings({ 'old': 'Old Value' });
    loadStrings({ 'new': 'New Value' });
    expect(t('old')).toBe('old'); // key not found → returns key
    expect(t('new')).toBe('New Value');
  });
});

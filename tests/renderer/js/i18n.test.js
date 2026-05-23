// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { t, loadStrings, applyTranslations, initI18n } from '../../../src/renderer/js/i18n.js';

const SAMPLE = {
  'proxy.start': 'Start Proxy',
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
    expect(t('proxy.start')).toBe('Start Proxy');
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

  it('applies translations to [data-i18n] elements already in the document', () => {
    loadStrings({ 'nav.home': 'Home' });
    document.body.innerHTML = '<span data-i18n="nav.home"></span>';
    loadStrings({ 'nav.home': 'Home' }); // triggers applyTranslations
    expect(document.querySelector('[data-i18n]').textContent).toBe('Home');
  });
});

describe('applyTranslations()', () => {
  beforeEach(() => {
    loadStrings({ 'key.text': 'Plain Text', 'key.html': '<b>Bold</b>', 'key.ph': 'Enter value' });
  });

  it('sets textContent for [data-i18n] elements', () => {
    document.body.innerHTML = '<span data-i18n="key.text"></span>';
    applyTranslations();
    expect(document.querySelector('[data-i18n]').textContent).toBe('Plain Text');
  });

  it('sets innerHTML for [data-i18n-html] elements', () => {
    document.body.innerHTML = '<div data-i18n-html="key.html"></div>';
    applyTranslations();
    expect(document.querySelector('[data-i18n-html]').innerHTML).toBe('<b>Bold</b>');
  });

  it('sets placeholder for [data-i18n-placeholder] elements', () => {
    document.body.innerHTML = '<input data-i18n-placeholder="key.ph">';
    applyTranslations();
    expect(document.querySelector('[data-i18n-placeholder]').placeholder).toBe('Enter value');
  });

  it('handles multiple elements in one pass', () => {
    document.body.innerHTML = `
      <span data-i18n="key.text"></span>
      <span data-i18n="key.text"></span>
    `;
    applyTranslations();
    const els = document.querySelectorAll('[data-i18n]');
    expect(els[0].textContent).toBe('Plain Text');
    expect(els[1].textContent).toBe('Plain Text');
  });

  it('uses the key as fallback when not in the string set', () => {
    document.body.innerHTML = '<span data-i18n="missing.key"></span>';
    applyTranslations();
    expect(document.querySelector('[data-i18n]').textContent).toBe('missing.key');
  });
});

describe('initI18n()', () => {
  it('fetches strings from electronAPI and applies them to the document', async () => {
    document.body.innerHTML = '<span data-i18n="app.title"></span>';
    globalThis.electronAPI = {
      i18n: { getStrings: vi.fn().mockResolvedValue({ 'app.title': 'Saeng' }) },
    };
    await initI18n();
    expect(document.querySelector('[data-i18n]').textContent).toBe('Saeng');
  });
});

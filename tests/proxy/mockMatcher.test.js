import { describe, it, expect } from 'vitest';
import {
  compileConditions,
  conditionMatches,
  conditionsMatch,
  compileMockRules,
  findMock,
} from '../../src/proxy/mockMatcher.js';

describe('compileConditions()', () => {
  it('returns an empty array for a non-array input', () => {
    expect(compileConditions(undefined)).toEqual([]);
    expect(compileConditions(null)).toEqual([]);
  });

  it('returns an empty array for an empty array', () => {
    expect(compileConditions([])).toEqual([]);
  });

  it('lowercases header condition keys', () => {
    const [compiled] = compileConditions([{ type: 'header', key: 'X-Token', operator: 'exists', value: '' }]);
    expect(compiled.key).toBe('x-token');
  });

  it('leaves query/body condition keys as-is', () => {
    const [compiled] = compileConditions([{ type: 'query', key: 'Debug', operator: 'exists', value: '' }]);
    expect(compiled.key).toBe('Debug');
  });

  it('pre-compiles a regex operator value', () => {
    const [compiled] = compileConditions([{ type: 'body', operator: 'regex', value: '^\\d+$' }]);
    expect(compiled.regex).toBeInstanceOf(RegExp);
    expect(compiled.regex.test('123')).toBe(true);
  });

  it('leaves regex null for non-regex operators', () => {
    const [compiled] = compileConditions([{ type: 'body', operator: 'equals', value: 'x' }]);
    expect(compiled.regex).toBeNull();
  });

  it('throws when a regex operator value does not compile', () => {
    expect(() => compileConditions([{ type: 'body', operator: 'regex', value: '(unterminated' }])).toThrow();
  });

  it('compiles multiple conditions in order', () => {
    const compiled = compileConditions([
      { type: 'header', key: 'A', operator: 'exists', value: '' },
      { type: 'query', key: 'b', operator: 'equals', value: '1' },
    ]);
    expect(compiled).toHaveLength(2);
    expect(compiled[0].key).toBe('a');
    expect(compiled[1].key).toBe('b');
  });
});

describe('conditionMatches() — header', () => {
  it('matches "exists" when the header is present', () => {
    const condition = { type: 'header', key: 'x-token', operator: 'exists' };
    expect(conditionMatches(condition, { headers: { 'x-token': 'anything' } })).toBe(true);
  });

  it('fails "exists" when the header is absent', () => {
    const condition = { type: 'header', key: 'x-token', operator: 'exists' };
    expect(conditionMatches(condition, { headers: {} })).toBe(false);
  });

  it('matches "equals" case-sensitively on value', () => {
    const condition = { type: 'header', key: 'x-token', operator: 'equals', value: 'secret' };
    expect(conditionMatches(condition, { headers: { 'x-token': 'secret' } })).toBe(true);
    expect(conditionMatches(condition, { headers: { 'x-token': 'wrong' } })).toBe(false);
  });

  it('matches "contains" as a substring check', () => {
    const condition = { type: 'header', key: 'user-agent', operator: 'contains', value: 'Chrome' };
    expect(conditionMatches(condition, { headers: { 'user-agent': 'Mozilla Chrome/1' } })).toBe(true);
    expect(conditionMatches(condition, { headers: { 'user-agent': 'Safari' } })).toBe(false);
  });

  it('matches "regex" using the pre-compiled regex', () => {
    const condition = { type: 'header', key: 'x-id', operator: 'regex', regex: /^\d+$/ };
    expect(conditionMatches(condition, { headers: { 'x-id': '42' } })).toBe(true);
    expect(conditionMatches(condition, { headers: { 'x-id': 'abc' } })).toBe(false);
  });

  it('returns false for a non-exists operator when the header is missing', () => {
    const condition = { type: 'header', key: 'x-id', operator: 'equals', value: 'x' };
    expect(conditionMatches(condition, { headers: {} })).toBe(false);
  });

  it('returns false for an unknown operator', () => {
    const condition = { type: 'header', key: 'x-id', operator: 'bogus', value: 'x' };
    expect(conditionMatches(condition, { headers: { 'x-id': 'x' } })).toBe(false);
  });
});

describe('conditionMatches() — query', () => {
  it('reads the value from a URLSearchParams instance', () => {
    const condition = { type: 'query', key: 'debug', operator: 'equals', value: 'true' };
    expect(conditionMatches(condition, { query: new URLSearchParams('debug=true') })).toBe(true);
  });

  it('fails "exists" when the param is absent', () => {
    const condition = { type: 'query', key: 'debug', operator: 'exists' };
    expect(conditionMatches(condition, { query: new URLSearchParams() })).toBe(false);
  });

  it('handles a missing query object gracefully', () => {
    const condition = { type: 'query', key: 'debug', operator: 'exists' };
    expect(conditionMatches(condition, {})).toBe(false);
  });
});

describe('conditionMatches() — body', () => {
  it('matches "exists" only when the body is non-empty after trimming', () => {
    const condition = { type: 'body', operator: 'exists' };
    expect(conditionMatches(condition, { body: '  ' })).toBe(false);
    expect(conditionMatches(condition, { body: 'x' })).toBe(true);
    expect(conditionMatches(condition, { body: undefined })).toBe(false);
  });

  it('matches "contains" against the raw body string', () => {
    const condition = { type: 'body', operator: 'contains', value: 'id' };
    expect(conditionMatches(condition, { body: '{"id": 42}' })).toBe(true);
    expect(conditionMatches(condition, { body: '{}' })).toBe(false);
  });

  it('matches "regex" against the raw body string', () => {
    const condition = { type: 'body', operator: 'regex', regex: /"id":\s*\d+/ };
    expect(conditionMatches(condition, { body: '{"id": 42}' })).toBe(true);
    expect(conditionMatches(condition, { body: '{}' })).toBe(false);
  });

  it('returns false for "regex" when no pre-compiled regex is present', () => {
    const condition = { type: 'body', operator: 'regex', regex: null };
    expect(conditionMatches(condition, { body: 'anything' })).toBe(false);
  });
});

describe('conditionsMatch()', () => {
  it('returns true for an empty/undefined condition list', () => {
    expect(conditionsMatch([], {})).toBe(true);
    expect(conditionsMatch(undefined, {})).toBe(true);
    expect(conditionsMatch(null, {})).toBe(true);
  });

  it('requires all conditions to match (AND)', () => {
    const conditions = [
      { type: 'query', key: 'debug', operator: 'equals', value: 'true' },
      { type: 'header', key: 'x-token', operator: 'exists' },
    ];
    const extra = { query: new URLSearchParams('debug=true'), headers: { 'x-token': 'a' } };
    expect(conditionsMatch(conditions, extra)).toBe(true);
    expect(conditionsMatch(conditions, { query: new URLSearchParams('debug=true'), headers: {} })).toBe(false);
  });
});

describe('compileMockRules()', () => {
  it('skips disabled mocks', () => {
    const { byMapping } = compileMockRules([{ enabled: false, mappingId: 'm1', pathPattern: '^/api$' }]);
    expect(byMapping.has('m1')).toBe(false);
  });

  it('groups compiled mocks by mappingId, preserving array order', () => {
    const { byMapping } = compileMockRules([
      { enabled: true, mappingId: 'm1', pathPattern: '^/a$', body: 'first' },
      { enabled: true, mappingId: 'm1', pathPattern: '^/b$', body: 'second' },
    ]);
    const list = byMapping.get('m1');
    expect(list).toHaveLength(2);
    expect(list[0].body).toBe('first');
    expect(list[1].body).toBe('second');
  });

  it('uppercases the method, defaulting to "*"', () => {
    const { byMapping } = compileMockRules([{ enabled: true, mappingId: 'm1', pathPattern: '^/a$', method: 'post' }]);
    expect(byMapping.get('m1')[0].method).toBe('POST');
    const { byMapping: defaulted } = compileMockRules([{ enabled: true, mappingId: 'm1', pathPattern: '^/a$' }]);
    expect(defaulted.get('m1')[0].method).toBe('*');
  });

  it('defaults delayMs to 0 when not provided', () => {
    const { byMapping } = compileMockRules([{ enabled: true, mappingId: 'm1', pathPattern: '^/a$' }]);
    expect(byMapping.get('m1')[0].delayMs).toBe(0);
  });

  it('carries a provided delayMs through', () => {
    const { byMapping } = compileMockRules([{ enabled: true, mappingId: 'm1', pathPattern: '^/a$', delayMs: 500 }]);
    expect(byMapping.get('m1')[0].delayMs).toBe(500);
  });

  it('skips a mock with an invalid pathPattern regex', () => {
    const { byMapping } = compileMockRules([{ enabled: true, mappingId: 'm1', pathPattern: '(unterminated' }]);
    expect(byMapping.has('m1')).toBe(false);
  });

  it('skips a mock with an invalid condition regex', () => {
    const { byMapping } = compileMockRules([
      { enabled: true, mappingId: 'm1', pathPattern: '^/a$', conditions: [{ type: 'body', operator: 'regex', value: '(bad' }] },
    ]);
    expect(byMapping.has('m1')).toBe(false);
  });

  it('tracks mappingIds with a body condition in needsBody', () => {
    const { needsBody } = compileMockRules([
      { enabled: true, mappingId: 'm1', pathPattern: '^/a$', conditions: [{ type: 'body', operator: 'exists' }] },
      { enabled: true, mappingId: 'm2', pathPattern: '^/b$', conditions: [{ type: 'header', key: 'x', operator: 'exists' }] },
    ]);
    expect(needsBody.has('m1')).toBe(true);
    expect(needsBody.has('m2')).toBe(false);
  });

  it('returns an empty map/set for no mocks', () => {
    const { byMapping, needsBody } = compileMockRules([]);
    expect(byMapping.size).toBe(0);
    expect(needsBody.size).toBe(0);
  });
});

describe('findMock()', () => {
  function byMappingWith(mocks) {
    return compileMockRules(mocks).byMapping;
  }

  it('returns null when mapping.mocksEnabled is false', () => {
    const byMapping = byMappingWith([{ enabled: true, mappingId: 'm1', pathPattern: '^/api$' }]);
    expect(findMock(byMapping, { id: 'm1', mocksEnabled: false }, 'GET', '/api')).toBeNull();
  });

  it('returns null when there are no mocks for the mapping', () => {
    const byMapping = byMappingWith([]);
    expect(findMock(byMapping, { id: 'm1', mocksEnabled: true }, 'GET', '/api')).toBeNull();
  });

  it('matches a mock with method "*" regardless of request method', () => {
    const byMapping = byMappingWith([{ enabled: true, mappingId: 'm1', pathPattern: '^/api$', method: '*', body: 'any' }]);
    const mapping = { id: 'm1', mocksEnabled: true };
    expect(findMock(byMapping, mapping, 'GET', '/api')?.mock.body).toBe('any');
    expect(findMock(byMapping, mapping, 'POST', '/api')?.mock.body).toBe('any');
  });

  it('matches a mock only for its configured method (case-insensitive)', () => {
    const byMapping = byMappingWith([{ enabled: true, mappingId: 'm1', pathPattern: '^/api$', method: 'post', body: 'posted' }]);
    const mapping = { id: 'm1', mocksEnabled: true };
    expect(findMock(byMapping, mapping, 'POST', '/api')?.mock.body).toBe('posted');
    expect(findMock(byMapping, mapping, 'GET', '/api')).toBeNull();
  });

  it('matches the path against the mock regex', () => {
    const byMapping = byMappingWith([{ enabled: true, mappingId: 'm1', pathPattern: '^/api/users/\\d+$', body: 'user' }]);
    const mapping = { id: 'm1', mocksEnabled: true };
    expect(findMock(byMapping, mapping, 'GET', '/api/users/42')?.mock.body).toBe('user');
    expect(findMock(byMapping, mapping, 'GET', '/api/users/abc')).toBeNull();
  });

  it('returns the first matching rule when multiple rules match', () => {
    const byMapping = byMappingWith([
      { enabled: true, mappingId: 'm1', pathPattern: '^/api/ping$', body: 'first' },
      { enabled: true, mappingId: 'm1', pathPattern: '^/api/ping$', body: 'second' },
    ]);
    const mapping = { id: 'm1', mocksEnabled: true };
    expect(findMock(byMapping, mapping, 'GET', '/api/ping')?.mock.body).toBe('first');
  });

  it('returns the regex match result with capture groups', () => {
    const byMapping = byMappingWith([{ enabled: true, mappingId: 'm1', pathPattern: '^/api/users/(\\d+)$', body: 'user' }]);
    const mapping = { id: 'm1', mocksEnabled: true };
    const result = findMock(byMapping, mapping, 'GET', '/api/users/42');
    expect(result.match[1]).toBe('42');
  });

  it('requires extra conditions to also match', () => {
    const byMapping = byMappingWith([
      { enabled: true, mappingId: 'm1', pathPattern: '^/api$', body: 'ok', conditions: [{ type: 'header', key: 'x-token', operator: 'exists' }] },
    ]);
    const mapping = { id: 'm1', mocksEnabled: true };
    expect(findMock(byMapping, mapping, 'GET', '/api', { headers: { 'x-token': 'a' } })?.mock.body).toBe('ok');
    expect(findMock(byMapping, mapping, 'GET', '/api', { headers: {} })).toBeNull();
  });

  it('defaults extra to an empty object when not provided', () => {
    const byMapping = byMappingWith([{ enabled: true, mappingId: 'm1', pathPattern: '^/api$', body: 'ok' }]);
    const mapping = { id: 'm1', mocksEnabled: true };
    expect(findMock(byMapping, mapping, 'GET', '/api')?.mock.body).toBe('ok');
  });
});

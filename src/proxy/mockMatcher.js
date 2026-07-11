// Pre-lowercases header condition keys (request headers are always
// lowercase-keyed in Node) and pre-compiles regex-operator conditions.
// Throws if a regex condition doesn't compile, so the caller can skip the
// whole mock the same way an invalid pathPattern is skipped.
export function compileConditions(conditions) {
  if (!Array.isArray(conditions)) return [];
  return conditions.map((c) => ({
    type: c.type,
    key: c.type === 'header' ? (c.key || '').toLowerCase() : c.key,
    operator: c.operator,
    value: c.value,
    regex: c.operator === 'regex' ? new RegExp(c.value) : null,
  }));
}

export function conditionMatches(condition, extra) {
  let actual;
  if (condition.type === 'header') actual = extra.headers?.[condition.key];
  else if (condition.type === 'query') actual = extra.query?.get(condition.key) ?? undefined;
  else actual = extra.body;

  if (condition.operator === 'exists') {
    if (condition.type === 'body') return typeof actual === 'string' && actual.trim().length > 0;
    return actual !== undefined;
  }

  if (actual === undefined) return false;
  switch (condition.operator) {
    case 'equals': return actual === condition.value;
    case 'contains': return actual.includes(condition.value);
    case 'regex': return condition.regex ? condition.regex.test(actual) : false;
    default: return false;
  }
}

export function conditionsMatch(conditions, extra) {
  if (!conditions || conditions.length === 0) return true;
  return conditions.every((c) => conditionMatches(c, extra));
}

// Compiles the enabled mock rules into a Map<mappingId, CompiledMock[]>,
// preserving array order so the first matching rule wins. Rules with an
// invalid pathPattern or an invalid condition regex are skipped
// defensively (the store validates on save, but mappings between
// processes could in theory drift). Also returns the set of mappingIds
// with at least one enabled mock with a body condition, so callers know
// which mappings need the full request body buffered before deciding.
export function compileMockRules(mocks) {
  const byMapping = new Map();
  const needsBody = new Set();
  for (const mock of mocks) {
    if (!mock.enabled) continue;
    let regex;
    try {
      regex = new RegExp(mock.pathPattern);
    } catch {
      continue;
    }
    let conditions;
    try {
      conditions = compileConditions(mock.conditions);
    } catch {
      continue;
    }
    if (conditions.some((c) => c.type === 'body')) needsBody.add(mock.mappingId);
    const list = byMapping.get(mock.mappingId) ?? [];
    list.push({
      method: (mock.method || '*').toUpperCase(),
      regex,
      statusCode: mock.statusCode,
      headers: mock.headers,
      body: mock.body,
      delayMs: mock.delayMs || 0,
      conditions,
    });
    byMapping.set(mock.mappingId, list);
  }
  return { byMapping, needsBody };
}

// Returns the first compiled mock (and its regex match) whose method,
// pathPattern, and conditions all match, or null if the mapping has no
// mocking enabled or none of its rules match.
export function findMock(mocksByMapping, mapping, method, pathname, extra = {}) {
  if (!mapping.mocksEnabled) return null;
  const mocks = mocksByMapping.get(mapping.id);
  if (!mocks) return null;
  const upperMethod = method.toUpperCase();
  for (const mock of mocks) {
    if (mock.method !== '*' && mock.method !== upperMethod) continue;
    const match = mock.regex.exec(pathname);
    if (!match) continue;
    if (!conditionsMatch(mock.conditions, extra)) continue;
    return { mock, match };
  }
  return null;
}

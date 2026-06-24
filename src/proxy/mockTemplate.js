import { randomUUID } from 'crypto';

function renderMockTemplate(template, context) {
  if (!template || !template.includes('{{')) return template;

  return template.replace(/\{\{(.+?)\}\}/g, (full, key) => {
    const trimmed = key.trim().toLowerCase();

    if (trimmed === 'timestamp') return String(Date.now());
    if (trimmed === 'isodate') return new Date().toISOString();
    if (trimmed === 'uuid') return randomUUID();

    if (trimmed === 'request.method') return context.method || '';
    if (trimmed === 'request.path') return context.path || '';
    if (trimmed === 'request.url') return context.url || '';
    if (trimmed === 'request.body') return context.body || '';
    if (trimmed === 'request.host') return context.host || '';
    if (trimmed.startsWith('request.header.')) {
      const headerName = trimmed.slice('request.header.'.length);
      return context.headers?.[headerName] ?? '';
    }

    if (trimmed.startsWith('match.')) {
      const index = parseInt(trimmed.slice('match.'.length), 10);
      if (!isNaN(index) && context.match && index < context.match.length) {
        return context.match[index] ?? '';
      }
      return '';
    }

    return full;
  });
}

export { renderMockTemplate };

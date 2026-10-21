import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  HELP_DOCS,
  HELP_GROUPS,
  HOME_DOC,
  REPO_DOCS_URL,
  getDoc,
  docTitle,
  slugify,
  resolveDocLink,
  renderDoc,
  searchDocs,
  docGitHubUrl,
} from '../../../src/renderer/js/helpDocs.js';

const docsDir = path.resolve(import.meta.dirname, '../../../docs');

function listMarkdown(dir, prefix = '') {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const rel = prefix + entry.name;
    if (entry.isDirectory()) return listMarkdown(path.join(dir, entry.name), `${rel}/`);
    return entry.name.endsWith('.md') ? [rel] : [];
  });
}

describe('HELP_DOCS', () => {
  it('bundles every Markdown file in docs/', () => {
    const bundled = HELP_DOCS.map((doc) => doc.path).sort();
    expect(bundled).toEqual(listMarkdown(docsDir).sort());
  });

  it('bundles each file with its current contents', () => {
    for (const doc of HELP_DOCS) {
      expect(doc.source).toBe(fs.readFileSync(path.join(docsDir, doc.path), 'utf8'));
    }
  });

  it('gives every doc a title and a known group', () => {
    for (const doc of HELP_DOCS) {
      expect(doc.title).not.toBe('');
      expect(HELP_GROUPS).toContain(doc.group);
    }
  });

  it('uses docs/README.md as the home doc', () => {
    expect(HOME_DOC).toBe('README.md');
    expect(getDoc(HOME_DOC)).not.toBeNull();
  });
});

describe('docTitle()', () => {
  it('returns the first level-one heading', () => {
    expect(docTitle('intro\n\n# Mappings\n\n## Sub')).toBe('Mappings');
  });

  it('returns an empty string when there is no heading', () => {
    expect(docTitle('no heading here')).toBe('');
  });
});

describe('slugify()', () => {
  it('produces GitHub-style anchors', () => {
    expect(slugify('`connect ECONNREFUSED <host>:<port>`')).toBe('connect-econnrefused-hostport');
    expect(slugify("2. HTTPS: tell the app it's behind TLS")).toBe('2-https-tell-the-app-its-behind-tls');
    expect(slugify('Trusting the CA Certificate (HTTPS)')).toBe('trusting-the-ca-certificate-https');
  });
});

describe('resolveDocLink()', () => {
  it('resolves a sibling doc', () => {
    expect(resolveDocLink('Mac.md', 'Mappings.md')).toEqual({ type: 'doc', path: 'Mappings.md', anchor: '' });
  });

  it('resolves a doc in a subfolder, with an anchor', () => {
    expect(resolveDocLink('README.md', 'frameworks/Vite.md#hot-module-replacement'))
      .toEqual({ type: 'doc', path: 'frameworks/Vite.md', anchor: 'hot-module-replacement' });
  });

  it('resolves a parent-folder link from a subfolder doc', () => {
    expect(resolveDocLink('frameworks/Rails.md', '../Frameworks.md#2-https'))
      .toEqual({ type: 'doc', path: 'Frameworks.md', anchor: '2-https' });
  });

  it('resolves an in-page anchor', () => {
    expect(resolveDocLink('Errors.md', '#no-mapping-for-hostname'))
      .toEqual({ type: 'anchor', anchor: 'no-mapping-for-hostname' });
  });

  it('sends repo files outside docs/ to GitHub', () => {
    expect(resolveDocLink('README.md', '../.github/CONTRIBUTING.md'))
      .toEqual({ type: 'external', url: `${REPO_DOCS_URL}.github/CONTRIBUTING.md` });
  });

  it('passes absolute URLs through as external', () => {
    expect(resolveDocLink('Mac.md', 'https://github.com/dfreerksen/saeng/releases'))
      .toEqual({ type: 'external', url: 'https://github.com/dfreerksen/saeng/releases' });
  });

  it('returns null for links that climb above the repo root', () => {
    expect(resolveDocLink('README.md', '../../outside.md')).toBeNull();
  });

  it('resolves every relative link in the bundled docs to a doc and an existing heading', () => {
    for (const doc of HELP_DOCS) {
      const html = renderDoc(doc.source);
      const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
      for (const href of hrefs) {
        const link = resolveDocLink(doc.path, href.replace(/&amp;/g, '&'));
        expect(link, `${doc.path} → ${href}`).not.toBeNull();
        if (link.type === 'external') continue;
        const target = link.type === 'doc' ? getDoc(link.path) : doc;
        if (link.anchor) {
          expect(renderDoc(target.source), `${doc.path} → ${href}`).toContain(`id="${link.anchor}"`);
        }
      }
    }
  });
});

describe('renderDoc()', () => {
  it('adds ids to headings', () => {
    expect(renderDoc('## Adding a Mapping')).toContain('<h2 id="adding-a-mapping">Adding a Mapping</h2>');
  });

  it('de-duplicates repeated heading ids', () => {
    const html = renderDoc('## Example\n\n## Example');
    expect(html).toContain('id="example"');
    expect(html).toContain('id="example-1"');
  });

  it('wraps tables for horizontal scrolling', () => {
    expect(renderDoc('| a | b |\n| --- | --- |\n| 1 | 2 |')).toMatch(/<div class="help-table-wrapper"><table>[\s\S]*<\/table><\/div>/);
  });

  it('escapes HTML inside inline code', () => {
    expect(renderDoc('`<host>`')).toContain('<code>&lt;host&gt;</code>');
  });
});

describe('searchDocs()', () => {
  it('returns every doc for an empty query', () => {
    expect(searchDocs('')).toBe(HELP_DOCS);
    expect(searchDocs('   ')).toBe(HELP_DOCS);
  });

  it('matches titles case-insensitively, ranking title matches first', () => {
    const results = searchDocs('django');
    expect(results[0].path).toBe('frameworks/Django.md');
    expect(results.length).toBeGreaterThan(1);
  });

  it('matches body text', () => {
    expect(searchDocs('ECONNREFUSED').map((doc) => doc.path)).toContain('Errors.md');
  });

  it('returns an empty list when nothing matches', () => {
    expect(searchDocs('zzzz-no-such-text-zzzz')).toEqual([]);
  });
});

describe('docGitHubUrl()', () => {
  it('points at the doc in the repo', () => {
    expect(docGitHubUrl('frameworks/Rails.md')).toBe(`${REPO_DOCS_URL}docs/frameworks/Rails.md`);
  });
});

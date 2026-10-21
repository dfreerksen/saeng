// In-app Help: the Markdown files in docs/ are bundled into the renderer as
// text (esbuild `--loader:.md=text`, and a matching transform in
// vitest.config.js) so the Help view works offline and always matches the
// docs shipped with this version. docs/ stays the single source of truth —
// the same files render on GitHub.
import { Marked } from 'marked';

import overviewMd from '../../../docs/README.md';
import mappingsMd from '../../../docs/Mappings.md';
import mocksMd from '../../../docs/Mocks.md';
import logsMd from '../../../docs/Logs.md';
import dashboardMd from '../../../docs/Dashboard.md';
import settingsMd from '../../../docs/Settings.md';
import privacyMd from '../../../docs/Privacy.md';
import macMd from '../../../docs/Mac.md';
import windowsMd from '../../../docs/Windows.md';
import linuxMd from '../../../docs/Linux.md';
import errorsMd from '../../../docs/Errors.md';
import troubleshootingMd from '../../../docs/Troubleshooting.md';
import frameworksMd from '../../../docs/Frameworks.md';
import angularMd from '../../../docs/frameworks/Angular.md';
import djangoMd from '../../../docs/frameworks/Django.md';
import dotNetMd from '../../../docs/frameworks/DotNet.md';
import expressMd from '../../../docs/frameworks/Express.md';
import jekyllMd from '../../../docs/frameworks/Jekyll.md';
import laravelMd from '../../../docs/frameworks/Laravel.md';
import nextJsMd from '../../../docs/frameworks/NextJS.md';
import phoenixMd from '../../../docs/frameworks/Phoenix.md';
import reactMd from '../../../docs/frameworks/React.md';
import railsMd from '../../../docs/frameworks/Rails.md';
import viteMd from '../../../docs/frameworks/Vite.md';
import vueMd from '../../../docs/frameworks/Vue.md';
import webpackMd from '../../../docs/frameworks/Webpack.md';

export const REPO_DOCS_URL = 'https://github.com/dfreerksen/saeng/blob/master/';

// Sidebar groups, in display order. Labels are i18n keys `help.group.<id>`.
export const HELP_GROUPS = ['overview', 'using', 'platform', 'troubleshooting', 'frameworks'];

// `path` is relative to docs/ and is what Markdown links between docs resolve to.
const DOC_SOURCES = [
  { path: 'README.md', group: 'overview', source: overviewMd },
  { path: 'Mappings.md', group: 'using', source: mappingsMd },
  { path: 'Mocks.md', group: 'using', source: mocksMd },
  { path: 'Logs.md', group: 'using', source: logsMd },
  { path: 'Dashboard.md', group: 'using', source: dashboardMd },
  { path: 'Settings.md', group: 'using', source: settingsMd },
  { path: 'Privacy.md', group: 'using', source: privacyMd },
  { path: 'Mac.md', group: 'platform', source: macMd },
  { path: 'Windows.md', group: 'platform', source: windowsMd },
  { path: 'Linux.md', group: 'platform', source: linuxMd },
  { path: 'Errors.md', group: 'troubleshooting', source: errorsMd },
  { path: 'Troubleshooting.md', group: 'troubleshooting', source: troubleshootingMd },
  { path: 'Frameworks.md', group: 'frameworks', source: frameworksMd },
  { path: 'frameworks/Angular.md', group: 'frameworks', source: angularMd },
  { path: 'frameworks/Django.md', group: 'frameworks', source: djangoMd },
  { path: 'frameworks/DotNet.md', group: 'frameworks', source: dotNetMd },
  { path: 'frameworks/Express.md', group: 'frameworks', source: expressMd },
  { path: 'frameworks/Jekyll.md', group: 'frameworks', source: jekyllMd },
  { path: 'frameworks/Laravel.md', group: 'frameworks', source: laravelMd },
  { path: 'frameworks/NextJS.md', group: 'frameworks', source: nextJsMd },
  { path: 'frameworks/Phoenix.md', group: 'frameworks', source: phoenixMd },
  { path: 'frameworks/React.md', group: 'frameworks', source: reactMd },
  { path: 'frameworks/Rails.md', group: 'frameworks', source: railsMd },
  { path: 'frameworks/Vite.md', group: 'frameworks', source: viteMd },
  { path: 'frameworks/Vue.md', group: 'frameworks', source: vueMd },
  { path: 'frameworks/Webpack.md', group: 'frameworks', source: webpackMd },
];

export const HOME_DOC = 'README.md';

// The first `# Heading` of a doc is its title.
export function docTitle(source) {
  const match = /^#\s+(.+)$/m.exec(source);
  return match ? match[1].trim() : '';
}

export const HELP_DOCS = DOC_SOURCES.map((doc) => ({ ...doc, title: docTitle(doc.source) }));

const DOCS_BY_PATH = new Map(HELP_DOCS.map((doc) => [doc.path, doc]));

export function getDoc(path) {
  return DOCS_BY_PATH.get(path) ?? null;
}

// GitHub-style heading anchor: lowercase, drop punctuation (keeping word
// characters, spaces and hyphens), spaces → hyphens. Matches the anchors the
// docs already link to (e.g. `#connect-econnrefused-hostport`).
export function slugify(text) {
  return String(text)
    .trim()
    .toLowerCase()
    .replace(/[^\w\- ]/g, '')
    .replace(/ /g, '-');
}

// Normalizes a POSIX-style path, resolving `.` and `..` segments. Returns
// null if the path climbs above the root.
function normalizePath(path) {
  const out = [];
  for (const part of path.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') {
      if (out.length === 0) return null;
      out.pop();
    } else {
      out.push(part);
    }
  }
  return out.join('/');
}

// Resolves an href found in the doc at `fromPath` (relative to docs/):
// - { type: 'external', url }      absolute http(s) URL, or a repo file outside docs/
// - { type: 'doc', path, anchor }  another bundled doc (anchor may be '')
// - { type: 'anchor', anchor }     a heading in the current doc
export function resolveDocLink(fromPath, href) {
  if (!href) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return { type: 'external', url: href };

  const hashIndex = href.indexOf('#');
  const target = hashIndex === -1 ? href : href.slice(0, hashIndex);
  const anchor = hashIndex === -1 ? '' : href.slice(hashIndex + 1);
  if (target === '') return { type: 'anchor', anchor };

  const fromDir = fromPath.includes('/') ? fromPath.slice(0, fromPath.lastIndexOf('/') + 1) : '';
  // Resolve relative to the repo root (docs live under docs/) so links that
  // point out of docs/ (e.g. ../.github/CONTRIBUTING.md) still resolve.
  const repoPath = normalizePath(`docs/${fromDir}${target}`);
  if (repoPath === null) return null;

  if (repoPath.startsWith('docs/')) {
    const docPath = repoPath.slice('docs/'.length);
    if (DOCS_BY_PATH.has(docPath)) return { type: 'doc', path: docPath, anchor };
  }
  return { type: 'external', url: `${REPO_DOCS_URL}${repoPath}${anchor ? `#${anchor}` : ''}` };
}

export function docGitHubUrl(path) {
  return `${REPO_DOCS_URL}docs/${path}`;
}

function escapeAttr(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

// Renders a doc's Markdown to HTML with GitHub-compatible heading ids, so
// in-doc anchors and cross-doc `Page.md#section` links can be scrolled to.
export function renderDoc(source) {
  const seen = new Map();
  const marked = new Marked({
    gfm: true,
    renderer: {
      heading({ tokens, depth, text }) {
        const base = slugify(text);
        const count = seen.get(base) ?? 0;
        seen.set(base, count + 1);
        const id = count === 0 ? base : `${base}-${count}`;
        return `<h${depth} id="${escapeAttr(id)}">${this.parser.parseInline(tokens)}</h${depth}>\n`;
      },
    },
  });
  // Wrap tables so wide ones scroll horizontally instead of overflowing.
  return marked
    .parse(source)
    .replace(/<table>/g, '<div class="help-table-wrapper"><table>')
    .replace(/<\/table>/g, '</table></div>');
}

// Case-insensitive search over doc titles and bodies. Title matches rank
// first. An empty query returns every doc.
export function searchDocs(query, docs = HELP_DOCS) {
  const q = String(query ?? '').trim().toLowerCase();
  if (!q) return docs;
  const titleMatches = [];
  const bodyMatches = [];
  for (const doc of docs) {
    if (doc.title.toLowerCase().includes(q)) titleMatches.push(doc);
    else if (doc.source.toLowerCase().includes(q)) bodyMatches.push(doc);
  }
  return [...titleMatches, ...bodyMatches];
}

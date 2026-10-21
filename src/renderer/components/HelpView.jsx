import { memo, useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useI18nT } from '../js/i18nContext.js';
import {
  HELP_DOCS,
  HELP_GROUPS,
  HOME_DOC,
  getDoc,
  renderDoc,
  resolveDocLink,
  searchDocs,
  docGitHubUrl,
} from '../js/helpDocs.js';

function findHeading(container, id) {
  if (!id) return null;
  return container.querySelector(`[id="${id.replace(/["\\]/g, '\\$&')}"]`);
}

export default memo(function HelpView({ locale }) {
  const t = useI18nT();
  // Navigation history: each entry is { path, anchor }. The last one is shown.
  const [history, setHistory] = useState([{ path: HOME_DOC, anchor: '' }]);
  const [query, setQuery] = useState('');
  const articleRef = useRef(null);

  const current = history[history.length - 1];
  const doc = getDoc(current.path) ?? getDoc(HOME_DOC);
  const html = useMemo(() => renderDoc(doc.source), [doc]);
  const results = useMemo(() => searchDocs(query), [query]);
  const isSearching = query.trim() !== '';

  // Scroll to the requested heading, or to the top when opening a doc.
  useEffect(() => {
    const article = articleRef.current;
    if (!article) return;
    const heading = findHeading(article, current.anchor);
    if (heading && typeof heading.scrollIntoView === 'function') {
      heading.scrollIntoView({ block: 'start' });
      return;
    }
    const scroller = article.closest('.content');
    if (scroller) scroller.scrollTop = 0;
  }, [current]);

  const navigate = useCallback((path, anchor = '') => {
    setHistory((prev) => [...prev, { path, anchor }]);
  }, []);

  const goBack = useCallback(() => {
    setHistory((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }, []);

  const openDoc = useCallback((path) => {
    navigate(path);
    setQuery('');
  }, [navigate]);

  // Links inside a doc: other docs and in-page anchors open here; anything
  // else opens in the system browser. Absolute http(s) links are left to
  // App's document-level external-link handler.
  const handleArticleClick = useCallback((e) => {
    const link = e.target.closest('a[href]');
    if (!link) return;
    const href = link.getAttribute('href');
    const resolved = resolveDocLink(current.path, href);
    if (resolved?.type === 'external' && /^https?:\/\//i.test(href)) return;
    e.preventDefault();
    if (!resolved) return;
    if (resolved.type === 'external') {
      window.electronAPI.app.openExternal(resolved.url);
    } else if (resolved.type === 'doc') {
      navigate(resolved.path, resolved.anchor);
    } else {
      navigate(current.path, resolved.anchor);
    }
  }, [current.path, navigate]);

  const handleOpenOnGitHub = useCallback(() => {
    window.electronAPI.app.openExternal(docGitHubUrl(doc.path));
  }, [doc.path]);

  function renderNavItem(item) {
    return (
      <li key={item.path}>
        <button
          type="button"
          className={`help-nav-item${item.path === doc.path ? ' active' : ''}`}
          lang="en"
          onClick={() => openDoc(item.path)}
        >
          {item.title}
        </button>
      </li>
    );
  }

  return (
    <div className="view active" id="view-help">
      <header className="container-fluid p-0 mb-3">
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <h4 className="m-0">
              <i className="bi bi-question-circle me-2" />
              {t('help.title')}
            </h4>
            <h6 className="subtitle">{t('help.subtitle')}</h6>
          </div>
          <div className="d-flex gap-2">
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={goBack}
              disabled={history.length < 2}
            >
              <i className="bi bi-arrow-left me-1 help-back-icon" />
              {t('help.back')}
            </button>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={handleOpenOnGitHub}>
              <i className="bi bi-github me-1" />
              {t('help.openOnGitHub')}
            </button>
          </div>
        </div>
      </header>

      {locale && locale !== 'en' && (
        <div className="help-language-note">
          <i className="bi bi-translate me-2" />
          {t('help.englishOnly')}
        </div>
      )}

      <div className="help-layout">
        <aside className="help-nav">
          <input
            type="search"
            className="form-control form-control-sm help-search"
            placeholder={t('help.search.placeholder')}
            aria-label={t('help.search.placeholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {isSearching ? (
            results.length > 0 ? (
              <ul className="help-nav-list">{results.map(renderNavItem)}</ul>
            ) : (
              <p className="help-no-results">{t('help.search.noResults')}</p>
            )
          ) : (
            HELP_GROUPS.map((group) => (
              <div key={group} className="help-nav-group">
                <div className="help-nav-group-title">{t(`help.group.${group}`)}</div>
                <ul className="help-nav-list">
                  {HELP_DOCS.filter((item) => item.group === group).map(renderNavItem)}
                </ul>
              </div>
            ))
          )}
        </aside>

        {/* Docs are bundled from this repo's docs/ folder at build time, not user input. */}
        <article
          ref={articleRef}
          className="help-doc"
          lang="en"
          dir="ltr"
          onClick={handleArticleClick}
          // eslint-disable-next-line @eslint-react/dom-no-dangerously-set-innerhtml
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  );
});

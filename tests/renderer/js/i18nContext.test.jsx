// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { I18nContext, useI18nT } from '../../../src/renderer/js/i18nContext.js';

function Probe({ vars }) {
  const t = useI18nT();
  return <span>{t('some.key', vars)}</span>;
}

describe('useI18nT()', () => {
  // The whole renderer test suite depends on this: components rendered
  // without a provider must translate key-for-key.
  it('returns an identity translator when no provider is present', () => {
    render(<Probe />);
    expect(screen.getByText('some.key')).toBeInTheDocument();
  });

  it('ignores vars without a provider (identity default takes one argument)', () => {
    render(<Probe vars={{ name: 'x' }} />);
    expect(screen.getByText('some.key')).toBeInTheDocument();
  });

  it('returns the provided translate function', () => {
    const t = (key, vars) => `${key}!${vars ? JSON.stringify(vars) : ''}`;
    render(
      <I18nContext value={t}>
        <Probe vars={{ name: 'x' }} />
      </I18nContext>
    );
    expect(screen.getByText('some.key!{"name":"x"}')).toBeInTheDocument();
  });
});

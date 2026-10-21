// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import HelpView from '../../../src/renderer/components/HelpView.jsx';

beforeEach(() => {
  window.electronAPI = { app: { openExternal: vi.fn() } };
});

function article() {
  return document.querySelector('.help-doc');
}

describe('HelpView', () => {
  it('renders the overview doc by default', () => {
    render(<HelpView locale="en" />);
    expect(article().querySelector('h1')).toHaveTextContent('Saeng Documentation');
  });

  it('lists the doc groups in the sidebar', () => {
    render(<HelpView locale="en" />);
    for (const group of ['overview', 'using', 'platform', 'troubleshooting', 'frameworks']) {
      expect(screen.getByText(`help.group.${group}`)).toBeInTheDocument();
    }
  });

  it('opens a doc from the sidebar and marks it active', () => {
    render(<HelpView locale="en" />);
    fireEvent.click(screen.getByRole('button', { name: 'Ruby on Rails' }));
    expect(article().querySelector('h1')).toHaveTextContent('Ruby on Rails');
    expect(screen.getByRole('button', { name: 'Ruby on Rails' })).toHaveClass('active');
  });

  it('follows links between docs inside the view', () => {
    render(<HelpView locale="en" />);
    fireEvent.click(article().querySelector('a[href="Errors.md"]'));
    expect(article().querySelector('h1')).toHaveTextContent('Errors');
    expect(window.electronAPI.app.openExternal).not.toHaveBeenCalled();
  });

  it('goes back to the previous doc', () => {
    render(<HelpView locale="en" />);
    const back = screen.getByText('help.back').closest('button');
    expect(back).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Errors' }));
    expect(back).not.toBeDisabled();
    fireEvent.click(back);
    expect(article().querySelector('h1')).toHaveTextContent('Saeng Documentation');
  });

  it('opens repo files outside docs/ on GitHub', () => {
    render(<HelpView locale="en" />);
    fireEvent.click(article().querySelector('a[href="../.github/CONTRIBUTING.md"]'));
    expect(window.electronAPI.app.openExternal).toHaveBeenCalledWith(
      'https://github.com/dfreerksen/saeng/blob/master/.github/CONTRIBUTING.md',
    );
  });

  it('opens the current doc on GitHub', () => {
    render(<HelpView locale="en" />);
    fireEvent.click(screen.getByRole('button', { name: 'Django' }));
    fireEvent.click(screen.getByText('help.openOnGitHub').closest('button'));
    expect(window.electronAPI.app.openExternal).toHaveBeenCalledWith(
      'https://github.com/dfreerksen/saeng/blob/master/docs/frameworks/Django.md',
    );
  });

  it('filters the sidebar by search query', () => {
    render(<HelpView locale="en" />);
    fireEvent.change(screen.getByPlaceholderText('help.search.placeholder'), { target: { value: 'jekyll' } });
    expect(screen.getByRole('button', { name: 'Jekyll' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mappings' })).not.toBeInTheDocument();
    expect(screen.queryByText('help.group.using')).not.toBeInTheDocument();
  });

  it('shows a message when the search has no results', () => {
    render(<HelpView locale="en" />);
    fireEvent.change(screen.getByPlaceholderText('help.search.placeholder'), { target: { value: 'zzzz-nothing-zzzz' } });
    expect(screen.getByText('help.search.noResults')).toBeInTheDocument();
  });

  it('clears the search after opening a result', () => {
    render(<HelpView locale="en" />);
    const search = screen.getByPlaceholderText('help.search.placeholder');
    fireEvent.change(search, { target: { value: 'jekyll' } });
    fireEvent.click(screen.getByRole('button', { name: 'Jekyll' }));
    expect(search).toHaveValue('');
    expect(article().querySelector('h1')).toHaveTextContent('Jekyll');
  });

  it('shows the English-only note for other locales', () => {
    render(<HelpView locale="fr" />);
    expect(screen.getByText('help.englishOnly')).toBeInTheDocument();
  });

  it('hides the English-only note for English', () => {
    render(<HelpView locale="en" />);
    expect(screen.queryByText('help.englishOnly')).not.toBeInTheDocument();
  });

  it('renders the article as left-to-right English', () => {
    render(<HelpView locale="ar" />);
    expect(article()).toHaveAttribute('lang', 'en');
    expect(article()).toHaveAttribute('dir', 'ltr');
  });
});

import { createContext, useContext } from 'react';

// Provides the translate function `t(key, vars)` to the component tree.
// App.jsx owns the real implementation (backed by the strings fetched over
// IPC) and provides it at the root. The default is an identity translator
// that returns the key unchanged — unit tests rendering a component without
// a provider get key-for-key output.
export const I18nContext = createContext((key) => key);

// Returns the current translate function.
export function useI18nT() {
  return useContext(I18nContext);
}

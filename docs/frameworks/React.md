# React

React itself doesn't run a dev server. The tool you start your app with does, and that's what needs to accept your Saeng domain. Find your setup below, then follow the linked guide for the details. The examples use `myapp.local`.

See [Using Saeng with your framework](../Frameworks.md) for background on each of these issues.

## Which guide applies

| How you start the app | Dev server | Guide |
| --- | --- | --- |
| `npm run dev` in a project created with `npm create vite` | Vite (port `5173`) | [Vite](Vite.md) |
| React Router v7 (framework mode) or Remix | Vite (port `5173`) | [Vite](Vite.md) |
| `next dev` | Next.js (port `3000`) | [Next.js](NextJS.md) |
| `npm start` in a Create React App project (`react-scripts`) | webpack-dev-server (port `3000`) | [webpack-dev-server](Webpack.md#allow-the-domain) |
| A custom webpack config | webpack-dev-server | [webpack-dev-server](Webpack.md) |

If you're not sure which one you have, look at the `dev` or `start` script in `package.json`.

## Quick start with Vite

For a new Vite + React project mapped as `myapp.local` → `5173`, this `vite.config.js` is usually all you need:

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',                          // Saeng connects over IPv4
    allowedHosts: ['myapp.local', '.myapp.local'],
  },
})
```

Fast Refresh (React's hot reload) goes through Vite's HMR connection. If it stops working, see [Vite → Hot module replacement](Vite.md#hot-module-replacement).

## Calling your API

A React app usually talks to a separate backend. You have two options:

- **Same domain, different path (no CORS).** Keep calling relative URLs like `/api/users`, and let the dev server forward them with Vite's `server.proxy` (or `proxy` in a Create React App `package.json`). The browser only ever talks to `myapp.local`.
- **Separate domain for the API.** Map the backend to its own Saeng domain, for example `api.myapp.local`, and point the app at it with an environment variable:

  ```sh
  # .env.development.local
  VITE_API_URL=http://api.myapp.local     # REACT_APP_API_URL for Create React App
  ```

  This is a cross-origin request, so the API needs CORS headers. See [Frameworks → CORS](../Frameworks.md#5-cross-origin-requests-cors), or the [Express](Express.md), [Laravel](Laravel.md), [Rails](Rails.md), [Django](Django.md), or [Phoenix](Phoenix.md) guide for your backend.

## Client-side routing

Routers that use the History API (`BrowserRouter`, `createBrowserRouter`) need the dev server to return `index.html` for unknown paths. Vite, Create React App, and Next.js already do this, so deep links such as `http://myapp.local/settings/profile` work through Saeng without any change.

If you serve a production build with a static server for testing, enable its single-page-app fallback (for example `npx serve -s dist`).

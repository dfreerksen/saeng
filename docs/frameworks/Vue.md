# Vue.js

How you set up Vue behind Saeng depends on the tool that runs your dev server. The examples below use `myapp.local`.

See [Using Saeng with your framework](../Frameworks.md) for background on each of these issues.

## Which guide applies

| How you start the app | Dev server | Guide |
| --- | --- | --- |
| `npm run dev` in a project created with `npm create vue` (create-vue) | Vite (port `5173`) | [Vite](Vite.md) and the quick start below |
| `nuxt dev` | Nuxt, built on Vite (port `3000`) | [Nuxt](#nuxt) below |
| `npm run serve` in a Vue CLI project (`@vue/cli-service`) | webpack-dev-server (port `8080`) | [Vue CLI](#vue-cli) below |

## Quick start with Vite (create-vue)

Map `myapp.local` → `5173` and update `vite.config.js`:

```js
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    host: '127.0.0.1',                          // Saeng connects over IPv4
    allowedHosts: ['myapp.local', '.myapp.local'],
  },
})
```

Without `allowedHosts`, Vite shows `Blocked request. This host ("myapp.local") is not allowed.` If hot reload stops working, see [Vite → Hot module replacement](Vite.md#hot-module-replacement).

## Nuxt

Map `myapp.local` → `3000`. Nuxt passes Vite options through the `vite` key in `nuxt.config.ts`:

```ts
export default defineNuxtConfig({
  devServer: {
    host: '127.0.0.1',
  },
  vite: {
    server: {
      allowedHosts: ['myapp.local', '.myapp.local'],
    },
  },
})
```

If the page loads but hot reload doesn't connect, set the HMR client options under `vite.server.hmr` as shown in [Vite → Hot module replacement](Vite.md#hot-module-replacement).

**Absolute URLs.** Server-rendered links and `useRequestURL()` use the request's `Host` header, which Saeng passes through, so they already use `myapp.local`. If you set a site URL in runtime config (for example `NUXT_PUBLIC_SITE_URL`) for SEO modules or OG tags, set it to the Saeng domain in `.env`.

## Vue CLI

Vue CLI uses webpack-dev-server, and blocked hosts show `Invalid Host header`. Map `myapp.local` → `8080` and update `vue.config.js`:

```js
const { defineConfig } = require('@vue/cli-service')

module.exports = defineConfig({
  devServer: {
    host: '127.0.0.1',
    allowedHosts: ['myapp.local', '.myapp.local'],
    client: {
      webSocketURL: 'auto://0.0.0.0:0/ws',     // hot reload through the page's own host
    },
  },
})
```

See [webpack-dev-server](Webpack.md) for more on these options.

## Calling your API

The same choices apply as for React: proxy `/api` through the dev server (`server.proxy` in Vite, `devServer.proxy` in Vue CLI) to avoid CORS, or give the API its own Saeng domain and enable CORS on it. See [React → Calling your API](React.md#calling-your-api).

# Vite

This guide covers the Vite dev server (`vite` / `npm run dev`, port `5173` by default). It also applies to frameworks built on Vite, including React, Vue, Svelte, SvelteKit, Astro, Nuxt, and Laravel's Vite integration. The examples below use `myapp.local` mapped to port `5173`.

See [Using Saeng with your framework](../Frameworks.md) for background on each of these issues.

## Make sure Saeng can connect

**Symptom:** `Saeng: backend error - connect ECONNREFUSED 127.0.0.1:5173`, even though Vite is running.

Vite listens on `localhost` by default, which newer Node.js versions may bind to IPv6 (`::1`) only. Saeng connects to `127.0.0.1`. Bind Vite to IPv4 in `vite.config.js`:

```js
export default defineConfig({
  server: {
    host: '127.0.0.1',
  },
})
```

or run `vite --host 127.0.0.1`. Alternatively, set the mapping's **Host** to `::1`.

## Allow the domain

**Symptom:** the page shows `Blocked request. This host ("myapp.local") is not allowed. To allow this host, add "myapp.local" to server.allowedHosts in vite.config.js.`

Vite 6.0.9, 5.4.12, 4.5.6, and later check the `Host` header. Add your domain:

```js
export default defineConfig({
  server: {
    host: '127.0.0.1',
    allowedHosts: ['myapp.local', '.myapp.local'], // leading dot = all subdomains
  },
})
```

`vite preview` has its own `preview.allowedHosts` option, which takes the same values.

> **Tip:** `localhost` and `*.localhost` are allowed by default, so mapping the app to `myapp.localhost` needs no configuration.

In frameworks that wrap Vite, put the same `server` block wherever that framework passes Vite options, for example `vite: { server: { ... } }` in `nuxt.config.ts` or `astro.config.mjs`. SvelteKit uses `vite.config.js` directly.

## Hot module replacement

Vite's HMR client connects back to the host and port the page was loaded from, so through Saeng it goes over the same domain and WebSocket pass-through. Usually nothing needs changing.

If the page loads but doesn't update on save, and the console shows a failed WebSocket, set the HMR connection explicitly:

```js
export default defineConfig({
  server: {
    hmr: {
      host: 'myapp.local',
      protocol: 'ws',   // 'wss' if HTTPS is enabled in Saeng
      clientPort: 80,   // 443 if HTTPS is enabled in Saeng
    },
  },
})
```

## Assets loading from `localhost:5173` (backend integrations)

When Vite is used *alongside* a backend (Laravel, Rails with Vite Ruby, Django with django-vite), the backend page may load scripts directly from `http://localhost:5173` or `http://[::1]:5173` instead of going through the Saeng domain. Over plain HTTP that works. Over HTTPS the browser blocks it as mixed content.

Point the backend integration's dev server URL at a Saeng domain instead. (For Laravel, [Laravel → Vite assets](Laravel.md#vite-assets) has the complete setup.) A common pattern is a second mapping, such as `vite.myapp.local` → `5173`, with `server.origin` set to match:

```js
export default defineConfig({
  server: {
    host: '127.0.0.1',
    allowedHosts: ['.myapp.local'],
    origin: 'https://vite.myapp.local',
    hmr: { host: 'vite.myapp.local', protocol: 'wss', clientPort: 443 },
    cors: { origin: 'https://myapp.local' },
  },
})
```

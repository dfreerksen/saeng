# Angular

The Angular CLI dev server (`ng serve`, port `4200` by default) works behind Saeng once the domain is allowed. The examples below use `myapp.local` mapped to port `4200`.

See [Using Saeng with your framework](../Frameworks.md) for background on each of these issues.

## Make sure Saeng can connect

**Symptom:** `Saeng: backend error - connect ECONNREFUSED 127.0.0.1:4200`, even though `ng serve` is running.

By default `ng serve` listens on `localhost`, which newer Node.js versions may bind to IPv6 (`::1`) only. Saeng connects to `127.0.0.1`. Start the server on IPv4 explicitly:

```sh
ng serve --host 127.0.0.1
```

Or set `"host": "127.0.0.1"` under `serve.options` in `angular.json`. Alternatively, set the mapping's **Host** to `::1`.

## Allow the domain

**Symptom:** the page shows `Blocked request. This host ("myapp.local") is not allowed.` (Angular 17 and later), or `Invalid Host header` (older, webpack-based builds).

**Angular 17 and later (`application` builder, Vite-based dev server).** Add `allowedHosts` to the serve options in `angular.json`:

```json
{
  "projects": {
    "my-app": {
      "architect": {
        "serve": {
          "options": {
            "allowedHosts": ["myapp.local", ".myapp.local"]
          }
        }
      }
    }
  }
}
```

The option is passed straight through to Vite's `server.allowedHosts`, so a leading dot allows all subdomains. Some CLI versions accept only `true` (allow any host) instead of a list. If yours rejects the list, use `"allowedHosts": true` for development.

**Older projects (`browser` builder, webpack-based dev server):**

```sh
ng serve --disable-host-check
```

or `"disableHostCheck": true` under `serve.options` in `angular.json`.

> **Tip:** mapping the app to `myapp.localhost` avoids the host check on Angular 17 and later, because `*.localhost` is allowed by default.

## Live reload

Live reload uses a WebSocket, which Saeng passes through, so it usually works without changes. If the page loads but doesn't refresh when you save:

- **Angular 17 and later:** the client connects back to the page's own host, so check the browser console for a blocked WebSocket. Allowing the host (above) fixes most cases.
- **Older webpack-based builds:** tell the client which host to use:

  ```sh
  ng serve --disable-host-check --public-host myapp.local
  ```

## Calling a backend API

If you use a `proxy.conf.json` to forward `/api` to a backend, it keeps working as before. The Angular dev server makes the proxied call itself. If your frontend calls the API on its own Saeng domain instead (for example `api.myapp.local`), that's a cross-origin request. See [Frameworks → CORS](../Frameworks.md#5-cross-origin-requests-cors).

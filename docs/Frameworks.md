# Using Saeng with your framework

Saeng doesn't change your app. It forwards each request to `host:port` unchanged, including the original `Host` header. To your dev server, the request looks like it came from a browser that went straight to `http://myapp.local`.

Most frameworks need a small amount of configuration to accept that. The same handful of issues comes up everywhere, so they're collected here. Each [framework guide](README.md#framework-guides) shows the exact setting for that framework.

## 1. Allow the domain (host allow-lists)

Many dev servers reject requests whose `Host` header isn't on an allow-list. This protects against DNS rebinding attacks. A blocked request usually looks like one of these:

| Framework | What you see |
| --- | --- |
| Rails | `Blocked hosts: myapp.local` |
| Django | `Invalid HTTP_HOST header: 'myapp.local'. You may need to add 'myapp.local' to ALLOWED_HOSTS.` |
| Vite / Angular | `Blocked request. This host ("myapp.local") is not allowed.` |
| webpack-dev-server | `Invalid Host header` |

**Fix:** add the domain to the framework's allow-list. If you use subdomains, most frameworks accept a leading dot (`.myapp.local`) or a wildcard (`*.myapp.local`) to cover all of them at once.

> **Tip:** many frameworks already allow `localhost` and `*.localhost` by default. If you map your app to a `.localhost` domain (for example `myapp.localhost`) instead of `.local`, you may not need any host configuration at all.

## 2. HTTPS: tell the app it's behind TLS

When **Enable HTTPS** is on in Settings, Saeng terminates TLS itself. The browser talks HTTPS to Saeng, but your app receives a plain HTTP request (unless the mapping's **HTTPS Backend** toggle is on). Your app therefore believes it's being served over `http://`. This causes:

- CSRF or origin check failures on form posts and `fetch` calls (the `Origin` header says `https://`, but the app thinks it's `http://`)
- Redirect loops, if the app forces SSL
- Generated URLs and redirects that point to `http://` instead of `https://`

Saeng does not add `X-Forwarded-*` headers on its own. **Fix:** add a **Request Header** to the mapping (see [Mappings → Request and Response Header Overrides](Mappings.md#request-and-response-header-overrides)):

| Name | Value |
| --- | --- |
| `X-Forwarded-Proto` | `https` |

Some frameworks honor this header automatically. Others need to be told to trust it, and the framework guides show how.

> Only add this header to mappings you actually browse over `https://`. If you visit the same mapping over `http://` as well, keep separate mappings, or leave the header off and allow the `https://` origin explicitly (Django's `CSRF_TRUSTED_ORIGINS`, for example).

## 3. CSRF and trusted origins

Even over plain HTTP, some frameworks check the `Origin` or `Referer` header against a list of trusted origins. If form posts fail with a 403 or a "CSRF verification failed" or "Origin checking failed" message, add the full origin, including the scheme (for example `https://myapp.local`), to the framework's trusted-origins setting.

## 4. Cookies across subdomains

Browsers store a cookie for the exact host that set it. If `app.myapp.local` and `api.myapp.local` need to share a session, set the session cookie domain to `.myapp.local` in your framework. Cookies marked `Secure` are only sent over HTTPS, so enable HTTPS in Saeng if your app sets secure cookies in development.

## 5. Cross-origin requests (CORS)

A frontend at `app.myapp.local` that calls `api.myapp.local` is making a cross-origin request, just like in production. Either configure CORS in your API, or use Saeng's **Response Headers** on the API mapping to inject them during development:

| Name | Value |
| --- | --- |
| `Access-Control-Allow-Origin` | `http://app.myapp.local` |
| `Access-Control-Allow-Credentials` | `true` |

Saeng's response headers are added to every response from that mapping. Preflight `OPTIONS` requests still go to your backend, so the backend has to answer them with a success status. If it doesn't, add a [mock](Mocks.md) for method `OPTIONS` and path `.*` that returns `204` with the CORS headers.

## 6. Hot reload and live reload (WebSockets)

Saeng passes WebSocket upgrades through, so hot module replacement (HMR) usually works without changes. When it doesn't, the dev server's client script is often trying to connect to a hard-coded `localhost:<port>` instead of the page's domain. The symptom is a page that loads fine but never refreshes on save, and a failed WebSocket connection in the browser console. The framework guides list the setting that controls the HMR host.

If the page is served over `https://`, HMR must connect over `wss://`. Pointing it at `ws://localhost:...` is blocked as mixed content.

## 7. Absolute URLs

Apps that build absolute URLs from a configured base URL (for example `APP_URL`, `site.url`, `default_url_options`) keep generating `localhost:3000` links until you change that setting to your Saeng domain. Relative URLs aren't affected.

## 8. Bind address

Saeng connects to `127.0.0.1` by default. If your dev server only listens on IPv6 (`::1`), or on a different interface, change the mapping's **Host**, or start the dev server on `127.0.0.1`. See [`ECONNREFUSED`](Errors.md#connect-econnrefused-hostport).

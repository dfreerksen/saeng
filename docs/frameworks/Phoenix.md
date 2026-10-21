# Phoenix

Phoenix's dev server (`mix phx.server`, `127.0.0.1:4000` by default) accepts any `Host` header, so pages load through Saeng straight away. To get the rest working, set the endpoint's URL, and check LiveView's origin check if you've changed it. The examples below use `myapp.local` mapped to port `4000`.

See [Using Saeng with your framework](../Frameworks.md) for background on each of these issues.

## Set the endpoint URL

Phoenix builds absolute URLs (`url(~p"/...")`, mailer links, redirects to external URLs) from the endpoint's `:url` config, which defaults to `localhost`. Point it at your Saeng domain in `config/dev.exs`:

```elixir
config :my_app, MyAppWeb.Endpoint,
  http: [ip: {127, 0, 0, 1}, port: 4000],
  url: [host: "myapp.local", port: 80, scheme: "http"],
  # with HTTPS enabled in Saeng:
  # url: [host: "myapp.local", port: 443, scheme: "https"],
  ...
```

`:url` only affects URLs Phoenix *generates*. The server still listens on port 4000.

## LiveView and channels (`check_origin`)

**Symptom:** LiveView pages render once and then keep reloading, or channels never connect. The server log shows `Could not check origin for Phoenix.Socket transport`.

Phoenix compares the WebSocket's `Origin` header against the endpoint's host. A newly generated app sets `check_origin: false` in `config/dev.exs`, which allows everything in development. If your config doesn't, allow the Saeng domains explicitly:

```elixir
config :my_app, MyAppWeb.Endpoint,
  check_origin: ["//myapp.local", "//*.myapp.local"]
```

The `//host` form matches both `http` and `https`.

## Live reload

`Phoenix.LiveReloader` connects to `/phoenix/live_reload/socket` on the page's own host, so it goes through Saeng's WebSocket pass-through and works without changes.

## HTTPS

With HTTPS enabled in Saeng, Phoenix receives plain HTTP. If your app checks `conn.scheme`, or you use `force_ssl`, tell Phoenix about the original scheme:

1. Add this **Request Header** to the mapping in Saeng:

   | Name | Value |
   | --- | --- |
   | `X-Forwarded-Proto` | `https` |

2. Rewrite the scheme from that header in `lib/my_app_web/endpoint.ex`, before the router:

   ```elixir
   plug Plug.RewriteOn, [:x_forwarded_proto]
   ```

Also set `scheme: "https"` and `port: 443` in the endpoint `:url` (see above), so generated URLs match.

## Sessions across subdomains

To share a session between `myapp.local` and `admin.myapp.local`, add `domain` to `@session_options` in `endpoint.ex`:

```elixir
@session_options [
  store: :cookie,
  key: "_my_app_key",
  signing_salt: "...",
  same_site: "Lax",
  domain: ".myapp.local"
]
```

## Assets

Phoenix's default asset pipeline (esbuild and Tailwind watchers) serves compiled files from the endpoint itself, so assets work through Saeng without changes. If you've switched to a Vite dev server, see [Vite](Vite.md).

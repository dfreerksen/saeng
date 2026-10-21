# Ruby on Rails

Rails' dev server (`bin/rails server`, port `3000` by default) works behind Saeng once the domain is on its host allow-list. The examples below use `myapp.local` mapped to port `3000`.

See [Using Saeng with your framework](../Frameworks.md) for background on each of these issues.

## Allow the domain

**Symptom:** a Rails error page that says `Blocked hosts: myapp.local`.

Rails 6 and later only accept requests for allowed hosts. In development, `localhost`, `*.localhost`, and IP addresses are allowed by default. Add your Saeng domain in `config/environments/development.rb`:

```ruby
Rails.application.configure do
  config.hosts << "myapp.local"

  # Or allow the domain and every subdomain (api.myapp.local, admin.myapp.local, ...)
  config.hosts << ".myapp.local"
end
```

Restart the Rails server after changing it.

> **Tip:** mapping the app to `myapp.localhost` instead of `myapp.local` works without this change, because Rails already allows `*.localhost` in development.

## HTTPS

**Symptom:** with HTTPS enabled in Saeng, forms and `fetch` calls fail with `ActionController::InvalidAuthenticityToken`. The log shows `HTTP Origin header (https://myapp.local) didn't match request.base_url (http://myapp.local)`.

Saeng terminates TLS, so Rails receives plain HTTP. Add this **Request Header** to the mapping so Rails knows the browser used HTTPS:

| Name | Value |
| --- | --- |
| `X-Forwarded-Proto` | `https` |

Rails reads `X-Forwarded-Proto` without any extra configuration. Generated URLs, redirects, and the origin check then all use `https://`. Leave `config.force_ssl` off in development. With the header set it's harmless, but without it, it causes a redirect loop.

## Action Cable and Hotwire (WebSockets)

**Symptom:** the browser console shows a failed Action Cable connection, and the Rails log says `Request origin not allowed: http://myapp.local`.

In development, Action Cable only allows `localhost` origins by default. Add yours in `config/environments/development.rb`:

```ruby
config.action_cable.allowed_request_origins = [
  %r{\Ahttps?://(.+\.)?myapp\.local\z},
  %r{\Ahttps?://localhost(:\d+)?\z}
]
```

This also covers Turbo Streams broadcasts and tools that use Action Cable for live reload.

## Sessions across subdomains

To share a login between `myapp.local` and `admin.myapp.local`, set the cookie domain in `config/initializers/session_store.rb`:

```ruby
Rails.application.config.session_store :cookie_store,
  key: "_myapp_session",
  domain: ".myapp.local"
```

## Mailer and absolute URLs

Links in emails and other absolute URLs come from `default_url_options`. Point them at the Saeng domain in `config/environments/development.rb`:

```ruby
config.action_mailer.default_url_options = { host: "myapp.local", protocol: "https" }
```

Use `protocol: "http"` if you don't have HTTPS enabled in Saeng.

## Vite Ruby, jsbundling, and asset servers

- **jsbundling-rails / cssbundling-rails / importmaps:** assets are served by Rails itself, so nothing extra is needed.
- **Vite Ruby:** by default Rails proxies asset requests to the Vite dev server, so they work behind Saeng. If HMR doesn't connect, see [Vite → Hot module replacement](Vite.md#hot-module-replacement).

# Django

Django's dev server (`python manage.py runserver`, `127.0.0.1:8000` by default) works behind Saeng once the domain is in `ALLOWED_HOSTS`. The examples below use `myapp.local` mapped to port `8000`.

See [Using Saeng with your framework](../Frameworks.md) for background on each of these issues.

## Allow the domain

**Symptom:** `400 Bad Request`, and the console shows `Invalid HTTP_HOST header: 'myapp.local'. You may need to add 'myapp.local' to ALLOWED_HOSTS.` (`DisallowedHost`).

Add the domain in `settings.py`:

```python
ALLOWED_HOSTS = [
    "myapp.local",
    ".myapp.local",  # leading dot = the domain and all its subdomains
    "localhost",
    "127.0.0.1",
]
```

> **Tip:** when `DEBUG = True` and `ALLOWED_HOSTS` is empty, Django allows `localhost`, `*.localhost`, `127.0.0.1`, and `[::1]`. Mapping the app to `myapp.localhost` works without any change, as long as you haven't set `ALLOWED_HOSTS` yourself.

## CSRF and HTTPS

**Symptom:** form posts fail with `Forbidden (403) CSRF verification failed`, and the reason given is `Origin checking failed - https://myapp.local does not match any trusted origins.`

With HTTPS enabled in Saeng, the browser sends `Origin: https://myapp.local`, but Django receives plain HTTP and expects `http://myapp.local`. There are two fixes. Use one or the other.

**Option 1 — tell Django the request is secure (recommended).** Add this **Request Header** to the mapping:

| Name | Value |
| --- | --- |
| `X-Forwarded-Proto` | `https` |

Then tell Django to trust it, in `settings.py`:

```python
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
```

`request.is_secure()` now returns `True`, `request.build_absolute_uri()` produces `https://` links, and the origin check passes.

> Only set `SECURE_PROXY_SSL_HEADER` in your development settings. In production, set it only if your real proxy strips this header from incoming requests.

**Option 2 — trust the origin explicitly.** Django 4.0 and later require the scheme:

```python
CSRF_TRUSTED_ORIGINS = [
    "https://myapp.local",
    "https://*.myapp.local",
]
```

## Sessions across subdomains

To share a login between `myapp.local` and `admin.myapp.local`:

```python
SESSION_COOKIE_DOMAIN = ".myapp.local"
CSRF_COOKIE_DOMAIN = ".myapp.local"
```

If you also set `SESSION_COOKIE_SECURE = True` or `CSRF_COOKIE_SECURE = True` in development, enable HTTPS in Saeng. Otherwise the browser won't send the cookies.

## Channels (WebSockets)

Django Channels' `AllowedHostsOriginValidator` checks the WebSocket `Origin` against `ALLOWED_HOSTS`. Once the domain is in `ALLOWED_HOSTS` as shown above, WebSocket connections work through Saeng without other changes.

## Using another server

If you run Django under `uvicorn`, `daphne`, or `gunicorn` instead of `runserver`, the same settings apply. Make sure the server is bound to `127.0.0.1` (or set the mapping's **Host** to match).

# Laravel

Laravel works behind Saeng with a few settings. The examples below use `myapp.local` mapped to `php artisan serve` (`127.0.0.1:8000`). If you use Sail, Herd, or Valet instead, map the domain to the port that tool serves on.

See [Using Saeng with your framework](../Frameworks.md) for background on each of these issues.

## Set the app URL

Laravel uses `APP_URL` for generated URLs in queued jobs, emails, Artisan commands, and the Vite integration. Set it in `.env`:

```sh
APP_URL=http://myapp.local   # https:// if HTTPS is enabled in Saeng
```

Run `php artisan config:clear` if you've cached config.

## Trusted hosts

Laravel doesn't restrict the `Host` header by default. If you've enabled the `TrustHosts` middleware, add your domain.

Laravel 11 and later, in `bootstrap/app.php`:

```php
->withMiddleware(function (Middleware $middleware) {
    $middleware->trustHosts(at: ['myapp.local', '^(.+\.)?myapp\.local$']);
})
```

Laravel 10 and earlier: return the patterns from `hosts()` in `app/Http/Middleware/TrustHosts.php`.

## HTTPS: trust the proxy

With HTTPS enabled in Saeng, Laravel receives plain HTTP. Asset URLs, `url()`, `route()`, and redirects then use `http://`, and the browser blocks them as mixed content or loops.

1. Add this **Request Header** to the mapping in Saeng:

   | Name | Value |
   | --- | --- |
   | `X-Forwarded-Proto` | `https` |

2. Trust the local proxy.

   Laravel 11 and later, in `bootstrap/app.php`:

   ```php
   ->withMiddleware(function (Middleware $middleware) {
       $middleware->trustProxies(at: '127.0.0.1');
   })
   ```

   Laravel 10 and earlier: set `protected $proxies = '127.0.0.1';` in `app/Http/Middleware/TrustProxies.php`.

`$request->secure()` is now `true`, and generated URLs use `https://`.

## Sessions and Sanctum

To share a session across subdomains, and to make Sanctum's cookie-based SPA authentication accept your frontend, set these in `.env`:

```sh
SESSION_DOMAIN=.myapp.local
SANCTUM_STATEFUL_DOMAINS=myapp.local,app.myapp.local
SESSION_SECURE_COOKIE=false   # true only if you always browse over https://
```

**Symptom:** login requests from an SPA return `419 Page Expired` or `401 Unauthenticated`. This usually means the frontend domain is missing from `SANCTUM_STATEFUL_DOMAINS`, or `SESSION_DOMAIN` doesn't cover it.

## Vite assets

**Symptom:** the page loads but has no styles or scripts, and the browser console shows mixed-content or blocked requests to `http://127.0.0.1:5173` or `http://[::1]:5173`.

In development, `@vite` makes the page load assets straight from the Vite dev server. Over plain HTTP that usually works. Over HTTPS, or when Vite rejects the origin, route Vite through its own Saeng domain as well:

1. Add a second mapping: `vite.myapp.local` → `5173`.
2. Update `vite.config.js`:

   ```js
   import { defineConfig } from 'vite'
   import laravel from 'laravel-vite-plugin'

   export default defineConfig({
     plugins: [
       laravel({ input: ['resources/css/app.css', 'resources/js/app.js'], refresh: true }),
     ],
     server: {
       host: '127.0.0.1',
       allowedHosts: ['.myapp.local'],
       cors: { origin: ['http://myapp.local', 'https://myapp.local'] },
       hmr: {
         host: 'vite.myapp.local',
         protocol: 'wss',   // 'ws' if HTTPS is off in Saeng
         clientPort: 443,   // 80 if HTTPS is off in Saeng
       },
     },
   })
   ```

3. Restart `npm run dev`. The Laravel plugin builds the asset URL from the `hmr` settings, so pages now load `https://vite.myapp.local/...` through Saeng.

See [Vite](Vite.md) for more on these options.

## Livewire and Reverb

- **Livewire** posts to `/livewire/update` on the same domain, so it works once the HTTPS setup above is in place. Without it, you may see `419` errors.
- **Reverb / WebSockets:** map a domain to Reverb's port (8080 by default, for example `ws.myapp.local` → `8080`). Then set `REVERB_HOST=ws.myapp.local`, plus `REVERB_PORT=443` and `REVERB_SCHEME=https` if you browse over HTTPS (`80`/`http` otherwise). Rebuild your frontend assets so Echo picks up the new values.

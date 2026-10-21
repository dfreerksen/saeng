# Next.js

The Next.js dev server (`next dev`, port `3000` by default) serves pages to any host, but blocks cross-origin access to its development-only resources. The examples below use `myapp.local` mapped to port `3000`.

See [Using Saeng with your framework](../Frameworks.md) for background on each of these issues.

## Allow the domain for dev resources

**Symptom:** the page loads at `http://myapp.local`, but it never becomes interactive, Fast Refresh doesn't work, or the terminal running `next dev` shows a warning about a blocked cross-origin request to `/_next/*`.

By default, the Next.js dev server only allows `localhost`, its subdomains, and the hostname it was started with to load dev assets and the HMR endpoint. Add your Saeng domain to `allowedDevOrigins` in `next.config.js` (or `next.config.ts`):

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['myapp.local', '*.myapp.local'],
}

export default nextConfig
```

Entries are bare hostnames, with no scheme or port. `*` matches exactly one subdomain level (`*.myapp.local` matches `app.myapp.local`, but not `myapp.local` itself, which is why both entries are listed). Restart `next dev` after changing it.

> **Tip:** mapping the app to `myapp.localhost` works without this setting, because `localhost` subdomains are already allowed.

## HTTPS

Next.js reads the `Host` header, which Saeng passes through unchanged, so links and redirects keep the right domain. If your code or auth library builds URLs from the protocol, add `X-Forwarded-Proto: https` as a **Request Header** on the mapping. See [Frameworks → HTTPS](../Frameworks.md#2-https-tell-the-app-its-behind-tls).

## Auth.js / NextAuth

Auth libraries compare callback URLs against a configured base URL. Set it to the Saeng domain in `.env.local`:

```sh
AUTH_URL=https://myapp.local        # NEXTAUTH_URL on NextAuth v4
AUTH_TRUST_HOST=true
```

Also add `https://myapp.local/api/auth/callback/<provider>` as an allowed redirect URL in your OAuth provider's settings.

## Server Actions

Server Actions check that the request's `Origin` matches its host. Saeng forwards the original `Host`, so they work through Saeng without extra configuration. If you call them from a *different* Saeng domain, add that domain to `experimental.serverActions.allowedOrigins`.

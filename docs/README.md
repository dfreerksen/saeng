# Saeng Documentation

Saeng is a local reverse proxy that maps custom development domains (like `myapp.local`) to localhost ports. These docs cover installing and using Saeng, fixing common problems, and getting specific frameworks to work behind it.

These docs are also built into the app. Open **Help** in Saeng's sidebar to read them offline.

## Using Saeng

- [Mappings](Mappings.md) — route a domain to a local port, header overrides, groups, wildcards, import/export
- [Mocks](Mocks.md) — return canned responses without hitting the backend
- [Logs](Logs.md) — the live request log, filtering, and HAR export
- [Dashboard](Dashboard.md) — the optional overview screen
- [Settings](Settings.md) — every setting, including HTTPS and health checks
- [Privacy](Privacy.md) — what Saeng does (and doesn't) send anywhere

## Platform setup

- [macOS](Mac.md)
- [Windows](Windows.md)
- [Linux](Linux.md)

## Errors and troubleshooting

- [Errors](Errors.md) — error messages you may see in the browser or the Logs view, what they mean, and how to fix them
- [Troubleshooting](Troubleshooting.md) — common problems that don't come with an error message

## Framework guides

Saeng forwards the request with its original `Host` header (for example `Host: myapp.local`), so most dev servers need to be told that the new domain is allowed. Start with the general guide, then check the page for your framework.

- [Using Saeng with your framework](Frameworks.md) — the issues every framework runs into (host allow-lists, HTTPS, CSRF, cookies, hot reload)
- [Angular](frameworks/Angular.md)
- [Django](frameworks/Django.md)
- [.NET](frameworks/DotNet.md) (ASP.NET Core, Blazor, and ASP.NET on IIS Express)
- [Express.js](frameworks/Express.md)
- [Jekyll](frameworks/Jekyll.md)
- [Laravel](frameworks/Laravel.md)
- [Next.js](frameworks/NextJS.md)
- [Phoenix](frameworks/Phoenix.md)
- [React](frameworks/React.md) (Vite, Create React App, React Router, Remix)
- [Ruby on Rails](frameworks/Rails.md)
- [Vite](frameworks/Vite.md) (Svelte, SvelteKit, Astro, and anything else built on Vite)
- [Vue.js](frameworks/Vue.md) (create-vue, Nuxt, Vue CLI)
- [webpack-dev-server](frameworks/Webpack.md) (custom webpack setups)

Don't see your framework? The [general guide](Frameworks.md) covers the settings to look for, and contributions of new guides are welcome (see [CONTRIBUTING](../.github/CONTRIBUTING.md)). New pages also need to be registered in `src/renderer/js/helpDocs.js` to appear in the app's Help section.

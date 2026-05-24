# Saeng

Local domain proxy manager for local development domains. Saeng means "light," "radiance," or "glow" in Thai.

Saeng routes local defined domains to localhost ports using a PAC (Proxy Auto-Config) file — no `/etc/hosts` edits, no elevated port binding, no `sudo`. Add a mapping, start the proxy, and `http://myapp.local` goes straight to your local server.

Saeng primarily works for Mac, with plans to make it work for Windows and Linux

## Features

* Map any local domain (with or without subdomain) to a local port
* Enable/disable individual mappings without removing them
* HTTPS support via a local CA certificate (with MITM SSL termination)
* WebSocket pass-through
* Start proxy automatically on launch
* System tray integration on macOS and Windows

## How it works

1. Saeng starts a local PAC file server on port `8181` and configures the OS system proxy to point to it.
2. After the domain is set up in Saeng, when a browser navigates to the local domain, the PAC file tells it to route through Saeng's HTTP proxy.
3. The proxy looks up the domain in your mappings and forwards the request to `localhost:<port>`.
4. On quit, the system proxy setting is restored.

HTTPS works by intercepting `CONNECT` tunnel requests and terminating TLS using a locally generated CA certificate. You install that CA cert into your OS trust store once; Saeng handles per-domain leaf certificates automatically.

## HTTPS setup

1. Open **Settings** and enable **Enable HTTPS (SSL termination)**.
2. Click **Install & Trust CA Certificate** and follow the system prompt.
3. Restart the proxy.
4. Enable the **HTTPS** toggle on any mapping whose backend speaks HTTPS.

> The HTTPS toggle on a mapping controls whether Saeng connects to the *backend* using HTTPS — not whether the local domain is served over HTTPS. Global HTTPS must be enabled in Settings for the browser-to-proxy leg to use TLS.

## Requirements

* Node.js >= 24.11.1
* npm >= 11.6.2
* Xcode >= 26.0 (to create build)

## Development

Install dependencies:

```bash
npm install
```

Run in development:

```bash
npm start
```

Build without creating an installer:

```bash
npm run pack
```

Build for distribution:

```bash
npm run build
```

### Tests

Run Vitest in watch mode. Good for development

```bash
$ npm test
```

Run tests with a single pass. Good for CI

```bash
$ npm run test:run
```

### ESLint

[ESLint](https://github.com/eslint/eslint) is for Javascript linting

Manually run ESLint for the repo

```bash
$ yarn run eslint .
```

### Stylelint

[Stylelint](https://github.com/stylelint/stylelint) is for SCSS linting.

Manually run Stylelint for the repo

```bash
$ yarn run stylelint "**/*.scss"
```

## License

MIT © [David Freerksen](https://github.com/dfreerksen)

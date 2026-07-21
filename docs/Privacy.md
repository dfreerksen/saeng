# Privacy

Saeng is a local proxy tool. It does not track or collect any usage data, analytics, or telemetry, and it does not send your traffic anywhere.

## What stays on your machine

- **Mappings and mocks** — your domain mappings and mock rules are stored locally in `config.json` under Electron's user data directory. They are never uploaded anywhere.
- **Request logs** — the request log (see [Logs](Logs.md)) is an in-memory ring buffer only. Entries, including captured headers and bodies when those options are enabled, are never written to disk or sent over the network. Restarting the app clears the log.
- **Proxied traffic** — requests routed through Saeng go directly from your browser, through the local proxy process, to the backend host/port you configured. Traffic never passes through any third-party or Saeng-operated server.
- **CA certificate and keys** — the root CA and per-domain certificates used for HTTPS interception (see the HTTPS/SSL section in the main documentation) are generated and stored locally in your user data directory. They are never transmitted anywhere.

## The one external call

The only network request Saeng makes to a third party is a check for newer app versions: it periodically calls the public GitHub API (`https://api.github.com/repos/dfreerksen/saeng/releases/latest`) to compare the latest published release against the version you're running. This call sends no personal data or identifiers — it's an anonymous, unauthenticated GET request — and only tells the app whether an "update available" badge should be shown in the titlebar. It happens once at startup and every 6 hours after that.

There is no other outbound network activity initiated by Saeng itself.

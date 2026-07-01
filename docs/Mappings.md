# Mappings

A mapping tells Saeng how to route a local domain to a backend service running on your machine. Each mapping pairs a domain name (e.g. `myapp.local`) with a host and port (e.g. `127.0.0.1:3000`).

## Domain Suffixes

Saeng supports the following domain suffixes:

| Suffix | Example |
|---|---|
| `.local` | `myapp.local` |
| `.test` | `myapp.test` |
| `.localhost` | `myapp.localhost` |
| `.self` | `myapp.self` |
| `.co.local` | `myapp.co.local` |
| `.co.test` | `myapp.co.test` |

The default suffix is `.local`. You can use any of the above — the PAC file handles all of them.

## Adding a Mapping

1. Open the **Mappings** view and click **Add Mapping**.
2. Fill in the form:
   - **Domain** — the full domain you want to use (e.g. `myapp.local` or `api.myapp.local`). Saeng validates the suffix.
   - **Port** — the local port your backend is listening on (e.g. `3000`).
   - **Host** *(optional)* — the backend hostname to connect to (default `127.0.0.1`). Change this if your backend is on a different machine.
   - **HTTPS Backend** — enable if your backend expects HTTPS connections (independent of the global HTTPS setting).
   - **Enable Mocks** — allow mock rules for this mapping to take effect (see [Mocks](Mocks.md)).
3. Click **Save**. The mapping is immediately active — no proxy restart required.

## Editing and Deleting

Click the **edit** (pencil) icon on any mapping row to open the edit form. Click the **delete** (trash) icon to remove the mapping. Deleting a mapping also removes all mock rules associated with it.

## Enabling and Disabling

Toggle the switch on any mapping row to enable or disable it. Disabled mappings are ignored by the PAC file and the proxy — the domain will not resolve through Saeng.

## Domain Groups

Mappings that share the same base domain (e.g. `myapp.local`, `api.myapp.local`, `admin.myapp.local`) are grouped together under a group header row. The group header shows a **toggle-all** checkbox to enable or disable all mappings in the group at once.

Within a group, the bare domain (no subdomain) appears first, followed by named subdomains in alphabetical order.

## Subdomain and Wildcard Mappings

Each subdomain must be a separate mapping entry — there is no implicit subdomain wildcard matching. If you want a mapping that applies to any subdomain, enter `*` as the subdomain prefix (e.g. `*.myapp.local`). The wildcard entry is listed last within its group.

> **Note:** Copying the URL of a wildcard mapping copies the bare base domain (`myapp.local`) rather than the literal `*.myapp.local`.

## Request and Response Header Overrides

Each mapping supports custom headers that are injected on every proxied request or response:

- **Request Headers** — added or overwritten on the outgoing request to the backend (including WebSocket upgrade requests).
- **Response Headers** — added or overwritten on the response returned to the browser.

Open the header editor in the mapping's edit form (click **Add Header**). Header names are lowercased; setting a header that already exists replaces it.

## Health Checks

When **Settings → Health Checks** is enabled, Saeng periodically opens a TCP connection to each enabled mapping's backend host and port to verify it is reachable. A colored status dot appears next to each domain in the Mappings view:

- **Green** — backend is up
- **Red** — backend is down or unreachable

Hover the dot to see the last check time and latency. See [Settings](Settings.md) for health check interval and timeout options.

## Exporting and Importing Mappings

Use the **Export** and **Import** buttons in the Mappings toolbar to save your mappings to a JSON file or restore them from one.

- **Export** — opens a save dialog. You can select which mappings to include.
- **Import** — opens a file picker. Mappings whose domain already exists in the store are skipped (no duplicates).

Exported files are portable — they can be shared between machines or imported into a fresh Saeng install.

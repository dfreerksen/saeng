# Dashboard

The Dashboard is an optional overview screen that gives you a quick summary of proxy activity, mapping health, and mock usage — all in one place.

## Enabling the Dashboard

The Dashboard is disabled by default. To turn it on, go to **Settings** and toggle **Dashboard**. Once enabled, it becomes the first item in the sidebar and the default view when the app opens.

To disable it again, toggle the setting off. If you are currently viewing the Dashboard when it is disabled, the app will redirect you to the Mappings view.

## Stat Cards

The top of the Dashboard shows at-a-glance counters:

| Card | Description |
|---|---|
| **Total Requests** | Number of requests recorded in the current log (up to the log max). Requires logging to be enabled. |
| **Error Rate** | Percentage of requests that resulted in an error. Requires logging to be enabled. |
| **Avg Latency** | Mean response time across all logged requests. Requires logging to be enabled. |
| **Domains Up / Down** | Count of backend hosts passing or failing health checks. Visible only when health checks are enabled and the proxy is running. |
| **Active Mappings** | Number of enabled vs. disabled domain mappings. |
| **Active Mocks** | Number of enabled vs. disabled mock rules. |

Cards that depend on logging or health checks are hidden when the relevant feature is off.

## Time-Series Charts

Below the stat cards, three charts show trends over the last 30 minutes, updated as new requests come in:

- **Requests per Minute** — overall request volume over time.
- **Error Rate (%)** — percentage of requests that errored, per minute.
- **Avg Latency (ms)** — mean response time per minute.

Charts require request logging to be enabled (see [Logs](Logs.md)).

## Group Breakdowns

At the bottom of the Dashboard, requests, mappings, and mocks are broken down per base domain group (e.g. `myapp.local`), so you can quickly see which domain is busiest or has the most mock rules.

## Tips

- Enable **Settings → Logging** to populate the request-based cards and charts.
- Enable **Settings → Health Checks** to show the domains up/down card.
- The Dashboard reads existing in-memory data — no extra IPC or storage is used.

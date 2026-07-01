# Mocks

Mocks let you intercept requests to a mapped domain and return a custom response — without touching the real backend. This is useful for simulating errors, testing edge cases, or developing a frontend before the API exists.

## Enabling Mocks for a Mapping

Mocks are opt-in per mapping. To allow mock rules to take effect for a domain:

1. Edit the mapping (pencil icon in Mappings view).
2. Toggle **Enable Mocks** on.
3. Save.

If **Enable Mocks** is off for a mapping, none of its mock rules will fire — even if the rules are individually enabled.

## Adding a Mock

1. Open the **Mocks** view and click **Add Mock**.
2. Fill in the form:
   - **Mapping** — choose which domain this mock applies to.
   - **Method** — the HTTP method to match (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `*` for any).
   - **Path Pattern** — a regular expression matched against the request path (not including query string). Example: `^/api/users/\d+$`.
   - **Status Code** — the HTTP status to return (100–599, default `200`).
   - **Response Body** — the body text to return. Supports template variables (see below).
   - **Response Headers** — optional headers to set on the mocked response. If no `Content-Type` header is specified, the response defaults to `text/plain; charset=utf-8`. For JSON responses, add a `Content-Type: application/json` header.
   - **Delay (ms)** — artificial delay before responding (0–30000 ms, default `0`). Useful for simulating slow networks.
3. Click **Save**.

## Path Pattern (Regex)

The **Path Pattern** is a JavaScript regular expression tested against the request path. The query string is excluded from the match.

Click the **?** help button in the mock form to open the regex help pane, which shows common examples with a copy-to-clipboard button:

| Pattern | Matches |
|---|---|
| `^/api/users$` | Exactly `/api/users` |
| `^/api/users/\d+$` | `/api/users/123`, `/api/users/456` |
| `^/api/` | Any path starting with `/api/` |
| `.*` | Every path |

If the pattern is invalid regex, the form will show an error before saving.

## Template Variables

The response body supports template variables rendered at request time. Use `{{variableName}}` syntax:

| Variable | Value |
|---|---|
| `{{timestamp}}` | Current Unix timestamp in milliseconds |
| `{{isodate}}` | Current date/time in ISO 8601 format |
| `{{uuid}}` | A randomly generated UUID v4 |
| `{{request.method}}` | The HTTP method of the incoming request |
| `{{request.path}}` | The request path |
| `{{request.url}}` | The full request URL |
| `{{request.body}}` | The raw request body |
| `{{request.host}}` | The `Host` header of the request |
| `{{request.header.<name>}}` | A specific request header (lowercased name), e.g. `{{request.header.authorization}}` |
| `{{match.<N>}}` | Capture group N from the path pattern regex match, e.g. `{{match.1}}` |

Unrecognized variables are left as-is in the output. Template rendering is skipped entirely if the body contains no `{{`.

### Example

Path pattern: `^/api/users/(\d+)$`
Response Headers: `Content-Type: application/json`
Body:
```json
{
  "id": {{match.1}},
  "timestamp": "{{isodate}}",
  "requestId": "{{uuid}}"
}
```

A request to `/api/users/42` would return:
```json
{
  "id": 42,
  "timestamp": "2025-01-15T10:30:00.000Z",
  "requestId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

## Mock Matching Order

For each request, Saeng finds the **first** enabled mock rule (in creation order) whose method and path pattern both match. Only that rule fires — later matching rules are skipped.

Every mocked response automatically includes an `x-saeng-mock: true` header, and the request log shows a **MOCK** badge on the entry.

## Mocks and WebSockets

Mocking does not apply to WebSocket upgrade requests or raw HTTPS tunnel connections (when global HTTPS is disabled). Only plain HTTP and HTTPS (post-MITM) requests are matched against mock rules.

## Enabling and Disabling Rules

Toggle the switch on any mock row to enable or disable that rule without deleting it. Disabled rules are never matched, even if the mapping has mocks enabled.

## Exporting and Importing Mocks

Use the **Export** and **Import** buttons in the Mocks toolbar to save your mock rules to a JSON file or restore them from one.

- **Export** — opens a save dialog. You can select which rules to include.
- **Import** — opens a file picker. Rules are matched to existing mappings by domain name, so they are portable across installs. Rules whose domain does not match any existing mapping are skipped.

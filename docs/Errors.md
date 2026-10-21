# Errors

When Saeng can't complete a request, it returns a `502` response with a plain-text message that starts with `Saeng:`. The same error appears in the [Logs](Logs.md) view, attached to that request. The text after the dash comes from the underlying network error.

Errors whose text doesn't start with `Saeng:` (for example `Blocked hosts`, `Invalid HTTP_HOST header`, `Invalid Host header`) come from your app or dev server, not from Saeng. See [Using Saeng with your framework](Frameworks.md).

## `connect ECONNREFUSED <host>:<port>`

**Browser message:** `Saeng: backend error - connect ECONNREFUSED <host>:<port>`

**Logs view:** 502 error with error detail `connect ECONNREFUSED <host>:<port>`

Saeng recognized the domain and attempted to proxy the request, but the local server at the target `host:port` is not running or is not accepting connections.

**Resolution:**

- Start the local server for that mapping's port, or verify the port number in the mapping is correct.
- Check which address the server is listening on. Saeng connects to `127.0.0.1` by default. A server that listens only on IPv6 `::1`, which some Node.js dev servers do when they're bound to `localhost`, refuses the connection. Either start the server on `127.0.0.1` (for example `--host 127.0.0.1`), or set the mapping's **Host** to `::1`.
- Turn on **Health Checks** in Settings to see at a glance which backends are down.

## `connect ETIMEDOUT <host>:<port>` / `connect EHOSTUNREACH <host>:<port>`

**Browser message:** `Saeng: backend error - connect ETIMEDOUT <host>:<port>`

The mapping's **Host** points to a machine that didn't answer. This usually happens when **Host** is set to another computer, a VM, or a container IP.

**Resolution:** confirm the host is reachable from your machine (for example `ping <host>` or `curl http://<host>:<port>`), that it's on the same network or VPN, and that its firewall allows the port.

## `getaddrinfo ENOTFOUND <host>`

**Browser message:** `Saeng: backend error - getaddrinfo ENOTFOUND <host>`

The mapping's **Host** is a hostname that can't be resolved. A typo is the most common cause. So is pointing **Host** at another Saeng domain, which only resolves inside the browser through the PAC file, not for Saeng itself.

**Resolution:** set **Host** to an IP address (`127.0.0.1` for your own machine) or a hostname that resolves on your system.

## `socket hang up` / `read ECONNRESET`

**Browser message:** `Saeng: backend error - socket hang up` (or `read ECONNRESET`)

The backend accepted the connection, then closed it before sending a response. Common causes:

- **The HTTPS Backend toggle doesn't match the backend.** The mapping says the backend speaks plain HTTP, but it actually expects HTTPS (or the other way around). See the next error.
- The backend crashed or restarted while handling the request. Check its own logs.
- The request took longer than the backend's own timeout.

**Resolution:** check the mapping's **HTTPS Backend** toggle, then check the backend's logs.

## `wrong version number` / `EPROTO`

**Browser message:** `Saeng: backend error - ... SSL routines ... wrong version number` (or `EPROTO`)

**HTTPS Backend** is turned on for the mapping, but the backend is a plain HTTP server, so the TLS handshake failed.

**Resolution:** turn **HTTPS Backend** off on the mapping. This toggle controls how Saeng talks to *your server*, not whether the browser uses HTTPS. HTTPS in the browser is controlled by **Settings → Enable HTTPS**. See [Mappings](Mappings.md#adding-a-mapping).

## `no mapping for <hostname>`

**Browser message:** `Saeng: no mapping for <hostname>`

Saeng decrypted an HTTPS request for a hostname that has no enabled mapping. This can happen right after a mapping is disabled or deleted, while the browser still has an open connection, or when the browser cached the PAC file from before the change.

**Resolution:** enable or re-add the mapping, or reload the page. If it persists, stop and start the proxy, or restart the browser so it re-reads the PAC file.

## `upstream error - <message>`

**Browser message:** `Saeng: upstream error - <message>`

This error only happens for requests to a domain that has **no** mapping, sent by a client configured to use Saeng directly (through `http_proxy`/`https_proxy`). Saeng tried to relay the request to the real host and that failed. The message after the dash is the network error, so use the entries above to read it (for example `ENOTFOUND` means the real domain doesn't resolve).

**Resolution:** if you meant to reach a local app, add a mapping for the domain. Otherwise this is a connectivity problem with the external site, not with Saeng.

## Browser certificate errors

**Browser message:** `NET::ERR_CERT_AUTHORITY_INVALID`, `SEC_ERROR_UNKNOWN_ISSUER`, or "Your connection is not private"

The browser doesn't trust Saeng's local CA certificate yet, or the CA was regenerated after you trusted it.

**Resolution:** trust the CA again using the steps for your platform ([macOS](Mac.md#trusting-the-ca-certificate-https), [Windows](Windows.md#trusting-the-ca-certificate-https), [Linux](Linux.md#trusting-the-ca-certificate-https)). Firefox keeps its own certificate store. See [Troubleshooting → Firefox shows certificate warnings](Troubleshooting.md#firefox-shows-certificate-warnings-but-other-browsers-dont).

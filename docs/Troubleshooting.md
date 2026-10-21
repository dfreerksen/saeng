# Troubleshooting

Common problems that don't come with a clear error message. For messages that start with `Saeng:`, see [Errors](Errors.md). For framework-specific problems, see [Using Saeng with your framework](Frameworks.md). Each platform page also has its own troubleshooting section: [macOS](Mac.md#troubleshooting), [Windows](Windows.md#troubleshooting), [Linux](Linux.md#troubleshooting).

## The domain doesn't load at all ("This site can't be reached")

The browser isn't sending the request to Saeng. Check, in order:

1. **The proxy is running.** The status in the sidebar or tray should say it's started.
2. **The mapping is enabled**, and the domain matches exactly. Subdomains need their own mapping, or a `*` wildcard mapping. See [Mappings → Subdomain and Wildcard Mappings](Mappings.md#subdomain-and-wildcard-mappings).
3. **The browser is using the system proxy.** Open `http://127.0.0.1:8181/proxy.pac` in the browser. You should see a script listing your domains. If the page loads but the domain still doesn't, the browser may be ignoring the system proxy. Firefox has its own setting under **Settings → Network Settings**, which should be **Use system proxy settings** (or set the PAC URL manually). On Linux, see [Configuring browsers manually](Linux.md#configuring-browsers-manually).
4. **Nothing else has overridden the proxy.** VPN clients and corporate security tools often replace the system proxy settings. Stop and start the proxy in Saeng to re-apply them.

## The page loads, but shows an error from my app

If the response is a "blocked host", "invalid host header", "DisallowedHost", or CSRF error, the request reached your app and your app rejected the domain. See [Using Saeng with your framework](Frameworks.md) and the guide for your framework.

## It works in the browser, but not in `curl`, scripts, or API clients

Command-line tools don't read the system PAC file. Point them at Saeng's HTTP proxy port (`8282` by default, see **Settings → Proxy**):

```sh
curl -x http://127.0.0.1:8282 http://myapp.local
```

or for a whole shell session:

```sh
export http_proxy=http://127.0.0.1:8282
export https_proxy=http://127.0.0.1:8282
```

For HTTPS, the tool also needs to trust Saeng's CA (for example `curl --cacert /path/to/ca.crt`). **Settings → Command-Line Access** walks through this for your platform.

## Firefox shows certificate warnings, but other browsers don't

Firefox can use its own certificate store instead of the operating system's. Either:

- In `about:config`, set `security.enterprise_roots.enabled` to `true` so Firefox trusts the OS store (macOS and Windows), or
- Import the CA directly: **Settings → Privacy & Security → Certificates → View Certificates → Authorities → Import**.

## Certificate warnings came back after they were working

The CA was regenerated or deleted in **Settings → SSL / HTTPS**, so the browser no longer trusts the new one. Trust the CA again. Browsers also cache certificates, so restart the browser if the warning stays.

## HTTPS works, but my app redirects in a loop or builds `http://` links

Your app thinks it's being served over plain HTTP. Add an `X-Forwarded-Proto: https` request header to the mapping. See [Frameworks → HTTPS](Frameworks.md#2-https-tell-the-app-its-behind-tls).

## Form submissions or logins fail with a 403

This is almost always a CSRF or origin check in your app. See [Frameworks → CSRF and trusted origins](Frameworks.md#3-csrf-and-trusted-origins).

## Hot reload stopped working

The page loads through Saeng, but changes don't refresh it. Open the browser console and look for a failed WebSocket connection. See [Frameworks → Hot reload](Frameworks.md#6-hot-reload-and-live-reload-websockets).

## `.local` domains are slow, or resolve to the wrong place outside the browser (macOS)

macOS reserves `.local` for Bonjour (mDNS). Tools that don't go through Saeng's proxy may try to look the name up on the local network first, which adds a delay or fails. Browsers using the PAC file aren't affected. If this gets in the way, use `.test` or `.localhost` for your mappings instead.

## Internet stopped working after Saeng quit or crashed

Saeng restores the system proxy when it quits normally, and clears leftover settings the next time it launches. If it crashed and you can't relaunch it, clear the automatic proxy configuration URL by hand. See the troubleshooting section for [macOS](Mac.md#troubleshooting), [Windows](Windows.md#troubleshooting), or [Linux](Linux.md#troubleshooting).

## Mocks aren't being returned

- Check that **Enable Mocks** is on for the mapping. Mock rules have no effect until it is.
- The path pattern is a regular expression matched against the path *without* the query string.
- The first matching rule wins, so a broader rule above may be catching the request.
- Mocks don't apply to WebSocket upgrades, or to HTTPS requests when **Enable HTTPS** is off.

Mocked responses carry an `X-Saeng-Mock: true` header and a **MOCK** badge in the Logs view, which helps you confirm whether a mock matched. See [Mocks](Mocks.md).

## Still stuck?

Turn on **Log headers** in Settings, reproduce the problem, and look at the request in the [Logs](Logs.md) view. If you think it's a bug, [open an issue](https://github.com/dfreerksen/saeng/issues) and include the request details from the log (remove any tokens or cookies first).

# webpack-dev-server

This guide covers `webpack-dev-server` v4 and later. It also applies to tools built on it, including Create React App, Vue CLI, and older Angular CLI versions (see [Angular](Angular.md)). The examples below use `myapp.local` mapped to port `8080`.

See [Using Saeng with your framework](../Frameworks.md) for background on each of these issues.

## Allow the domain

**Symptom:** the page shows only `Invalid Host header`.

Add the domain to `devServer.allowedHosts` in `webpack.config.js`:

```js
module.exports = {
  devServer: {
    host: '127.0.0.1',
    allowedHosts: ['myapp.local', '.myapp.local'], // leading dot = all subdomains
    // or allowedHosts: 'all' to skip the check entirely
  },
}
```

Setting `host` to `127.0.0.1` avoids `ECONNREFUSED` when Node.js binds `localhost` to IPv6 only. See [Errors](../Errors.md#connect-econnrefused-hostport).

**Vue CLI:** put the same `devServer` block in `vue.config.js`.

**Create React App:** you can't edit the webpack config directly, so use environment variables in `.env.development.local`:

```sh
HOST=127.0.0.1
DANGEROUSLY_DISABLE_HOST_CHECK=true
```

## Hot reload

**Symptom:** the page loads, but doesn't update on save, and the console shows a failed WebSocket connection to `ws://myapp.local:8080/ws` or `ws://localhost:8080/ws`.

Tell the client to connect back through the page's own host, port, and protocol:

```js
module.exports = {
  devServer: {
    client: {
      webSocketURL: 'auto://0.0.0.0:0/ws',
    },
  },
}
```

`auto://` uses `ws://` or `wss://` to match the page, and `0.0.0.0:0` means "use the page's host and port," so the connection goes through Saeng.

**Create React App** equivalent, in `.env.development.local`:

```sh
WDS_SOCKET_HOST=myapp.local
WDS_SOCKET_PORT=0
```

`WDS_SOCKET_PORT=0` makes the client use the page's port.

## Proxying API calls

If `devServer.proxy` forwards `/api` to a backend, it keeps working as before. The dev server makes that call itself, not the browser.

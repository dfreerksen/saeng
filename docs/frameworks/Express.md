# Express.js

Express doesn't check the `Host` header, so an Express app (`node server.js`, often on port `3000`) works behind Saeng straight away. What needs attention is HTTPS, cookies, and CORS. The examples below use `api.myapp.local` mapped to port `3000`.

See [Using Saeng with your framework](../Frameworks.md) for background on each of these issues.

## Make sure Saeng can connect

`app.listen(3000)` with no host listens on all interfaces, which Saeng can reach. If you pass a host, use `127.0.0.1` rather than `localhost`. On newer Node.js versions, `localhost` may bind to IPv6 (`::1`) only, which causes [`ECONNREFUSED`](../Errors.md#connect-econnrefused-hostport):

```js
app.listen(3000, '127.0.0.1')
```

## HTTPS: `trust proxy`

With HTTPS enabled in Saeng, the browser uses `https://`, but Express receives plain HTTP. Express then reports `req.protocol` as `http` and `req.secure` as `false`, builds `http://` redirect URLs, and won't send cookies marked `secure`.

1. Add this **Request Header** to the mapping in Saeng:

   | Name | Value |
   | --- | --- |
   | `X-Forwarded-Proto` | `https` |

2. Tell Express to trust it from the local proxy:

   ```js
   app.set('trust proxy', 'loopback')
   ```

`req.protocol` is now `https`, `req.secure` is `true`, and middleware that depends on them, such as `express-session` with `cookie.secure`, works.

## Sessions and cookies

With `express-session`, set the cookie options to match how you browse:

```js
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: 'auto',          // secure when req.secure is true (needs trust proxy)
    sameSite: 'lax',
    domain: '.myapp.local',  // only if the session must be shared with other subdomains
  },
}))
```

## CORS

If a frontend on another Saeng domain (for example `app.myapp.local`) calls this API, enable CORS with the [`cors`](https://www.npmjs.com/package/cors) package:

```js
import cors from 'cors'

app.use(cors({
  origin: ['http://app.myapp.local', 'https://app.myapp.local'],
  credentials: true, // allow cookies
}))
```

The `cors` middleware also answers the preflight `OPTIONS` requests. List exact origins, because `origin: '*'` can't be used together with `credentials: true`.

## Helmet and HSTS

[Helmet](https://helmetjs.github.io/) sends a `Strict-Transport-Security` header by default. If you browse your Saeng domain over HTTPS even once, the browser remembers it and refuses plain `http://` for that domain (and its subdomains) for months. Turn HSTS off in development:

```js
app.use(helmet({
  strictTransportSecurity: process.env.NODE_ENV === 'production',
}))
```

If a domain is already stuck on HTTPS in Chrome, clear it at `chrome://net-internals/#hsts` (under **Delete domain security policies**).

## WebSockets and Socket.IO

Saeng passes WebSocket upgrades through. Socket.IO checks the connection's origin, so add your frontend domain to its CORS settings:

```js
const io = new Server(httpServer, {
  cors: { origin: ['http://app.myapp.local', 'https://app.myapp.local'], credentials: true },
})
```

## Auto-restart tools

`nodemon`, `node --watch`, and `tsx watch` restart the server on save. During the restart, requests briefly fail with `ECONNREFUSED`. Reload the page once the server is back up.

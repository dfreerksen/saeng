# Errors

## `connect ECONNREFUSED <host>:<port>`

**Browser message:** `Saeng: backend error - connect ECONNREFUSED <host>:<port>`

**Logs view:** 502 error with error detail `connect ECONNREFUSED <host>:<port>`

Saeng recognized the domain and attempted to proxy the request, but the local server at the target `host:port` is not running or is not accepting connections.

**Resolution:** Start the local server for that mapping's port, or verify the port number in the mapping is correct.

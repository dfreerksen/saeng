# .NET (ASP.NET Core and ASP.NET)

This guide covers **ASP.NET Core** (`dotnet run` / `dotnet watch` on Kestrel, .NET 6 and later), including MVC, Razor Pages, minimal APIs, and Blazor. Older **ASP.NET on .NET Framework** projects that run under IIS Express are covered [at the end](#aspnet-on-net-framework-iis-express). The examples below use `myapp.local`.

See [Using Saeng with your framework](../Frameworks.md) for background on each of these issues.

## Pick the port to map

`dotnet run` reads its URLs from `Properties/launchSettings.json`. The default `https` profile listens on two ports, for example:

```json
"applicationUrl": "https://localhost:7123;http://localhost:5123"
```

You can map either one:

| Map to | Mapping settings | Notes |
| --- | --- | --- |
| The **http** port (`5123`) | **HTTPS Backend** off | Simplest. Read [HTTPS redirection](#https-redirection) below. |
| The **https** port (`7123`) | **HTTPS Backend** on | Saeng talks TLS to Kestrel. It accepts the .NET development certificate without you trusting it in Saeng. |

Kestrel binds `localhost` to both `127.0.0.1` and `::1`, so Saeng can connect with the default **Host** of `127.0.0.1`.

## Allowed hosts

**Symptom:** `HTTP Error 400. The request hostname is invalid.` (or `Bad Request - Invalid Hostname`).

New projects ship with `"AllowedHosts": "*"` in `appsettings.json`, which accepts any domain. If your project restricts it, add the Saeng domains. Separate entries with semicolons, and use `*.` for subdomains:

```json
{
  "AllowedHosts": "localhost;myapp.local;*.myapp.local"
}
```

Put this in `appsettings.Development.json` if you only want it during development.

## HTTPS redirection

**Symptom:** visiting `http://myapp.local` redirects to `https://myapp.local:7123` (which isn't mapped), or the log shows `Failed to determine the https port for redirect.`

Most templates call `app.UseHttpsRedirection()`. When you map the **http** port, Kestrel sees a plain HTTP request and tries to redirect to its own HTTPS port. There are two fixes. Use one or the other.

**Option 1 — browse over HTTPS through Saeng (recommended).** Enable HTTPS in Saeng, then add this **Request Header** to the mapping:

| Name | Value |
| --- | --- |
| `X-Forwarded-Proto` | `https` |

Then apply forwarded headers in `Program.cs`, before `UseHttpsRedirection()` and anything else that reads the scheme:

```csharp
using Microsoft.AspNetCore.HttpOverrides;

builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedProto;
});

var app = builder.Build();

app.UseForwardedHeaders();
app.UseHttpsRedirection();
```

`Request.IsHttps` is now `true`, so no redirect happens, and generated links, OAuth callbacks, and secure cookies all use `https://`. The loopback address Saeng connects from is trusted by default, so you don't need to list it in `KnownProxies`.

**Option 2 — skip the redirect in development.**

```csharp
if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}
```

## HSTS

`app.UseHsts()` tells browsers to always use HTTPS for a domain, for months. The templates only call it outside Development, so leave it that way. If a `.local` domain gets stuck on HTTPS in Chrome, clear it at `chrome://net-internals/#hsts`.

## Cookies and authentication

**Sharing sign-in across subdomains** (for example `myapp.local` and `admin.myapp.local`):

```csharp
builder.Services.ConfigureApplicationCookie(options =>
{
    options.Cookie.Domain = ".myapp.local";
});
```

For cookie authentication without Identity, set `options.Cookie.Domain` inside `AddCookie(...)` instead.

**Secure cookies.** ASP.NET Core Identity and antiforgery cookies are `Secure` when the request is HTTPS. If you browse over HTTPS through Saeng, use the forwarded-headers setup above so the app knows the request is HTTPS.

**External sign-in (Google, Microsoft Entra ID, and others).** The redirect URI is built from the request, so register `https://myapp.local/signin-oidc` (or your provider's callback path) with the identity provider. Without forwarded headers, the app sends an `http://` redirect URI and the provider rejects it.

## CORS

If a frontend on another Saeng domain (for example `app.myapp.local`) calls this API:

```csharp
builder.Services.AddCors(options =>
{
    options.AddPolicy("Dev", policy => policy
        .WithOrigins("http://app.myapp.local", "https://app.myapp.local")
        .AllowAnyHeader()
        .AllowAnyMethod()
        .AllowCredentials());
});

var app = builder.Build();
app.UseCors("Dev");
```

Call `UseCors` after `UseRouting` (if you call it) and before `UseAuthentication`/`UseAuthorization`.

## Hot reload and Blazor

- **`dotnet watch` browser refresh** injects a script that connects straight to a WebSocket on `localhost`, not through Saeng. That usually works as-is, because your browser can reach `localhost` directly.
- **Blazor Server** and **SignalR** use WebSockets to the page's own host, which Saeng passes through. If you restrict origins with CORS for SignalR, include your Saeng domain.
- **Blazor WebAssembly** is served as static files plus a debug proxy, so nothing extra is needed.

## SPA templates (React, Angular, Vue)

Templates that pair an ASP.NET Core API with a JavaScript frontend run two dev servers. Map the domain you browse to the frontend's dev server, and follow that frontend's guide ([React](React.md), [Angular](Angular.md), [Vue.js](Vue.md)). Keep proxying `/api` from the frontend dev server to the ASP.NET Core port, or give the API its own Saeng domain with CORS as shown above.

## ASP.NET on .NET Framework (IIS Express)

Classic ASP.NET (Web Forms, MVC 5, Web API 2) launched from Visual Studio runs under IIS Express. IIS Express only answers requests whose `Host` header matches one of its bindings, normally `localhost:<port>`. Anything else gets **`Bad Request - Invalid Hostname`**.

**Fix 1 — rewrite the Host header in Saeng (no admin rights needed).** Find the port in the project's properties (**Web → Project Url**, for example `http://localhost:44300/`). Map `myapp.local` to that port, and add this **Request Header** to the mapping:

| Name | Value |
| --- | --- |
| `Host` | `localhost:44300` |

IIS Express now accepts the request. The downside is that the app thinks it's running on `localhost`. Links and redirects it builds from the request host point to `localhost:44300`, so prefer relative URLs.

**Fix 2 — add a binding for the domain.** Edit the site in `.vs/<SolutionName>/config/applicationhost.config` and add a binding next to the `localhost` one:

```xml
<bindings>
  <binding protocol="http" bindingInformation="*:44300:localhost" />
  <binding protocol="http" bindingInformation="*:44300:myapp.local" />
</bindings>
```

Then allow non-admin use of that URL from an elevated command prompt:

```bat
netsh http add urlacl url=http://myapp.local:44300/ user=Everyone
```

Restart IIS Express. The app now sees the real `myapp.local` host. Alternatively, run Visual Studio as Administrator instead of adding the `urlacl`.

If the IIS Express project uses an SSL port (`https://localhost:443xx`), map to that port with **HTTPS Backend** on. Fix 1 works the same way, with `Host` set to `localhost:443xx`.

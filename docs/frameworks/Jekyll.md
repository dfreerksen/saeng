# Jekyll

Jekyll's dev server (`bundle exec jekyll serve`, `127.0.0.1:4000` by default) has no host allow-list, so it works behind Saeng straight away. The examples below use `mysite.local` mapped to port `4000`.

See [Using Saeng with your framework](../Frameworks.md) for background on each of these issues.

## Links point to `localhost:4000`

**Symptom:** the site loads at `http://mysite.local`, but links, canonical URLs, feeds, or `jekyll-seo-tag` output point to `http://localhost:4000`.

Anything built with `absolute_url` or `site.url` uses Jekyll's configured URL. Older Jekyll versions (3.3 to 4.1) replace `site.url` with `http://localhost:4000` whenever you run `jekyll serve`, whatever `_config.yml` says.

- **Prefer `relative_url`** in templates (`{{ "/about/" | relative_url }}`). Relative links work on any domain.
- **Set a development URL.** Create `_config.dev.yml`:

  ```yaml
  url: "http://mysite.local"
  ```

  and serve with both config files (later files override earlier ones):

  ```sh
  bundle exec jekyll serve --config _config.yml,_config.dev.yml
  ```

  If you're on an older Jekyll that still forces `localhost:4000`, upgrade, or accept `localhost` links in development.

## Live reload

**Symptom:** with `--livereload`, the page loads but doesn't refresh when you save.

Jekyll's live reload script opens a separate WebSocket on port `35729`, using the page's hostname. Saeng routes by domain, not by port, so `mysite.local:35729` is sent to the mapping's backend port (`4000`) instead of the live reload server, and the connection fails.

Workarounds:

- Use `http://localhost:4000` while you're actively editing, and `mysite.local` when you need the real domain.
- Or run without `--livereload` and refresh by hand. Jekyll still rebuilds on save.

## `baseurl`

If your site uses a `baseurl` (for example `/blog`), the site is served at `http://mysite.local/blog/`. To serve it at the root of the Saeng domain instead, set `baseurl: ""` in `_config.dev.yml`.

## HTTPS

Jekyll serves static files only, so turning on HTTPS in Saeng needs no changes to Jekyll. If you set `url` to `https://mysite.local`, use that same scheme when browsing to avoid mixed-content warnings.

# Contributing

Thanks for taking the time to contribute to Saeng!

## Getting started

1. Fork the repository and clone it locally.
2. Install dependencies: `npm install`
3. Run in development mode: `npm start`

## Development

Saeng is an Electron app using ESM throughout. The one CommonJS exception is `preload.cjs` — Electron's preload sandbox requires CommonJS regardless of the package `"type"` field.

### Build steps

The renderer assets must be compiled before the Electron process starts:

```bash
npm run sass:build   # compile SCSS → CSS
npm run js:build     # bundle renderer JS via esbuild
npm start            # runs both builds, then opens the Electron window
```

### Linting

Run ESLint for JavaScript:

```bash
npx eslint .
```

Run Stylelint for SCSS:

```bash
npx stylelint "**/*.scss"
```

Both linters run in CI on every pull request. Please ensure they pass locally before opening a PR.

## Submitting changes

- Open an issue before starting significant work so we can align on the approach first.
- Keep pull requests focused on a single change; open multiple PRs rather than one large one.
- Follow the existing code style: ESM modules, no unnecessary comments, no abstractions beyond what the task requires.
- Update documentation when behaviour changes.
- Add an entry to `CHANGELOG.md` under `## Unreleased`.

## Commit messages

Use the imperative mood and keep the subject line under 72 characters.

Good: `Add WebSocket timeout handling`  
Avoid: `Added timeout` / `Fixes stuff`

## License

By submitting a pull request you agree that your contributions will be licensed under the [MIT License](https://github.com/dfreerksen/saeng/blob/main/MIT-LICENSE).

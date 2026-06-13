---
name: deps-update
description: Audit and update Node dependencies in package.json. Use when asked to check for outdated packages, update dependencies, or run a dependency review. Runs npm outdated, groups results by major/minor/patch, then applies updates with your guidance and verifies with tests and linting.
---

Run the bundled script to see what's outdated:

```bash
node .claude/skills/deps-update/check-deps.mjs
```

It groups outdated packages into three categories:
- 🟢 **Patch** — bug fixes only; safe to update freely
- 🟡 **Minor** — new features, backwards-compatible; generally safe
- 🔴 **Major** — breaking changes likely; review changelog before updating

## Workflow

1. **Audit**: run `check-deps.mjs` to get the full picture.
2. **Review majors**: for each major bump, check the package's changelog or GitHub releases for breaking changes that affect this codebase. Note any required code changes.
3. **Update by group**: apply patch and minor updates first, then tackle majors one at a time (or skip them if breaking changes are too involved):
   ```bash
   npm update                        # applies patch + minor within semver ranges
   npm install <pkg>@latest          # for a specific major bump
   ```
4. **Verify**: after each round of updates, run:
   ```bash
   npm run lint
   npm run test:run
   ```
   If either fails, investigate before continuing.
5. **Report**: summarise what was updated, what was skipped, and why.

## Notes

- `npm update` respects the semver ranges in `package.json` (e.g. `^1.2.3` allows minor/patch but not major). To update a major version you must explicitly install `<pkg>@latest` and update the range in `package.json`.
- Electron major bumps deserve extra care — check the Electron release notes and test the built app, not just the test suite.
- `electron-builder` and `electron` versions are often coupled — if you bump one, check whether the other needs bumping too.
- After updating, run `npm install` to ensure `package-lock.json` is up to date, then commit `package.json` and `package-lock.json` together.

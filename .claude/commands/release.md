---
description: Draft a CHANGELOG entry for the current version, then commit, tag, and create a GitHub release
---

Walk through cutting a release for this version of Saeng. Follow these steps in order, and **stop to wait for explicit user go-ahead at every checkpoint** — do not chain steps together on your own judgment.

## 1. Gather the facts

- Read `version` from `package.json` — this is the release version (e.g. `1.3.0`). Do not bump it yourself; the user bumps it before invoking this command.
- Run `git status --porcelain package.json package-lock.json` to see whether the version bump is already committed or still pending.
- Find the most recent release tag: `git tag --sort=-creatordate | head -1`.
- List commits since that tag: `git log <last-tag>..HEAD --oneline`.
- Check whether `CHANGELOG.md` already has a `## [<version>]` heading — if it does, skip drafting and go straight to step 3 with the existing entry.
- Note whether `package.json`/`package-lock.json` have a pending (uncommitted) version bump — if so, it will be folded into the same commit as the changelog in step 3, rather than committed separately.

## 2. Draft the CHANGELOG entry

Match the existing format in `CHANGELOG.md` (Keep a Changelog style, used for every prior entry):

```
## [X.Y.Z] - YYYY-MM-DD

### Added

- ...

[X.Y.Z]: https://github.com/dfreerksen/saeng/releases/tag/vX.Y.Z
```

- Use today's date (from the `currentDate` system context) for `YYYY-MM-DD`.
- Group entries under `### Added` / `### Changed` / `### Fixed` / `### Removed` as appropriate — only include sections that have entries.
- Summarize the commits since the last tag in user-facing terms (skip merge commits, dependency bumps, and "Bump to vX.Y.Z" commits — those aren't user-facing changes).
- Insert the new section directly below the changelog intro/header, above the previous most-recent entry, and add the `[X.Y.Z]` link reference alongside the other version links at the bottom of the file.

**Checkpoint:** Show the user the drafted entry (or the existing one, if it was already present) and ask them to review and edit it as needed. Do not proceed until they explicitly approve the CHANGELOG.md content.

## 3. Commit the release prep

Once the user approves the CHANGELOG.md content:

- `git add CHANGELOG.md`, plus `package.json package-lock.json` if step 1 found a pending version bump.
- Commit everything together with the message `Bump to vX.Y.Z`.

(There's no need to split the version bump and changelog into separate commits — they both exist purely to prepare this release, so one commit covering both is simplest.)

## 4. Checkpoint before anything public

Before pushing, tagging, or releasing — all of which are visible to others and hard to reverse — present the user with the full plan and **wait for explicit approval**:

- The commit(s) about to be pushed (`git log origin/<branch>..HEAD --oneline`).
- The tag name to be created: `vX.Y.Z`.
- The release title (`Saeng vX.Y.Z`) and body (the CHANGELOG section for this version, with the `## [X.Y.Z] - ...` heading and link reference stripped — just the prose/bullet content).

## 5. Push, tag, and release

Only after explicit approval from step 4:

- First confirm `gh` is ready: `command -v gh` and `gh auth status`. If either fails, stop and tell the user to run `brew install gh && gh auth login` first — do not fall back to raw `git push` (the repo uses an HTTPS remote with credentials that can go stale; `gh` is the supported path).
- Run `gh auth setup-git` so git's push/tag operations authenticate through `gh`'s stored token rather than a separate git credential helper.
- Push the commit(s): `git push`.
- Create and push an annotated tag: `git tag -a vX.Y.Z -m "vX.Y.Z"` then `git push origin vX.Y.Z`.
- Create the release: `gh release create vX.Y.Z --title "Saeng vX.Y.Z" --notes "<changelog body for this version>"`.

Note: publishing the GitHub release triggers `.github/workflows/release.yml`, which builds and uploads the macOS/Windows/Linux distributables — so this is the step that kicks off the real release build.

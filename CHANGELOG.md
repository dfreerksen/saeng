# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.10.0] - 2026-06-12

### Added

- Mock response rules: return a canned status code, headers, and body for requests matching a method and path pattern, without hitting the backend
- New "Mocks" view to add, edit, remove, export, and import mock rules, with a path-pattern regex help reference
- Per-mapping "Enable mocking for this domain" toggle to control whether mock rules apply
- Request log shows a "MOCK" badge for mocked responses, and HAR exports mark them with `_mocked: true`

[1.10.0]: https://github.com/dfreerksen/saeng/releases/tag/v1.10.0

## [1.9.0] - 2026-06-11

### Added

- Live request log can optionally capture request/response headers and bodies (up to 64 KB each), viewable in an expandable details row per entry
- Export the request log as a HAR file for use with browser dev tools or other HTTP debugging tools
- Window size is now remembered between launches

[1.9.0]: https://github.com/dfreerksen/saeng/releases/tag/v1.9.0

## [1.8.0] - 2026-06-11

### Added

- Custom request/response headers per mapping, for injecting CORS headers, auth tokens, or other headers during local development

[1.8.0]: https://github.com/dfreerksen/saeng/releases/tag/v1.8.0

## [1.7.0] - 2026-06-11

### Added

- Automatic update check that periodically polls GitHub for newer releases, showing an "Update Available" badge in the titlebar that links to the release on GitHub

[1.7.0]: https://github.com/dfreerksen/saeng/releases/tag/v1.7.0

## [1.6.1] - 2026-06-11

### Changed

- Reorganized translation keys for consistency and completeness across all 15 supported languages
- Mappings table now sorts wildcard (`*`) subdomain entries after named/numeric subdomains within each domain group

### Fixed

- Copying a wildcard mapping's domain now copies the base domain (e.g. `myapp.local`) instead of the literal `*.myapp.local`

[1.6.1]: https://github.com/dfreerksen/saeng/releases/tag/v1.6.1

## [1.6.0] - 2026-06-10

### Added

- Optional health checks for backend mappings — periodically probes each enabled mapping's host and port, showing a live status indicator (up/down) in the mappings table, with configurable check interval and timeout in Settings

[1.6.0]: https://github.com/dfreerksen/saeng/releases/tag/v1.6.0

## [1.5.0] - 2026-06-09

### Added

- Mappings table now groups entries by base domain, with a group-level toggle to enable/disable all mappings in a group at once

### Changed

- Domain and subdomain inputs are automatically lowercased

### Removed

- The optional "Label" field for mappings (superseded by domain grouping)

[1.5.0]: https://github.com/dfreerksen/saeng/releases/tag/v1.5.0

## [1.4.0] - 2026-06-09

### Added

- Subdomain wildcard support — a single mapping now covers all subdomains of a configured domain

[1.4.0]: https://github.com/dfreerksen/saeng/releases/tag/v1.4.0

## [1.3.1] - 2026-06-08

### Added

- Add `/release` command to streamline cutting releases

### Changed

- Document the release process in the README

[1.3.1]: https://github.com/dfreerksen/saeng/releases/tag/v1.3.1

## [1.3.0] - 2026-06-08

### Added

- Added import/export of Mappings 

[1.3.0]: https://github.com/dfreerksen/saeng/releases/tag/v1.3.0

## [1.2.1] - 2026-06-07

### Changed

- Add reason for error to log when error happens

[1.2.1]: https://github.com/dfreerksen/saeng/releases/tag/v1.2.1

## [1.2.0] - 2026-06-07

### Added

- Request Log

[1.2.0]: https://github.com/dfreerksen/saeng/releases/tag/v1.2.0

## [1.1.0] - 2026-05-25

### Changed

- Switch to React

[1.1.0]: https://github.com/dfreerksen/saeng/releases/tag/v1.1.0

## [1.0.0] - 2026-05-24

### Added

- First release

[1.0.0]: https://github.com/dfreerksen/saeng/releases/tag/v1.0.0

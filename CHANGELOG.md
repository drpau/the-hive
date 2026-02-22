# Changelog

All notable changes to The Hive will be documented in this file.

## [1.0.4] - 2026-02-22

### Changed
- Documentation updates now happen automatically as part of feature workflows (not separate)
- Reviewing phase includes documentation update for bugfix, improvement, and security workflows
- Removed Docs Update button and workflow

### Removed
- Separate Docs Update workflow (docs now updated in reviewing phase)

## [1.0.3] - 2026-02-22

### Added
- Docs Update workflow (research → updating → reviewing)
- CONTRIBUTING.md with documentation rule
- Documentation update workflow button in dashboard
- Docs workflow type in worker

## [1.0.2] - 2026-02-22

### Added
- README documentation for workflow types, breaking changes, and versioning

## [1.0.1] - 2026-02-22

### Added
- Breaking change checkbox in each workflow modal (bug, idea, security)
- Release button with version bump options (major/minor/patch)
- Version tracking with VERSION.json
- Automatic GitHub release workflow

### Changed
- Updated GitHub release action to use softprops/action-gh-release

## [1.0.0] - 2026-02-22

### Added
- Security workflow with phases: scanning → analysis → remediation → reviewing
- Improvement workflow with phases: research → design → implementing → verifying → testing → reviewing
- Bugfix workflow with phases: planning → setup → implementing → verifying → testing → security → reviewing
- Dashboard button for Security Review
- Real-time agent output logging to API
- Auto-close GitHub issues after PR is merged
- GitHub issue polling (auto-detect new issues)
- Dashboard with bug reporting and idea submission
- Configuration guide (CONFIG.md)

### Fixed
- Skip cloning if repo already exists
- Use ES module imports
- Route ordering (API routes before SPA fallback)
- Workflow type stored in database

## [0.1.0] - 2026-02-20

### Added
- Initial release
- Dashboard with workflow management
- Worker that runs AI agents through phases
- WebSocket real-time updates
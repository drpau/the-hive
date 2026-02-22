# Contributing to The Hive

Thank you for your interest in contributing to The Hive!

## Development Process

### Workflow Types

| Type | Use For | Release Impact |
|------|---------|----------------|
| Bug Fix | Fixing bugs, errors | Patch |
| Improvement | New features, enhancements | Minor |
| Security | Security audits, vulnerability fixes | Patch |
| Docs Update | Documentation changes | Patch |

### Breaking Changes

If your change introduces a breaking change (incompatible API change, removed features, etc.), check the "This is a breaking change" box in the workflow modal. This will trigger a major version bump.

## Release Process

The Hive uses [Semantic Versioning](https://semver.org/):

- **Patch** (1.0.0 → 1.0.1) - Bug fixes, docs updates, non-breaking improvements
- **Minor** (1.0.0 → 1.1.0) - New features, backwards-compatible
- **Major** (1.0.0 → 2.0.0) - Breaking changes

### Version File

Update `VERSION.json` with:
- New version number
- Release type
- List of changes

### Changelog

Update `CHANGELOG.md` with a description of changes under the new version header.

## Documentation Rule

**All changes that impact usage MUST update documentation.**

This includes:
- New features or workflow types
- Changed workflow phases
- New configuration options
- Modified API endpoints
- Updated prerequisites or setup steps

When creating a workflow that changes how users interact with The Hive, either:
1. Update the relevant docs (README.md, CONFIG.md) directly, OR
2. Create a Docs Update workflow to handle documentation separately

## Pull Requests

1. Create a branch for your feature/fix
2. Make your changes
3. Update documentation if needed
4. Push and create a PR
5. The version will be bumped and a release created automatically when VERSION.json is updated
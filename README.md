# 🐝 The Hive

Autonomous AI workflow orchestration with dashboard - inspired by Antfarm but built for reliability.

## Features

- 📊 **Dashboard** - Visual interface for monitoring workflow progress
- 🤖 **Autonomous Agents** - Multiple agents working in parallel
- 📈 **Real-time Updates** - WebSocket-powered live updates
- 🔄 **Workflow Phases** - Planning → Setup → Implementation → Verification → Testing → Review
- 🔗 **GitHub Integration** - Automatic issue detection and PR creation
- 🐛 **Bug Reporting** - Report bugs directly from dashboard
- 👁️ **GitHub Issue Polling** - Auto-detect new issues on linked repos

## Architecture

```
┌─────────────────────────────────────────┐
│           The Hive Dashboard            │
│         (HTML + WebSocket)              │
└─────────────┬───────────────────────────┘
              │
┌─────────────▼───────────────────────────┐
│           The Hive API                  │
│         (Express + SQLite)             │
└─────────────┬───────────────────────────┘
              │
┌─────────────▼───────────────────────────┐
│          Hive Worker                    │
│    (Autonomous Agent Orchestrator)      │
└─────────────┬───────────────────────────┘
              │
     ┌────────▼────────┐
     │   OpenClaw     │
     │ sessions_spawn  │
     └─────────────────┘
```

## Prerequisites

1. **OpenClaw** - The Hive uses OpenClaw to run AI agents
2. **Node.js** - v18 or higher
3. **GitHub CLI (`gh`)** - For GitHub issue polling and PR creation
4. **OpenRouter API Key** - For AI model access

## Setup

### 1. Install Dependencies

```bash
cd the-hive
npm install
```

### 2. Configure OpenClaw

The Hive requires OpenClaw to be installed and configured with an AI provider:

```bash
# Run OpenClaw setup
openclaw configure

# Or set up manually by configuring your openclaw.json with:
# - API keys for your AI provider (OpenRouter, Anthropic, OpenAI, etc.)
# - Model preferences
```

### 3. Authenticate with GitHub

```bash
# Login to GitHub CLI
gh auth login

# Required scopes: repo, read:org
```

### 4. Start The Hive

```bash
# Start the API server (one terminal)
npm start

# Start the worker (another terminal)
npm run worker

# Open dashboard
# Visit http://localhost:3334
```

## Usage

### Creating a Workflow

1. Enter a task description (e.g., "create a hello world website")
2. Enter a GitHub repository URL (optional) - will be cloned automatically
3. Click "Start"

The Hive will:
- Clone the repository if a GitHub URL is provided
- Plan the task into user stories
- Set up the development environment
- Implement the solution
- Verify and test
- Create a pull request

### Reporting Bugs

1. Click "Report Bug" on the dashboard
2. Enter the GitHub repository URL
3. Describe the bug
4. Click "Create Fix Workflow"

The Hive will create a bugfix workflow.

### GitHub Issue Polling

The linked Hive automatically polls GitHub repositories for new issues every 60 seconds and creates fix workflows automatically.

### Workflow Types

The Hive supports three workflow types:

| Type | Button | Phases | Default Release |
|------|--------|--------|-----------------|
| Bug Fix | 🐛 Report Bug | planning → setup → implementing → verifying → testing → security → reviewing | Patch |
| Improvement | 💡 Submit Idea | research → design → implementing → verifying → testing → reviewing | Minor |
| Security | 🔒 Security Review | scanning → analysis → remediation → reviewing | Patch |

### Breaking Changes

Each workflow modal has a "This is a breaking change" checkbox:
- When checked, it marks the workflow as a breaking change
- Breaking changes trigger **major** releases (e.g., 1.0.0 → 2.0.0)
- Non-breaking changes trigger patch or minor releases based on workflow type

### Version & Releases

The Hive uses [Semantic Versioning](https://semver.org/):
- **Patch** (1.0.0 → 1.0.1) - Bug fixes
- **Minor** (1.0.0 → 1.1.0) - New features
- **Major** (1.0.0 → 2.0.0) - Breaking changes

Version is tracked in `VERSION.json` and releases are created automatically via GitHub Actions when VERSION.json is updated.

## API

### Workflows

- `GET /api/workflows` - List all workflows
- `POST /api/workflows` - Create new workflow
- `GET /api/workflows/:id` - Get workflow details
- `PATCH /api/workflows/:id` - Update workflow
- `DELETE /api/workflows/:id` - Delete workflow

### Agents

- `GET /api/agents` - List all agents
- `POST /api/agents/:id/status` - Update agent status
- `POST /api/agents/:id/heartbeat` - Agent heartbeat

## Configuration

Environment variables:
- `PORT` - API server port (default: 3334)
- `HIVE_DB` - SQLite database path

## Troubleshooting

### "Failed to create workflow" - Database error
```bash
# Fix database permissions
chmod 777 the-hive
chmod 666 the-hive/the-hive.db
```

### GitHub issues not being detected
```bash
# Ensure GitHub CLI is authenticated
gh auth status

# Re-authenticate if needed
gh auth login
```

### Agent tasks failing
```bash
# Check OpenClaw configuration
openclaw config get

# Test agent directly
openclaw agent --session-id test --message "hello"
```

## License

MIT

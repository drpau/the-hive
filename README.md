# 🐝 The Hive

Autonomous AI workflow orchestration with dashboard - inspired by Antfarm but built for reliability.

## Features

- 📊 **Dashboard** - Visual interface for monitoring workflow progress
- 🤖 **Autonomous Agents** - Multiple agents working in parallel
- 📈 **Real-time Updates** - WebSocket-powered live updates
- 🔄 **Workflow Phases** - Planning → Setup → Implementation → Verification → Testing → Review
- 🔗 **GitHub Integration** - Automatic PR creation

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

## Quick Start

```bash
# Install dependencies
cd the-hive
npm install

# Start the API server
npm start

# In another terminal, start the worker
npm run worker

# Open dashboard
# Visit http://localhost:3334
```

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

## License

MIT

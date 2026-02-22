# 🐝 The Hive - Configuration

## Environment Variables

```bash
# API Server
PORT=3334                    # API server port (default: 3334)
HIVE_DB=./the-hive.db       # SQLite database path

# Worker
API_BASE=http://localhost:3334  # API base URL
WORKER_MODEL=openrouter/minimax/minimax-m2.5  # AI model to use
GITHUB_TOKEN=ghp_xxx         # GitHub token (optional, uses gh CLI if not set)
```

## Configuration File

Create `config.json` in the hive directory:

```json
{
  "model": {
    "provider": "openrouter",
    "model": "openrouter/minimax/minimax-m2.5",
    "apiKey": "your-api-key"
  },
  "phases": {
    "planning": {
      "enabled": true,
      "prompt": "custom prompt here..."
    },
    "setup": {
      "enabled": true,
      "prompt": "custom prompt here..."
    }
  },
  "github": {
    "autoCloseIssues": true,
    "autoMergePrs": false
  }
}
```

## Customizing Phase Prompts

Each phase can be customized by editing `src/workers/hive.js`. The `PHASES` object contains all prompt templates:

```javascript
const PHASES = {
  planning: {
    prompt: (task, repo, runId) => `You are a task planner...
    
    Task: ${task}
    Repository: ${repo}
    Workspace: ${runId}
    
    [Your custom instructions]
    
    Reply:
    STATUS: done
    STORIES:
    1. [Story description]`
  },
  // ... other phases
};
```

### Available Variables

- `${task}` - The original task description
- `${repo}` - Repository URL or local path
- `${runId}` - Unique workflow ID (also used as workspace folder name)

### Response Format

Each phase expects a specific response format:

- **Planning**: `STATUS: done` + `STORIES:` list
- **Setup**: `STATUS: done` + `FINDINGS:` description
- **Implementing**: `STATUS: done` + `CHANGES:` summary
- **Verifying**: `STATUS: done` + `VERIFIED: yes/no` + `ISSUES:` (if any)
- **Testing**: `STATUS: done` + `TESTS: pass/fail` + `DETAILS:` results
- **Reviewing**: `STATUS: done` + `PR_URL:` link + `ISSUE_CLOSED: yes/no`

## Using Local Models

### Ollama

```bash
# Install Ollama
curl -fsSL https://ollama.com/install | sh
ollama serve &
ollama pull codellama

# Update worker to use local model
# Edit src/workers/hive.js, change:
const cmd = 'openclaw';
const args = ['agent', '--session-id', sessionId, '--message', prompt, '--model', 'ollama/codellama', ...];
```

### LM Studio

```bash
# Download LM Studio and start local server
# Update model config to point to localhost
```

## Security Best Practices

1. **Never commit API keys** - Use environment variables
2. **GitHub tokens** - Use fine-grained tokens with minimal permissions
3. **Workspace isolation** - Each workflow gets its own workspace folder
4. **Review before merging** - Always review PRs before merging

## Troubleshooting

### Worker not picking up workflows
- Check worker is running: `ps aux | grep hive`
- Check API is running: `lsof -i :3334`
- Check logs: Look for error messages in worker output

### GitHub issues not detected
- Ensure `gh auth login` has been run
- Check token has `repo` scope

### Model errors
- Verify API key is set correctly
- Check model name is valid for your provider

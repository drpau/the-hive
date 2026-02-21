// The Hive - Worker (Autonomous Agent Orchestration)
// Uses OpenClaw's native cron system to run agents
import { Workflows, Agents, Logs, Config } from '../lib/hive.js';
import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import fetch from 'node-fetch';

const WORKER_ID = `hive-worker-${process.pid}`;
const API_BASE = process.env.API_BASE || 'http://localhost:3334';

// Register this worker
Agents.register(WORKER_ID, 'hive-worker');

console.log(`Hive Worker ${WORKER_ID} starting...`);

// Helper to call API (triggers broadcasts)
async function apiCall(endpoint, method = 'GET', body = null) {
  const options = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) options.body = JSON.stringify(body);
  const res = await fetch(`${API_BASE}${endpoint}`, options);
  return res.json();
}

// Workflow phases and their prompts
const PHASES = {
  planning: {
    prompt: (task, repo, runId) => `You are a task planner. Decompose this task into ordered user stories.

Task: ${task}
Repository: ${repo}

Analyze the task and break it down into small, achievable user stories. Each story should be testable and independently implementable.

Reply in this format:
STATUS: done
STORIES:
1. [Story description]
2. [Story description]
...`
  },
  setup: {
    prompt: (task, repo, runId) => `You are a devops engineer. Prepare the development environment.

Task: ${task}
Repository: ${repo}

1. If repository looks like a GitHub URL (contains github.com), clone it to /home/ubuntu/the-hive/workspaces/${runId}
2. If it's a local path that doesn't exist, report error
3. If it exists, check if build/test setup exists (package.json, Makefile, etc.)
4. Run any setup commands (npm install, pip install, etc.)
5. Run baseline tests if available
6. Report your findings

Reply:
STATUS: done
FINDINGS: [what you found]`
  },
  implementing: {
    prompt: (task, repo, runId) => `You are a software developer. Implement the task.

Task: ${task}
Repository: ${repo}

Make small, incremental commits. Focus on getting something working first, then refine.

Reply:
STATUS: done
CHANGES: [summary of changes made]`
  },
  verifying: {
    prompt: (task, repo, runId) => `You are a QA engineer. Verify the implementation.

Task: ${task}
Repository: ${repo}

1. Verify the implementation against requirements
2. Check all acceptance criteria
3. Report any issues

Reply:
STATUS: done
VERIFIED: yes/no
ISSUES: [any issues found]`
  },
  testing: {
    prompt: (task, repo, runId) => `You are a tester. Run tests.

Task: ${task}
Repository: ${repo}

Run tests and report results.

Reply:
STATUS: done
TESTS: pass/fail
DETAILS: [test results]`
  },
  reviewing: {
    prompt: (task, repo, runId) => `You are a code reviewer. Create a PR.

Task: ${task}
Repository: ${repo}

1. Make sure changes are committed
2. Create a pull request with good description
3. Include testing instructions

Reply:
STATUS: done
PR_URL: [link to PR or "none if not pushed"]`
  }
};

const PHASE_ORDER = ['planning', 'setup', 'implementing', 'verifying', 'testing', 'reviewing'];

// Get next phase
function getNextPhase(currentPhase) {
  const idx = PHASE_ORDER.indexOf(currentPhase);
  if (idx < 0 || idx >= PHASE_ORDER.length - 1) return null;
  return PHASE_ORDER[idx + 1];
}

// Run an agent task
async function runAgentTask(workflow, phase) {
  const phaseInfo = PHASES[phase];
  if (!phaseInfo) return { ok: false, error: 'Unknown phase' };
  
  let repo = workflow.repo;
  
  // If it's a GitHub URL, clone it first
  if (repo && repo.includes('github.com')) {
    console.log(`Detected GitHub URL, cloning repo: ${repo}`);
    const workspaceDir = `/home/ubuntu/the-hive/workspaces/${workflow.id}`;
    
    try {
      // Extract owner/repo from URL
      const match = repo.match(/github\.com[/:]([\w-]+)\/([\w-]+)/);
      if (match) {
        const ghRepo = `https://github.com/${match[1]}/${match[2]}.git`;
        
        // Clone the repo
        await new Promise((resolve, reject) => {
          const proc = spawn('/usr/bin/git', ['clone', '--depth', '1', ghRepo, workflow.id], {
            cwd: '/home/ubuntu/the-hive/workspaces',
            stdio: 'inherit'
          });
          proc.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`git clone failed with code ${code}`));
          });
        });
        
        repo = workspaceDir;
        console.log(`Cloned to ${repo}`);
      }
    } catch (err) {
      return { ok: false, error: `Failed to clone repo: ${err.message}` };
    }
  }
  
  const prompt = phaseInfo.prompt(workflow.task, repo, workflow.id);
  const sessionId = `hive-${workflow.id}-${phase}-${Date.now()}`;
  
  console.log(`Running ${phase} phase for workflow ${workflow.id}`);
  console.log(`Prompt: ${prompt.substring(0, 100)}...`);
  
  return new Promise((resolve) => {
    // Use openclaw agent with unique session ID to avoid locking main session
    const cmd = 'openclaw';
    const args = [
      'agent',
      '--session-id', sessionId,
      '--message', prompt,
      '--thinking', 'medium',
      '--timeout', '300'
    ];
    
    console.log(`Running: ${cmd} ${args.join(' ')}`);
    
    const proc = spawn(cmd, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env }
    });
    
    let stdout = '';
    let stderr = '';
    
    proc.stdout.on('data', (data) => {
      const text = data.toString();
      stdout += text;
      // Also log to console
      process.stdout.write(`[agent] ${text}`);
    });
    
    proc.stderr.on('data', (data) => {
      const text = data.toString();
      stderr += text;
      process.stderr.write(`[agent error] ${text}`);
    });
    
    proc.on('close', (code) => {
      console.log(`Agent exited with code ${code}`);
      if (code === 0 || stdout.includes('STATUS: done')) {
        resolve({ ok: true, output: stdout, error: null });
      } else {
        resolve({ ok: false, output: stdout, error: stderr || `Exit code ${code}` });
      }
    });
    
    // Timeout after 5 minutes
    setTimeout(() => {
      proc.kill();
      resolve({ ok: false, output: stdout, error: 'Timeout after 5 minutes' });
    }, 300000);
  });
}

// Process a workflow
async function processWorkflow(workflow) {
  const phase = workflow.phase;
  
  if (phase === 'done' || workflow.status === 'complete') {
    console.log(`Workflow ${workflow.id} already complete`);
    return;
  }
  
  const phaseInfo = PHASES[phase];
  if (!phaseInfo) {
    console.log(`Unknown phase: ${phase} for workflow ${workflow.id}`);
    return;
  }
  
  console.log(`Processing workflow ${workflow.id} - phase: ${phase}`);
  
  // Use API (triggers WebSocket broadcast) - only if not already running
  if (workflow.status !== 'running') {
    await apiCall(`/api/workflows/${workflow.id}`, 'PATCH', { status: 'running' });
  }
  await apiCall('/api/logs', 'POST', { 
    workflowId: workflow.id, 
    agentId: 'hive-runner', 
    message: `Starting ${phase} phase`,
    level: 'info'
  });
  
  try {
    const result = await runAgentTask(workflow, phase);
    
    // Store output in logs
    if (result.output) {
      await apiCall('/api/logs', 'POST', { 
        workflowId: workflow.id, 
        agentId: 'hive-runner', 
        message: `Output: ${result.output.substring(0, 500)}`,
        level: 'info'
      });
    }
    
    if (result.ok) {
      await apiCall('/api/logs', 'POST', { 
        workflowId: workflow.id, 
        agentId: 'hive-runner', 
        message: `Completed ${phase} phase`,
        level: 'info'
      });
      
      const nextPhase = getNextPhase(phase);
      if (nextPhase) {
        await apiCall(`/api/workflows/${workflow.id}`, 'PATCH', { 
          phase: nextPhase,
          status: 'pending'
        });
        await apiCall('/api/logs', 'POST', { 
          workflowId: workflow.id, 
          agentId: 'hive-runner', 
          message: `Advanced to ${nextPhase} phase`,
          level: 'info'
        });
      } else {
        await apiCall(`/api/workflows/${workflow.id}`, 'PATCH', { 
          status: 'complete',
          phase: 'done'
        });
        await apiCall('/api/logs', 'POST', { 
          workflowId: workflow.id, 
          agentId: 'hive-runner', 
          message: 'Workflow complete!',
          level: 'info'
        });
      }
    } else {
      await apiCall('/api/logs', 'POST', { 
        workflowId: workflow.id, 
        agentId: 'hive-runner', 
        message: `Error: ${result.error}`,
        level: 'error'
      });
      await apiCall(`/api/workflows/${workflow.id}`, 'PATCH', { status: 'failed' });
    }
  } catch (err) {
    await apiCall('/api/logs', 'POST', { 
      workflowId: workflow.id, 
      agentId: 'hive-runner', 
      message: `Exception: ${err.message}`,
      level: 'error'
    });
    await apiCall(`/api/workflows/${workflow.id}`, 'PATCH', { status: 'failed' });
  }
  
  // Update agent status
  await apiCall('/api/agents/hive-runner/status', 'POST', { status: 'idle' });
}

// GitHub Issue Polling
const trackedRepos = new Set();
let lastIssueCheck = Date.now();

async function pollGitHubIssues() {
  console.log('Checking GitHub for new issues...');
  
  try {
    const workflows = await apiCall('/api/workflows');
    
    // Collect all GitHub repos from workflows
    for (const wf of workflows) {
      if (wf.repo && wf.repo.includes('github.com')) {
        trackedRepos.add(wf.repo);
      }
    }
    
    // Check each repo for new issues
    for (const repoUrl of trackedRepos) {
      try {
        // Extract owner/repo
        const match = repoUrl.match(/github\.com[/:]([\w-]+)\/([\w-]+)/);
        if (!match) continue;
        
        const owner = match[1];
        const repo = match[2];
        
        // Get issues (using GitHub API via gh CLI)
        const result = await new Promise((resolve) => {
          const proc = spawn('/usr/bin/gh', ['issue', 'list', '--repo', `${owner}/${repo}`, '--state', 'open', '--limit', '5', '--json', 'number,title,createdAt'], {
            stdio: ['pipe', 'pipe', 'pipe']
          });
          
          let stdout = '';
          let stderr = '';
          
          proc.stdout.on('data', (data) => { stdout += data.toString(); });
          proc.stderr.on('data', (data) => { stderr += data.toString(); });
          proc.on('close', (code) => {
            if (code === 0) resolve(JSON.parse(stdout));
            else resolve([]);
          });
        });
        
        // Check each issue - see if we already have a workflow for it
        for (const issue of result) {
          const wfId = `issue-${owner}-${repo}-${issue.number}`;
          
          // Check if workflow already exists
          const existing = await apiCall(`/api/workflows/${wfId}`);
          if (existing && existing.id) {
            continue; // Already have a workflow for this
          }
          
          // Create new bugfix workflow
          console.log(`Found new issue #${issue.number}: ${issue.title}`);
          
          await apiCall('/api/workflows', 'POST', {
            id: wfId,
            task: `Fix GitHub issue #${issue.number}: ${issue.title}`,
            repo: repoUrl,
            type: 'bugfix'
          });
          
          await apiCall('/api/logs', 'POST', {
            workflowId: wfId,
            agentId: 'hive-runner',
            message: `Auto-created from GitHub issue #${issue.number}: ${issue.title}`,
            level: 'info'
          });
        }
      } catch (err) {
        console.error(`Error checking repo ${repoUrl}:`, err.message);
      }
    }
  } catch (err) {
    console.error('Error in GitHub polling:', err.message);
  }
}

// Main loop
const POLL_INTERVAL = 10000; // 10 seconds
const ISSUE_POLL_INTERVAL = 60000; // 60 seconds for GitHub

let issuePollCounter = 0;

async function loop() {
  console.log('Polling for pending workflows...');
  
  try {
    const workflows = await apiCall('/api/workflows');
    
    for (const workflow of workflows) {
      // Process pending or running workflows
      if (workflow.status === 'pending' || workflow.status === 'running') {
        await processWorkflow(workflow);
      }
    }
    
    // Poll GitHub issues every minute
    issuePollCounter++;
    if (issuePollCounter >= (ISSUE_POLL_INTERVAL / POLL_INTERVAL)) {
      issuePollCounter = 0;
      await pollGitHubIssues();
    }
    
    // Heartbeat
    await apiCall(`/api/agents/${WORKER_ID}/heartbeat`, 'POST');
  } catch (err) {
    console.error('Error in loop:', err.message);
  }
  
  setTimeout(loop, POLL_INTERVAL);
}

// Start
console.log('Worker ready, starting loop...');
loop();

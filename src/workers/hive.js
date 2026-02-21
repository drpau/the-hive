// The Hive - Worker (Autonomous Agent Orchestration)
// Uses OpenClaw's native cron system to run agents
import { Workflows, Agents, Logs, Config } from '../lib/hive.js';
import { spawn } from 'child_process';
import { randomUUID } from 'crypto';

const WORKER_ID = `hive-worker-${process.pid}`;

// Register this worker
Agents.register(WORKER_ID, 'hive-worker');

console.log(`Hive Worker ${WORKER_ID} starting...`);

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

1. cd to the repository
2. Check if build/test setup exists (package.json, Makefile, etc.)
3. Run any setup commands
4. Run baseline tests if available
5. Report your findings

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

// Run an agent task using openclaw cron
async function runAgentTask(workflow, phase) {
  const phaseInfo = PHASES[phase];
  if (!phaseInfo) return { ok: false, error: 'Unknown phase' };
  
  const prompt = phaseInfo.prompt(workflow.task, workflow.repo, workflow.id);
  const cronName = `hive-${workflow.id}-${phase}`;
  
  console.log(`Creating cron job for ${phase} phase of workflow ${workflow.id}`);
  
  // Create a cron job that runs the agent
  // Using at (one-shot) instead of recurring
  const atTime = new Date(Date.now() + 5000); // 5 seconds from now
  const isoTime = atTime.toISOString();
  
  // The cron job will create a session with the agent and run the task
  // We use systemEvent to inject a message into the main session
  // Then check for results
  
  // For now, let's use a simpler approach: run the agent directly
  // and capture the output
  
  return new Promise((resolve) => {
    // Build the command to run
    const cronPayload = {
      text: `Run agent task for ${phase}: ${prompt}`,
      contextMessages: []
    };
    
    // Actually, let's try using sessions_send to trigger an agent
    // But first, let's see if we can just run the agent command directly
    
    // Try running openclaw agent directly
    const cmd = 'openclaw';
    const args = [
      'agent',
      '--local',
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
      console.log(`[agent] ${text.substring(0, 200)}`);
    });
    
    proc.stderr.on('data', (data) => {
      const text = data.toString();
      stderr += text;
      console.error(`[agent error] ${text.substring(0, 200)}`);
    });
    
    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ ok: true, output: stdout });
      } else {
        resolve({ ok: false, error: stderr || `Exit code ${code}` });
      }
    });
    
    // Timeout after 5 minutes
    setTimeout(() => {
      proc.kill();
      resolve({ ok: false, error: 'Timeout' });
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
  
  // Update status to running
  Workflows.update(workflow.id, { status: 'running' });
  Agents.setStatus('hive-runner', 'working', `${phase}: ${workflow.task}`);
  Logs.add(workflow.id, 'hive-runner', `Starting ${phase} phase`);
  
  try {
    const result = await runAgentTask(workflow, phase);
    
    if (result.ok) {
      Logs.add(workflow.id, 'hive-runner', `Completed ${phase} phase`);
      
      const nextPhase = getNextPhase(phase);
      if (nextPhase) {
        Workflows.update(workflow.id, { 
          phase: nextPhase,
          status: 'pending'
        });
        Logs.add(workflow.id, 'hive-runner', `Advanced to ${nextPhase} phase`);
      } else {
        Workflows.update(workflow.id, { 
          status: 'complete',
          phase: 'done'
        });
        Logs.add(workflow.id, 'hive-runner', 'Workflow complete!');
      }
    } else {
      Logs.add(workflow.id, 'hive-runner', `Error: ${result.error}`, 'error');
      Workflows.update(workflow.id, { status: 'failed' });
    }
  } catch (err) {
    Logs.add(workflow.id, 'hive-runner', `Exception: ${err.message}`, 'error');
    Workflows.update(workflow.id, { status: 'failed' });
  }
  
  Agents.setStatus('hive-runner', 'idle');
}

// Main loop
const POLL_INTERVAL = 10000; // 10 seconds

async function loop() {
  console.log('Polling for pending workflows...');
  
  try {
    const workflows = Workflows.list();
    
    for (const workflow of workflows) {
      if (workflow.status === 'pending') {
        await processWorkflow(workflow);
      }
    }
    
    Agents.heartbeat(WORKER_ID);
  } catch (err) {
    console.error('Error in loop:', err.message);
  }
  
  setTimeout(loop, POLL_INTERVAL);
}

// Start
console.log('Worker ready, starting loop...');
loop();
// The Hive - Worker (Autonomous Agent Orchestration)
import { Workflows, Agents, Logs, Config } from '../lib/hive.js';
import { spawn } from 'child_process';

// Configuration
const POLL_INTERVAL = 5000; // 5 seconds
const WORKER_ID = `worker-${process.pid}`;

// Register this worker
Agents.register(WORKER_ID, 'hive-worker');

console.log(`Hive Worker ${WORKER_ID} starting...`);

// Workflow phases and their agents
const PHASES = {
  planning: { agent: 'planner', prompt: 'Decompose task into user stories' },
  setup: { agent: 'setup', prompt: 'Prepare development environment' },
  implementing: { agent: 'developer', prompt: 'Implement user stories' },
  verifying: { agent: 'verifier', prompt: 'Verify implementation against requirements' },
  testing: { agent: 'tester', prompt: 'Run tests and validate' },
  reviewing: { agent: 'reviewer', prompt: 'Create pull request and review' }
};

// Get current phase info
function getPhaseInfo(phase) {
  return PHASES[phase] || null;
}

// Spawn an agent session
async function spawnAgent(workflow, phaseInfo) {
  const phase = workflow.phase;
  const task = workflow.task;
  const repo = workflow.repo;
  const runId = workflow.id;
  
  console.log(`Spawning ${phaseInfo.agent} for workflow ${runId}`);
  
  // Build the prompt based on phase
  const prompt = buildPrompt(phase, task, repo, runId);
  
  // Spawn via OpenClaw sessions_spawn
  return new Promise((resolve, reject) => {
    const cmd = 'openclaw';
    const args = [
      'sessions', 'spawn',
      '--agent-id', `${phaseInfo.agent}-${runId}`,
      '--message', prompt,
      '--model', 'minimax/minimax-m2.5',
      '--timeout', '300000'
    ];
    
    console.log(`Running: ${cmd} ${args.join(' ')}`);
    
    const proc = spawn(cmd, args, {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let stdout = '';
    let stderr = '';
    
    proc.stdout.on('data', (data) => {
      stdout += data.toString();
      console.log(`[spawn] ${data.toString().trim()}`);
    });
    
    proc.stderr.on('data', (data) => {
      stderr += data.toString();
      console.error(`[spawn error] ${data.toString().trim()}`);
    });
    
    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ ok: true, stdout });
      } else {
        resolve({ ok: false, error: stderr || `Exit code ${code}` });
      }
    });
  });
}

// Build prompt based on phase
function buildPrompt(phase, task, repo, runId) {
  const base = `Task: ${task}\nRepo: ${repo}\n`;
  
  switch (phase) {
    case 'planning':
      return `${base}
Decompose this task into ordered user stories.
Reply with:
STATUS: done
STORIES: [list of stories]

Focus on small, achievable stories.`;
    
    case 'setup':
      return `${base}
Prepare the development environment:
1. cd into repo
2. Check build/test setup
3. Run baseline tests
4. Report findings

Reply with STATUS: done`;
    
    case 'implementing':
      return `${base}
Implement the planned user stories.
Make small, incremental commits.
Reply with STATUS: done, CHANGES: what changed`;
    
    case 'verifying':
      return `${base}
Verify implementation against requirements.
Check all acceptance criteria are met.
Reply with STATUS: done, VERIFIED: yes/no`;
    
    case 'testing':
      return `${base}
Run tests, report results.
Reply with STATUS: done, TESTS: pass/fail`;
    
    case 'reviewing':
      return `${base}
Create a Pull Request with your changes.
Reply with STATUS: done, PR_URL: link`;
    
    default:
      return `${base}Complete this task. Reply with STATUS: done`;
  }
}

// Process a workflow
async function processWorkflow(workflow) {
  const phase = workflow.status === 'pending' ? 'planning' : workflow.phase;
  const phaseInfo = getPhaseInfo(phase);
  
  if (!phaseInfo) {
    console.log(`Workflow ${workflow.id} complete or unknown phase: ${phase}`);
    return;
  }
  
  // Check if there's actually work to do
  if (workflow.status === 'running' && phase !== 'planning') {
    // Check if previous phase is done
    const prevPhase = getPrevPhase(phase);
    // For simplicity, we'll just advance
  }
  
  // Mark as running
  Workflows.update(workflow.id, { status: 'running' });
  Agents.setStatus(phaseInfo.agent, 'working', workflow.task);
  
  Logs.add(workflow.id, phaseInfo.agent, `Starting ${phase} phase`);
  
  try {
    const result = await spawnAgent(workflow, phaseInfo);
    
    if (result.ok) {
      // Advance to next phase
      const nextPhase = getNextPhase(phase);
      
      if (nextPhase) {
        Workflows.update(workflow.id, { 
          phase: nextPhase,
          status: 'pending'
        });
        Logs.add(workflow.id, phaseInfo.agent, `Completed ${phase}, advanced to ${nextPhase}`);
      } else {
        Workflows.update(workflow.id, { 
          status: 'complete',
          phase: 'done'
        });
        Logs.add(workflow.id, phaseInfo.agent, 'Workflow complete!');
      }
    } else {
      Logs.add(workflow.id, phaseInfo.agent, `Error: ${result.error}`, 'error');
      Workflows.update(workflow.id, { status: 'failed' });
    }
  } catch (err) {
    Logs.add(workflow.id, phaseInfo.agent, `Exception: ${err.message}`, 'error');
    Workflows.update(workflow.id, { status: 'failed' });
  }
  
  Agents.setStatus(phaseInfo.agent, 'idle');
}

function getPrevPhase(phase) {
  const phases = Object.keys(PHASES);
  const idx = phases.indexOf(phase);
  return idx > 0 ? phases[idx - 1] : null;
}

function getNextPhase(phase) {
  const phases = Object.keys(PHASES);
  const idx = phases.indexOf(phase);
  return idx < phases.length - 1 ? phases[idx + 1] : null;
}

// Main loop
async function loop() {
  console.log('Polling for work...');
  
  // Get pending workflows
  const workflows = Workflows.list();
  
  for (const workflow of workflows) {
    if (workflow.status === 'pending') {
      console.log(`Processing workflow ${workflow.id}: ${workflow.task}`);
      await processWorkflow(workflow);
    }
  }
  
  // Heartbeat
  Agents.heartbeat(WORKER_ID);
  
  // Schedule next loop
  setTimeout(loop, POLL_INTERVAL);
}

// Start
console.log('Worker ready, starting loop...');
loop();

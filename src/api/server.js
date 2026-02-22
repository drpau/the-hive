// The Hive - API Server
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import { Workflows, Agents, Logs } from '../lib/hive.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

app.use(express.json());

// === REST API ROUTES (must come before SPA fallback) ===

// Hello World page
app.get('/hello', (req, res) => {
  res.send(`<!DOCTYPE html>
<html>
<head>
  <title>Hello World</title>
  <style>
    body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f0f0f0; }
    h1 { color: #333; }
  </style>
</head>
<body>
  <h1>Hello World from The Hive! 🐝</h1>
</body>
</html>`);
});

// List workflows
app.get('/api/workflows', (req, res) => {
  const workflows = Workflows.list();
  res.json(workflows);
});

// Get workflow
app.get('/api/workflows/:id', (req, res) => {
  const workflow = Workflows.get(req.params.id);
  if (!workflow) return res.status(404).json({ error: 'Not found' });
  res.json(workflow);
});

// Create workflow
app.post('/api/workflows', (req, res) => {
  const { id, task, repo, name, type, breaking } = req.body;
  if (!id || !task) return res.status(400).json({ error: 'id and task required' });
  
  const workflow = Workflows.create(id, task, repo || '', name || 'default', type || 'bugfix', breaking || false);
  Logs.add(id, null, `Workflow created: ${task}`);
  
  // Broadcast to WebSocket clients
  broadcast({ type: 'workflow-created', workflow });
  
  res.json(workflow);
});

// Update workflow
app.patch('/api/workflows/:id', (req, res) => {
  const workflow = Workflows.update(req.params.id, req.body);
  broadcast({ type: 'workflow-updated', workflow });
  res.json(workflow);
});

// Delete workflow
app.delete('/api/workflows/:id', (req, res) => {
  Workflows.delete(req.params.id);
  res.json({ ok: true });
});

// List agents
app.get('/api/agents', (req, res) => {
  res.json(Agents.list());
});

// Update agent
app.post('/api/agents/:id/status', (req, res) => {
  const { status, task } = req.body;
  Agents.setStatus(req.params.id, status, task);
  res.json({ ok: true });
});

// Heartbeat
app.post('/api/agents/:id/heartbeat', (req, res) => {
  Agents.heartbeat(req.params.id);
  res.json({ ok: true });
});

// Get logs
app.get('/api/workflows/:id/logs', (req, res) => {
  const logs = Logs.get(req.params.id, 100);
  res.json(logs);
});

// Add log
app.post('/api/logs', (req, res) => {
  const { workflowId, agentId, message, level } = req.body;
  Logs.add(workflowId, agentId, message, level);
  // Broadcast to all clients
  broadcast({ type: 'log-added', workflowId, agentId, message, level });
  res.json({ ok: true });
});

// === STATIC FILES & SPA FALLBACK ===

// Serve static dashboard
app.use(express.static(path.join(__dirname, '../dashboard')));

// SPA fallback - serve index.html for all non-API routes
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '../dashboard/index.html'));
  }
});

// === WEBSOCKET ===

const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log('Client connected');
  
  ws.on('close', () => {
    clients.delete(ws);
  });
});

function broadcast(message) {
  const data = JSON.stringify(message);
  clients.forEach(client => {
    if (client.readyState === 1) { // OPEN
      client.send(data);
    }
  });
}

// Make broadcast available globally
global.broadcast = broadcast;

const PORT = process.env.PORT || 3334;
server.listen(PORT, () => {
  console.log(`The Hive API running on port ${PORT}`);
});

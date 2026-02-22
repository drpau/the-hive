// The Hive - Core Library
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.HIVE_DB || path.join(__dirname, '../../the-hive.db');

const now = () => Math.floor(Date.now() / 1000);

// Initialize database
const db = new Database(DB_PATH);

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS workflows (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    repo TEXT,
    task TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    phase TEXT DEFAULT 'planning',
    created_at INTEGER,
    updated_at INTEGER
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    workflow_id TEXT,
    status TEXT DEFAULT 'idle',
    current_task TEXT,
    last_seen INTEGER
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workflow_id TEXT,
    agent_id TEXT,
    message TEXT NOT NULL,
    level TEXT DEFAULT 'info',
    timestamp INTEGER
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT
  )
`);

// Workflow operations
export const Workflows = {
  create(id, task, repo, name = 'default', type = 'bugfix') {
    const t = now();
    const stmt = db.prepare('INSERT INTO workflows (id, task, repo, name, type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
    stmt.run(id, task, repo || '', name, type, t, t);
    return this.get(id);
  },

  get(id) {
    return db.prepare('SELECT * FROM workflows WHERE id = ?').get(id);
  },

  list() {
    return db.prepare('SELECT * FROM workflows ORDER BY created_at DESC').all();
  },

  update(id, updates) {
    const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = Object.values(updates);
    db.prepare(`UPDATE workflows SET ${fields}, updated_at = ? WHERE id = ?`).run(...values, now(), id);
    return this.get(id);
  },

  delete(id) {
    db.prepare('DELETE FROM workflows WHERE id = ?').run(id);
  }
};

// Agent operations
export const Agents = {
  register(id, name) {
    const stmt = db.prepare('INSERT OR REPLACE INTO agents (id, name, last_seen) VALUES (?, ?, ?)');
    stmt.run(id, name, now());
    return this.get(id);
  },

  get(id) {
    return db.prepare('SELECT * FROM agents WHERE id = ?').get(id);
  },

  list() {
    return db.prepare('SELECT * FROM agents').all();
  },

  setStatus(id, status, task = null) {
    const stmt = db.prepare('UPDATE agents SET status = ?, current_task = ?, last_seen = ? WHERE id = ?');
    stmt.run(status, task, now(), id);
  },

  heartbeat(id) {
    db.prepare('UPDATE agents SET last_seen = ? WHERE id = ?').run(now(), id);
  }
};

// Logging
export const Logs = {
  add(workflowId, agentId, message, level = 'info') {
    const stmt = db.prepare('INSERT INTO logs (workflow_id, agent_id, message, level, timestamp) VALUES (?, ?, ?, ?, ?)');
    stmt.run(workflowId, agentId, message, level, now());
  },

  get(workflowId, limit = 100) {
    return db.prepare('SELECT * FROM logs WHERE workflow_id = ? ORDER BY timestamp DESC LIMIT ?').all(workflowId, limit);
  }
};

// Config
export const Config = {
  get(key, defaultValue = null) {
    const row = db.prepare('SELECT value FROM config WHERE key = ?').get(key);
    return row ? row.value : defaultValue;
  },

  set(key, value) {
    db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)').run(key, value);
  }
};

export default { Workflows, Agents, Logs, Config };
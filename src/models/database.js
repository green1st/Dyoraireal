const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
  constructor() {
    this.db = new sqlite3.Database(path.join(__dirname, '../../data/ai_agent.db'));
    this.init();
  }

  init() {
    // Create tasks table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        command TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        result TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create logs table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id TEXT,
        message TEXT NOT NULL,
        level TEXT DEFAULT 'info',
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (task_id) REFERENCES tasks (id)
      )
    `);

    // Create settings table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  // Task methods
  createTask(id, command) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT INTO tasks (id, command) VALUES (?, ?)',
        [id, command],
        function(err) {
          if (err) reject(err);
          else resolve(id);
        }
      );
    });
  }

  updateTaskStatus(id, status, result = null) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'UPDATE tasks SET status = ?, result = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [status, result, id],
        function(err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });
  }

  getTask(id) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM tasks WHERE id = ?',
        [id],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }

  getAllTasks() {
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT * FROM tasks ORDER BY created_at DESC',
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  // Log methods
  addLog(taskId, message, level = 'info') {
    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT INTO logs (task_id, message, level) VALUES (?, ?, ?)',
        [taskId, message, level],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }

  getTaskLogs(taskId) {
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT * FROM logs WHERE task_id = ? ORDER BY timestamp ASC',
        [taskId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  // Settings methods
  setSetting(key, value) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        [key, value],
        function(err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });
  }

  getSetting(key) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT value FROM settings WHERE key = ?',
        [key],
        (err, row) => {
          if (err) reject(err);
          else resolve(row ? row.value : null);
        }
      );
    });
  }

  close() {
    this.db.close();
  }
}

module.exports = Database;


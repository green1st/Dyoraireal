const fs = require('fs');
const path = require('path');
const Database = require('../models/database');

class DataExporter {
  constructor() {
    this.db = new Database();
  }

  async exportToCSV(type = 'tasks', filename = null) {
    try {
      let data, headers, csvContent;
      
      switch (type) {
        case 'tasks':
          data = await this.db.getAllTasks();
          headers = ['ID', 'Command', 'Status', 'Created At', 'Updated At', 'Result'];
          csvContent = this.arrayToCSV(data, headers, (row) => [
            row.id,
            row.command,
            row.status,
            row.created_at,
            row.updated_at,
            row.result ? row.result.substring(0, 100) + '...' : ''
          ]);
          break;
          
        case 'logs':
          // Get all logs
          data = await this.getAllLogs();
          headers = ['ID', 'Task ID', 'Message', 'Level', 'Timestamp'];
          csvContent = this.arrayToCSV(data, headers, (row) => [
            row.id,
            row.task_id,
            row.message,
            row.level,
            row.timestamp
          ]);
          break;
          
        default:
          throw new Error('Invalid export type');
      }

      const exportFilename = filename || `${type}_export_${Date.now()}.csv`;
      const exportPath = path.join(__dirname, '../../data', exportFilename);
      
      fs.writeFileSync(exportPath, csvContent);
      return exportPath;
      
    } catch (error) {
      console.error('Error exporting data:', error);
      throw error;
    }
  }

  async exportToJSON(type = 'tasks', filename = null) {
    try {
      let data;
      
      switch (type) {
        case 'tasks':
          data = await this.db.getAllTasks();
          // Include logs for each task
          for (let task of data) {
            task.logs = await this.db.getTaskLogs(task.id);
          }
          break;
          
        case 'logs':
          data = await this.getAllLogs();
          break;
          
        case 'full':
          data = {
            tasks: await this.db.getAllTasks(),
            logs: await this.getAllLogs(),
            settings: await this.getAllSettings(),
            exportedAt: new Date().toISOString()
          };
          break;
          
        default:
          throw new Error('Invalid export type');
      }

      const exportFilename = filename || `${type}_export_${Date.now()}.json`;
      const exportPath = path.join(__dirname, '../../data', exportFilename);
      
      fs.writeFileSync(exportPath, JSON.stringify(data, null, 2));
      return exportPath;
      
    } catch (error) {
      console.error('Error exporting data:', error);
      throw error;
    }
  }

  async getAllLogs() {
    return new Promise((resolve, reject) => {
      this.db.db.all(
        'SELECT * FROM logs ORDER BY timestamp DESC',
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  async getAllSettings() {
    return new Promise((resolve, reject) => {
      this.db.db.all(
        'SELECT * FROM settings',
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  arrayToCSV(data, headers, rowMapper) {
    if (!data || data.length === 0) {
      return headers.join(',') + '\n';
    }

    const csvRows = [headers.join(',')];
    
    for (const row of data) {
      const mappedRow = rowMapper(row);
      const csvRow = mappedRow.map(field => {
        // Escape quotes and wrap in quotes if contains comma or quote
        const stringField = String(field || '');
        if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
          return '"' + stringField.replace(/"/g, '""') + '"';
        }
        return stringField;
      });
      csvRows.push(csvRow.join(','));
    }

    return csvRows.join('\n');
  }

  async getExportStats() {
    try {
      const tasks = await this.db.getAllTasks();
      const logs = await this.getAllLogs();
      
      const taskStats = {
        total: tasks.length,
        completed: tasks.filter(t => t.status === 'completed').length,
        failed: tasks.filter(t => t.status === 'failed').length,
        running: tasks.filter(t => t.status === 'running').length,
        pending: tasks.filter(t => t.status === 'pending').length
      };

      const logStats = {
        total: logs.length,
        info: logs.filter(l => l.level === 'info').length,
        error: logs.filter(l => l.level === 'error').length,
        warning: logs.filter(l => l.level === 'warning').length,
        success: logs.filter(l => l.level === 'success').length
      };

      return {
        tasks: taskStats,
        logs: logStats,
        lastExport: null // Could be stored in settings
      };
    } catch (error) {
      console.error('Error getting export stats:', error);
      throw error;
    }
  }

  async cleanupOldData(daysOld = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);
      const cutoffISO = cutoffDate.toISOString();

      // Delete old completed/failed tasks
      const deletedTasks = await new Promise((resolve, reject) => {
        this.db.db.run(
          `DELETE FROM tasks WHERE 
           (status = 'completed' OR status = 'failed') 
           AND updated_at < ?`,
          [cutoffISO],
          function(err) {
            if (err) reject(err);
            else resolve(this.changes);
          }
        );
      });

      // Delete orphaned logs
      const deletedLogs = await new Promise((resolve, reject) => {
        this.db.db.run(
          `DELETE FROM logs WHERE task_id NOT IN (SELECT id FROM tasks)`,
          function(err) {
            if (err) reject(err);
            else resolve(this.changes);
          }
        );
      });

      return {
        deletedTasks,
        deletedLogs,
        cutoffDate: cutoffISO
      };
    } catch (error) {
      console.error('Error cleaning up old data:', error);
      throw error;
    }
  }
}

module.exports = DataExporter;


const DataExporter = require('../utils/dataExporter');
const path = require('path');
const fs = require('fs');

class DataController {
  constructor() {
    this.dataExporter = new DataExporter();
  }

  async exportData(req, res) {
    try {
      const { type = 'tasks', format = 'json' } = req.query;
      
      let exportPath;
      if (format === 'csv') {
        exportPath = await this.dataExporter.exportToCSV(type);
      } else {
        exportPath = await this.dataExporter.exportToJSON(type);
      }

      const filename = path.basename(exportPath);
      
      res.download(exportPath, filename, (err) => {
        if (err) {
          console.error('Error downloading file:', err);
          res.status(500).json({ error: 'Failed to download file' });
        } else {
          // Clean up the file after download
          setTimeout(() => {
            try {
              fs.unlinkSync(exportPath);
            } catch (cleanupErr) {
              console.error('Error cleaning up export file:', cleanupErr);
            }
          }, 5000);
        }
      });
    } catch (error) {
      console.error('Error exporting data:', error);
      res.status(500).json({ error: 'Failed to export data' });
    }
  }

  async getExportStats(req, res) {
    try {
      const stats = await this.dataExporter.getExportStats();
      res.json(stats);
    } catch (error) {
      console.error('Error getting export stats:', error);
      res.status(500).json({ error: 'Failed to get export stats' });
    }
  }

  async cleanupData(req, res) {
    try {
      const { daysOld = 30 } = req.body;
      const result = await this.dataExporter.cleanupOldData(daysOld);
      
      res.json({
        message: 'Data cleanup completed',
        ...result
      });
    } catch (error) {
      console.error('Error cleaning up data:', error);
      res.status(500).json({ error: 'Failed to cleanup data' });
    }
  }

  async getDatabaseStats(req, res) {
    try {
      const stats = await this.dataExporter.getExportStats();
      
      // Add database file size
      const dbPath = path.join(__dirname, '../../data/ai_agent.db');
      let dbSize = 0;
      try {
        const dbStats = fs.statSync(dbPath);
        dbSize = dbStats.size;
      } catch (e) {
        // Database file doesn't exist or can't be accessed
      }

      res.json({
        ...stats,
        database: {
          size: dbSize,
          sizeFormatted: this.formatBytes(dbSize),
          path: dbPath
        }
      });
    } catch (error) {
      console.error('Error getting database stats:', error);
      res.status(500).json({ error: 'Failed to get database stats' });
    }
  }

  formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }
}

module.exports = DataController;


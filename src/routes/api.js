const express = require('express');
const TaskController = require('../controllers/taskController');
const SettingsController = require('../controllers/settingsController');
const DataController = require('../controllers/dataController');

const router = express.Router();

// Initialize controllers
const taskController = new TaskController();
const settingsController = new SettingsController();
const dataController = new DataController();

// Task routes
router.post('/tasks', (req, res) => taskController.createTask(req, res));
router.get('/tasks', (req, res) => taskController.getAllTasks(req, res));
router.get('/tasks/:taskId', (req, res) => taskController.getTask(req, res));
router.get('/tasks/:taskId/logs', (req, res) => taskController.getTaskLogs(req, res));
router.get('/active-tasks', (req, res) => taskController.getActiveTasksStatus(req, res));

// Settings routes
router.get('/settings', (req, res) => settingsController.getSettings(req, res));
router.put('/settings', (req, res) => settingsController.updateSettings(req, res));
router.post('/settings/test-api-key', (req, res) => settingsController.testApiKey(req, res));
router.get('/settings/proxy-stats', (req, res) => settingsController.getProxyStats(req, res));
router.post('/settings/test-proxies', (req, res) => settingsController.testProxies(req, res));

// Data management routes
router.get('/data/export', (req, res) => dataController.exportData(req, res));
router.get('/data/stats', (req, res) => dataController.getExportStats(req, res));
router.get('/data/database-stats', (req, res) => dataController.getDatabaseStats(req, res));
router.post('/data/cleanup', (req, res) => dataController.cleanupData(req, res));

// Health check
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

module.exports = router;


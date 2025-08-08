const { v4: uuidv4 } = require('uuid');
const Database = require('../models/database');
const BrowserService = require('../services/browserService');
const AIService = require('../services/aiService');

class TaskController {
  constructor() {
    this.db = new Database();
    this.browserService = new BrowserService();
    this.aiService = new AIService();
    this.activeTasks = new Map();
  }

  async createTask(req, res) {
    try {
      const { command } = req.body;
      
      if (!command) {
        return res.status(400).json({ error: 'Command is required' });
      }

      const taskId = uuidv4();
      await this.db.createTask(taskId, command);
      await this.db.addLog(taskId, `Task created: ${command}`, 'info');

      // Start task execution in background
      this.executeTask(taskId, command);

      res.json({ 
        taskId, 
        status: 'created',
        message: 'Task created and started execution'
      });
    } catch (error) {
      console.error('Error creating task:', error);
      res.status(500).json({ error: 'Failed to create task' });
    }
  }

  async getTask(req, res) {
    try {
      const { taskId } = req.params;
      const task = await this.db.getTask(taskId);
      
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      const logs = await this.db.getTaskLogs(taskId);
      
      res.json({
        ...task,
        logs
      });
    } catch (error) {
      console.error('Error getting task:', error);
      res.status(500).json({ error: 'Failed to get task' });
    }
  }

  async getAllTasks(req, res) {
    try {
      const tasks = await this.db.getAllTasks();
      res.json(tasks);
    } catch (error) {
      console.error('Error getting tasks:', error);
      res.status(500).json({ error: 'Failed to get tasks' });
    }
  }

  async getTaskLogs(req, res) {
    try {
      const { taskId } = req.params;
      const logs = await this.db.getTaskLogs(taskId);
      res.json(logs);
    } catch (error) {
      console.error('Error getting task logs:', error);
      res.status(500).json({ error: 'Failed to get task logs' });
    }
  }

  async executeTask(taskId, command) {
    try {
      this.activeTasks.set(taskId, { status: 'running', startTime: Date.now() }); 
      await this.db.updateTaskStatus(taskId, 'running');
      await this.db.addLog(taskId, 'Starting task execution', 'info');

      // Use AI to analyze the command and create execution plan
      const plan = await this.aiService.createExecutionPlan(command);
      await this.db.addLog(taskId, `Execution plan created: ${JSON.stringify(plan)}`, 'info');

      // Initialize browser in visible mode if not already initialized
      if (!this.browserService.isBrowserInitialized()) {
        await this.browserService.initBrowser({ 
          headless: false,  // Make browser visible
          contextOptions: {
            viewport: { width: 1280, height: 720 }  // Set reasonable window size
          }
        });
        await this.db.addLog(taskId, 'Browser opened in visible mode', 'info');
      }
      
      // Set up captcha service if API key is available
      const captchaApiKey = await this.db.getSetting('captcha_api_key');
      const captchaService = await this.db.getSetting('captcha_service') || '2captcha';
      if (captchaApiKey) {
        this.browserService.setCaptchaService(captchaApiKey, captchaService);
        await this.db.addLog(taskId, 'Captcha service configured', 'info');
      }
      
      // Set up proxy service if configured
      const proxySettings = JSON.parse(await this.db.getSetting('proxy_settings') || '{}');
      if (proxySettings.proxies && proxySettings.proxies.length > 0) {
        this.browserService.setProxyService(proxySettings.proxies, proxySettings.rotationEnabled);
        await this.db.addLog(taskId, 'Proxy service configured', 'info');
      }

      // Execute the plan using browser service
      const result = await this.browserService.executePlan(taskId, plan, (message, level = 'info') => {
        this.db.addLog(taskId, message, level);
      });

      await this.db.updateTaskStatus(taskId, 'completed', JSON.stringify(result));
      await this.db.addLog(taskId, 'Task completed successfully', 'success');
      
    } catch (error) {
      console.error(`Error executing task ${taskId}:`, error);
      await this.db.updateTaskStatus(taskId, 'failed', error.message);
      await this.db.addLog(taskId, `Task failed: ${error.message}`, 'error');
    } finally {
      // Ensure browser is closed only if no other active tasks are running
      this.activeTasks.delete(taskId);
      if (this.activeTasks.size === 0) {
        await this.browserService.closeBrowser();
        await this.db.addLog(taskId, 'Browser closed', 'info');
      }
    }
  }

  async getActiveTasksStatus(req, res) {
    try {
      const activeTasks = Array.from(this.activeTasks.entries()).map(([taskId, info]) => ({
        taskId,
        ...info,
        duration: Date.now() - info.startTime
      }));
      
      res.json(activeTasks);
    } catch (error) {
      console.error('Error getting active tasks:', error);
      res.status(500).json({ error: 'Failed to get active tasks' });
    }
  }
}

module.exports = TaskController;


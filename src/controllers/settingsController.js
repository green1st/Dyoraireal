const Database = require('../models/database');
const CaptchaService = require('../services/captchaService');

class SettingsController {
  constructor() {
    this.db = new Database();
    this.captchaService = new CaptchaService();
  }

  async getSettings(req, res) {
    try {
      // Get all common settings
      const settings = {
        geminiApiKey: await this.db.getSetting('gemini_api_key') || '',
        captchaApiKey: await this.db.getSetting('captcha_api_key') || '',
        captchaService: await this.db.getSetting('captcha_service') || '2captcha',
        proxySettings: JSON.parse(await this.db.getSetting('proxy_settings') || '{}'),
        browserSettings: JSON.parse(await this.db.getSetting('browser_settings') || '{}')
      };

      res.json(settings);
    } catch (error) {
      console.error('Error getting settings:', error);
      res.status(500).json({ error: 'Failed to get settings' });
    }
  }

  async updateSettings(req, res) {
    try {
      const { 
        geminiApiKey, 
        captchaApiKey,
        captchaService,
        proxySettings, 
        browserSettings 
      } = req.body;

      if (geminiApiKey !== undefined) {
        await this.db.setSetting('gemini_api_key', geminiApiKey);
      }

      if (captchaApiKey !== undefined) {
        await this.db.setSetting('captcha_api_key', captchaApiKey);
      }

      if (captchaService !== undefined) {
        await this.db.setSetting('captcha_service', captchaService);
      }

      if (proxySettings !== undefined) {
        await this.db.setSetting('proxy_settings', JSON.stringify(proxySettings));
      }

      if (browserSettings !== undefined) {
        await this.db.setSetting('browser_settings', JSON.stringify(browserSettings));
      }

      res.json({ message: 'Settings updated successfully' });
    } catch (error) {
      console.error('Error updating settings:', error);
      res.status(500).json({ error: 'Failed to update settings' });
    }
  }

  async testApiKey(req, res) {
    try {
      const { apiKey, service } = req.body;
      
      if (service === 'gemini') {
        // Test Gemini API key
        const AIService = require('../services/aiService');
        const aiService = new AIService();
        const isValid = await aiService.testApiKey(apiKey);
        
        res.json({ valid: isValid });
      } else if (service === '2captcha' || service === 'anticaptcha') {
        // Test Captcha API key
        const isValid = await this.captchaService.testApiKey(apiKey, service);
        res.json({ valid: isValid });
      } else {
        res.status(400).json({ error: 'Unsupported service' });
      }
    } catch (error) {
      console.error('Error testing API key:', error);
      res.status(500).json({ error: 'Failed to test API key' });
    }
  }

  async getProxyStats(req, res) {
    try {
      // This would typically get stats from the browser service
      // For now, return empty stats
      const stats = {
        total: 0,
        active: 0,
        inactive: 0,
        rotationEnabled: false,
        currentProxy: null,
        proxies: []
      };

      res.json(stats);
    } catch (error) {
      console.error('Error getting proxy stats:', error);
      res.status(500).json({ error: 'Failed to get proxy stats' });
    }
  }

  async testProxies(req, res) {
    try {
      const { proxies } = req.body;
      
      if (!proxies || !Array.isArray(proxies)) {
        return res.status(400).json({ error: 'Proxies array is required' });
      }

      // This would test proxies using the browser service
      // For now, return mock results
      const results = proxies.map(proxy => ({
        proxy: proxy,
        success: false,
        responseTime: null,
        error: 'Proxy testing not implemented yet'
      }));

      res.json({ results });
    } catch (error) {
      console.error('Error testing proxies:', error);
      res.status(500).json({ error: 'Failed to test proxies' });
    }
  }
}

module.exports = SettingsController;


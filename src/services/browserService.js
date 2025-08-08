const { chromium } = require('playwright');
const StealthService = require('./stealthService');
const CaptchaService = require('./captchaService');
const ProxyService = require('./proxyService');

class BrowserService {
  constructor() {
    this.browser = null;
    this.context = null;
    this.page = null;
    this.stealthService = new StealthService();
    this.captchaService = new CaptchaService();
    this.proxyService = new ProxyService();
  }

  isBrowserInitialized() {
    return this.browser !== null && this.context !== null && this.page !== null;
  }

  async initBrowser(options = {}) {
    try {
      // Get proxy configuration if enabled
      const proxyConfig = this.proxyService.getPlaywrightProxyConfig();
      
      // Launch browser with stealth settings
      const launchOptions = this.stealthService.getStealthLaunchOptions();
      this.browser = await chromium.launch({
        ...launchOptions,
        headless: true, // Force headless mode for sandbox environment
        ...(proxyConfig ? { proxy: proxyConfig } : {}) // Add proxy if available
      });

      // Create context with stealth settings
      const contextOptions = this.stealthService.getStealthContextOptions();
      this.context = await this.browser.newContext({
        ...contextOptions,
        ...options.contextOptions
      });

      // Add stealth scripts
      await this.context.addInitScript(this.stealthService.getStealthInitScript());

      this.page = await this.context.newPage();
      
      // Add additional stealth measures
      await this.page.setExtraHTTPHeaders({
        'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'document',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-site': 'none',
        'sec-fetch-user': '?1'
      });
      
      return true;
    } catch (error) {
      console.error('Error initializing browser:', error);
      throw error;
    }
  }

  setCaptchaService(apiKey, service = '2captcha') {
    this.captchaService.setApiKey(apiKey, service);
  }

  setProxyService(proxies, enableRotation = true) {
    this.proxyService.clearProxies();
    this.proxyService.loadProxiesFromList(proxies);
    this.proxyService.enableRotation(enableRotation);
  }

  async executePlan(taskId, plan, logCallback) {
    if (!this.browser) {
      throw new Error("Browser not initialized. Call initBrowser() first.");
    }

    logCallback(`Starting execution of ${plan.steps.length} steps`);
    
    const results = [];
    
    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i];
      logCallback(`Step ${i + 1}: ${step.description}`);
      
      try {
        const stepResult = await this.executeStep(step, logCallback);
        results.push({
          step: i + 1,
          action: step.action,
          success: true,
          result: stepResult
        });
        
        // Add random human behavior between steps
        await this.stealthService.addRandomBehavior(this.page);
        
      } catch (stepError) {
        logCallback(`Step ${i + 1} failed: ${stepError.message}`, 'error');
        
        // Try to handle captcha if step failed
        if (stepError.message.includes('captcha') || stepError.message.includes('blocked')) {
          logCallback('Attempting to solve captcha...', 'info');
          const captchaSolved = await this.captchaService.solveCaptchaOnPage(this.page, logCallback);
          
          if (captchaSolved) {
            logCallback('Captcha solved, retrying step...', 'info');
            try {
              const retryResult = await this.executeStep(step, logCallback);
              results.push({
                step: i + 1,
                action: step.action,
                success: true,
                result: retryResult,
                captchaSolved: true
              });
              continue;
            } catch (retryError) {
              logCallback(`Step retry failed: ${retryError.message}`, 'error');
            }
          }
        }
        
        results.push({
          step: i + 1,
          action: step.action,
          success: false,
          error: stepError.message
        });
        
        // Stop execution on critical error
        if (stepError.message.includes('critical') || !this.browser.isConnected()) {
          logCallback('Critical error, stopping execution.', 'error');
          break;
        }
      }
    }

    return {
      taskId,
      planExecuted: plan,
      results,
      success: results.every(r => r.success),
      completedSteps: results.filter(r => r.success).length,
      totalSteps: plan.steps.length
    };
  }

  async executeStep(step, logCallback) {
    try {
      switch (step.action.toLowerCase()) {
        case 'navigate':
          await this.page.goto(step.target, { 
            waitUntil: 'networkidle',
            timeout: 30000 
          });
          logCallback(`Navigated to ${step.target}`);
          
          // Check for captcha after navigation
          const captchas = await this.captchaService.detectCaptcha(this.page);
          if (captchas.length > 0) {
            logCallback(`Detected ${captchas.length} captcha(s) on page`, 'warning');
          }
          
          // Simulate human behavior after navigation
          await this.stealthService.simulateHumanBehavior(this.page);
          break;

        case 'click':
          await this.stealthService.humanClick(this.page, step.target);
          logCallback(`Clicked on ${step.target}`);
          break;

        case 'type':
          if (step.selector) {
            await this.stealthService.humanType(this.page, step.selector, step.target);
          } else {
            // Find input field and type
            const inputSelectors = ['input[type="text"]', 'input[type="email"]', 'input[type="password"]', 'textarea'];
            for (const selector of inputSelectors) {
              try {
                await this.page.waitForSelector(selector, { timeout: 2000 });
                await this.stealthService.humanType(this.page, selector, step.target);
                break;
              } catch (e) {
                continue;
              }
            }
          }
          logCallback(`Typed: ${step.target}`);
          break;

        case 'wait':
          const waitTime = parseInt(step.target) || 2000;
          await this.page.waitForTimeout(waitTime);
          logCallback(`Waited for ${waitTime}ms`);
          break;

        case 'scroll':
          await this.stealthService.randomScroll(this.page);
          logCallback('Scrolled down');
          break;

        case 'extract':
          const content = await this.page.textContent('body');
          logCallback(`Extracted page content (${content.length} characters)`);
          return content;

        case 'screenshot':
          const screenshotPath = await this.takeScreenshot();
          logCallback(`Screenshot saved: ${screenshotPath}`);
          return screenshotPath;

        case 'fill_form':
          await this.fillForm(step.data, logCallback);
          logCallback('Form filled');
          break;

        case 'solve_captcha':
          const solved = await this.captchaService.solveCaptchaOnPage(this.page, logCallback);
          if (solved) {
            logCallback('Captcha solved successfully');
          } else {
            throw new Error('Failed to solve captcha');
          }
          break;

        default:
          logCallback(`Unknown action: ${step.action}`, 'warning');
      }

      // Wait for any specified condition
      if (step.waitFor) {
        await this.waitForCondition(step.waitFor, logCallback);
      }

      return 'success';
    } catch (error) {
      throw new Error(`Step execution failed: ${error.message}`);
    }
  }

  async fillForm(formData, logCallback) {
    try {
      for (const [field, value] of Object.entries(formData)) {
        const selectors = [
          `input[name="${field}"]`,
          `input[id="${field}"]`,
          `input[placeholder*="${field}"]`,
          `textarea[name="${field}"]`,
          `textarea[id="${field}"]`,
          `select[name="${field}"]`,
          `select[id="${field}"]`
        ];

        for (const selector of selectors) {
          try {
            await this.page.waitForSelector(selector, { timeout: 2000 });
            
            const element = this.page.locator(selector);
            const tagName = await element.evaluate(el => el.tagName.toLowerCase());
            
            if (tagName === 'select') {
              await element.selectOption(value);
            } else {
              await this.stealthService.humanType(this.page, selector, value);
            }
            
            logCallback(`Filled ${field}: ${value}`);
            break;
          } catch (e) {
            continue;
          }
        }
      }
    } catch (error) {
      throw new Error(`Form filling failed: ${error.message}`);
    }
  }

  async waitForCondition(condition, logCallback) {
    try {
      switch (condition.toLowerCase()) {
        case 'page load':
          await this.page.waitForLoadState('networkidle');
          break;
        case 'element':
          await this.page.waitForSelector('body', { state: 'visible' });
          break;
        default:
          try {
            await this.page.waitForSelector(condition, { timeout: 10000 });
          } catch {
            await this.page.waitForTimeout(2000);
          }
      }
      logCallback(`Wait condition met: ${condition}`);
    } catch (error) {
      logCallback(`Wait condition failed: ${condition}`, 'warning');
    }
  }

  async takeScreenshot(filename = null) {
    if (!this.page) return null;
    
    const screenshotPath = filename || `data/screenshot_${Date.now()}.png`;
    await this.page.screenshot({ path: screenshotPath, fullPage: true });
    return screenshotPath;
  }

  async getCurrentUrl() {
    if (!this.page) return null;
    return this.page.url();
  }

  async getPageTitle() {
    if (!this.page) return null;
    return this.page.title();
  }

  async getPageContent() {
    if (!this.page) return null;
    return await this.page.textContent('body');
  }

  async getProxyStats() {
    return this.proxyService.getProxyStats();
  }

  async testProxies() {
    return await this.proxyService.testAllProxies();
  }

  async closeBrowser() {
    try {
      if (this.page) await this.page.close();
      if (this.context) await this.context.close();
      if (this.browser) await this.browser.close();
      
      this.page = null;
      this.context = null;
      this.browser = null;
    } catch (error) {
      console.error('Error closing browser:', error);
    }
  }
}

module.exports = BrowserService;


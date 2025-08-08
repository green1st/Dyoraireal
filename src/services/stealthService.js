class StealthService {
  constructor() {
    this.userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ];
    
    this.viewports = [
      { width: 1366, height: 768 },
      { width: 1920, height: 1080 },
      { width: 1440, height: 900 },
      { width: 1536, height: 864 }
    ];
  }

  getRandomUserAgent() {
    return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
  }

  getRandomViewport() {
    return this.viewports[Math.floor(Math.random() * this.viewports.length)];
  }

  getStealthLaunchOptions() {
    return {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-field-trial-config',
        '--disable-back-forward-cache',
        '--disable-backgrounding-occluded-windows',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection',
        '--no-default-browser-check',
        '--no-first-run',
        '--disable-default-apps',
        '--disable-popup-blocking',
        '--disable-prompt-on-repost',
        '--disable-hang-monitor',
        '--disable-sync',
        '--disable-web-resources',
        '--disable-client-side-phishing-detection',
        '--disable-component-update',
        '--disable-domain-reliability'
      ]
    };
  }

  getStealthContextOptions() {
    return {
      userAgent: this.getRandomUserAgent(),
      viewport: this.getRandomViewport(),
      locale: 'en-US',
      timezoneId: 'America/New_York',
      permissions: ['geolocation', 'notifications'],
      colorScheme: 'light',
      reducedMotion: 'no-preference',
      forcedColors: 'none',
      extraHTTPHeaders: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    };
  }

  getStealthInitScript() {
    return `
      // Remove webdriver property
      delete navigator.__proto__.webdriver;
      
      // Override the plugins property to use a custom getter
      Object.defineProperty(navigator, 'plugins', {
        get: function() {
          return [
            {
              0: {
                type: "application/x-google-chrome-pdf",
                suffixes: "pdf",
                description: "Portable Document Format",
                enabledPlugin: Plugin
              },
              description: "Portable Document Format",
              filename: "internal-pdf-viewer",
              length: 1,
              name: "Chrome PDF Plugin"
            },
            {
              0: {
                type: "application/pdf",
                suffixes: "pdf",
                description: "",
                enabledPlugin: Plugin
              },
              description: "",
              filename: "mhjfbmdgcfjbbpaeojofohoefgiehjai",
              length: 1,
              name: "Chrome PDF Viewer"
            },
            {
              0: {
                type: "application/x-nacl",
                suffixes: "",
                description: "Native Client Executable",
                enabledPlugin: Plugin
              },
              1: {
                type: "application/x-pnacl",
                suffixes: "",
                description: "Portable Native Client Executable",
                enabledPlugin: Plugin
              },
              description: "",
              filename: "internal-nacl-plugin",
              length: 2,
              name: "Native Client"
            }
          ];
        }
      });

      // Override the languages property to use a custom getter
      Object.defineProperty(navigator, 'languages', {
        get: function() {
          return ['en-US', 'en'];
        }
      });

      // Override the webdriver property
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });

      // Mock the permissions API
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission }) :
          originalQuery(parameters)
      );

      // Override the chrome property
      window.chrome = {
        runtime: {},
        loadTimes: function() {
          return {
            commitLoadTime: Date.now() / 1000 - Math.random(),
            connectionInfo: 'http/1.1',
            finishDocumentLoadTime: Date.now() / 1000 - Math.random(),
            finishLoadTime: Date.now() / 1000 - Math.random(),
            firstPaintAfterLoadTime: 0,
            firstPaintTime: Date.now() / 1000 - Math.random(),
            navigationType: 'Other',
            npnNegotiatedProtocol: 'unknown',
            requestTime: Date.now() / 1000 - Math.random(),
            startLoadTime: Date.now() / 1000 - Math.random(),
            wasAlternateProtocolAvailable: false,
            wasFetchedViaSpdy: false,
            wasNpnNegotiated: false
          };
        },
        csi: function() {
          return {
            onloadT: Date.now(),
            pageT: Date.now() - Math.random() * 1000,
            startE: Date.now() - Math.random() * 2000,
            tran: 15
          };
        }
      };

      // Add toString methods to make them look native
      const toStringProxy = (obj, name) => {
        const handler = {
          apply: function(target, thisArg, argumentsList) {
            return \`function \${name}() { [native code] }\`;
          }
        };
        return new Proxy(obj.toString, handler);
      };

      navigator.plugins.toString = toStringProxy(navigator.plugins, 'plugins');
      navigator.languages.toString = toStringProxy(navigator.languages, 'languages');

      // Mock battery API
      Object.defineProperty(navigator, 'getBattery', {
        value: () => Promise.resolve({
          charging: true,
          chargingTime: 0,
          dischargingTime: Infinity,
          level: 1
        })
      });

      // Mock connection API
      Object.defineProperty(navigator, 'connection', {
        value: {
          downlink: 10,
          effectiveType: '4g',
          onchange: null,
          rtt: 50,
          saveData: false
        }
      });

      // Mock hardwareConcurrency
      Object.defineProperty(navigator, 'hardwareConcurrency', {
        value: 4
      });

      // Mock deviceMemory
      Object.defineProperty(navigator, 'deviceMemory', {
        value: 8
      });
    `;
  }

  async simulateHumanBehavior(page) {
    // Random mouse movements
    const viewport = page.viewportSize();
    for (let i = 0; i < 3; i++) {
      const x = Math.random() * viewport.width;
      const y = Math.random() * viewport.height;
      await page.mouse.move(x, y, { steps: 10 });
      await this.randomDelay(100, 500);
    }
  }

  async humanType(page, selector, text, options = {}) {
    await page.focus(selector);
    await this.randomDelay(100, 300);
    
    for (const char of text) {
      await page.keyboard.type(char);
      await this.randomDelay(50, 150);
    }
    
    if (options.pressEnter) {
      await this.randomDelay(200, 500);
      await page.keyboard.press('Enter');
    }
  }

  async humanClick(page, selector, options = {}) {
    const element = await page.locator(selector);
    const box = await element.boundingBox();
    
    if (box) {
      // Move mouse to element with some randomness
      const x = box.x + box.width / 2 + (Math.random() - 0.5) * 10;
      const y = box.y + box.height / 2 + (Math.random() - 0.5) * 10;
      
      await page.mouse.move(x, y, { steps: 5 });
      await this.randomDelay(100, 300);
      await page.mouse.click(x, y);
    } else {
      // Fallback to regular click
      await element.click();
    }
  }

  async randomScroll(page) {
    const scrollDistance = Math.random() * 500 + 200;
    await page.evaluate((distance) => {
      window.scrollBy(0, distance);
    }, scrollDistance);
    await this.randomDelay(500, 1500);
  }

  randomDelay(min = 500, max = 2000) {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  async addRandomBehavior(page) {
    // Randomly perform human-like actions
    const actions = ['move', 'scroll', 'wait'];
    const action = actions[Math.floor(Math.random() * actions.length)];
    
    switch (action) {
      case 'move':
        await this.simulateHumanBehavior(page);
        break;
      case 'scroll':
        await this.randomScroll(page);
        break;
      case 'wait':
        await this.randomDelay(1000, 3000);
        break;
    }
  }
}

module.exports = StealthService;


class ProxyService {
  constructor() {
    this.proxies = [];
    this.currentProxyIndex = 0;
    this.proxyRotationEnabled = false;
    this.proxyTestResults = new Map();
  }

  addProxy(proxy) {
    // Proxy format: { host, port, username?, password?, type? }
    const proxyConfig = {
      host: proxy.host,
      port: proxy.port,
      username: proxy.username || null,
      password: proxy.password || null,
      type: proxy.type || 'http', // http, https, socks4, socks5
      id: `${proxy.host}:${proxy.port}`,
      active: true,
      lastUsed: null,
      failCount: 0,
      successCount: 0
    };

    this.proxies.push(proxyConfig);
    return proxyConfig.id;
  }

  removeProxy(proxyId) {
    this.proxies = this.proxies.filter(p => p.id !== proxyId);
  }

  enableRotation(enabled = true) {
    this.proxyRotationEnabled = enabled;
  }

  getCurrentProxy() {
    if (!this.proxyRotationEnabled || this.proxies.length === 0) {
      return null;
    }

    const activeProxies = this.proxies.filter(p => p.active);
    if (activeProxies.length === 0) {
      return null;
    }

    const proxy = activeProxies[this.currentProxyIndex % activeProxies.length];
    proxy.lastUsed = new Date();
    
    return proxy;
  }

  getNextProxy() {
    if (!this.proxyRotationEnabled || this.proxies.length === 0) {
      return null;
    }

    const activeProxies = this.proxies.filter(p => p.active);
    if (activeProxies.length === 0) {
      return null;
    }

    this.currentProxyIndex = (this.currentProxyIndex + 1) % activeProxies.length;
    return this.getCurrentProxy();
  }

  getPlaywrightProxyConfig(proxy = null) {
    const targetProxy = proxy || this.getCurrentProxy();
    
    if (!targetProxy) {
      return null;
    }

    const config = {
      server: `${targetProxy.type}://${targetProxy.host}:${targetProxy.port}`
    };

    if (targetProxy.username && targetProxy.password) {
      config.username = targetProxy.username;
      config.password = targetProxy.password;
    }

    return config;
  }

  async testProxy(proxy, timeout = 10000) {
    try {
      const { chromium } = require('playwright');
      
      const proxyConfig = this.getPlaywrightProxyConfig(proxy);
      if (!proxyConfig) {
        throw new Error('Invalid proxy configuration');
      }

      const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      const context = await browser.newContext({
        proxy: proxyConfig
      });

      const page = await context.newPage();
      
      // Test with a simple HTTP request
      const startTime = Date.now();
      await page.goto('http://httpbin.org/ip', { 
        waitUntil: 'networkidle',
        timeout: timeout 
      });
      
      const responseTime = Date.now() - startTime;
      const content = await page.textContent('body');
      
      await browser.close();

      // Parse the response to get IP
      let proxyIP = null;
      try {
        const ipData = JSON.parse(content);
        proxyIP = ipData.origin;
      } catch (e) {
        // Fallback if JSON parsing fails
        proxyIP = 'unknown';
      }

      const result = {
        success: true,
        responseTime: responseTime,
        proxyIP: proxyIP,
        timestamp: new Date(),
        error: null
      };

      this.proxyTestResults.set(proxy.id, result);
      proxy.successCount++;
      proxy.failCount = Math.max(0, proxy.failCount - 1); // Reduce fail count on success
      
      return result;

    } catch (error) {
      const result = {
        success: false,
        responseTime: null,
        proxyIP: null,
        timestamp: new Date(),
        error: error.message
      };

      this.proxyTestResults.set(proxy.id, result);
      proxy.failCount++;
      
      // Disable proxy if it fails too many times
      if (proxy.failCount >= 3) {
        proxy.active = false;
      }

      return result;
    }
  }

  async testAllProxies() {
    const results = [];
    
    for (const proxy of this.proxies) {
      const result = await this.testProxy(proxy);
      results.push({
        proxyId: proxy.id,
        ...result
      });
    }

    return results;
  }

  getProxyStats() {
    const stats = {
      total: this.proxies.length,
      active: this.proxies.filter(p => p.active).length,
      inactive: this.proxies.filter(p => !p.active).length,
      rotationEnabled: this.proxyRotationEnabled,
      currentProxy: this.getCurrentProxy()?.id || null
    };

    // Add individual proxy stats
    stats.proxies = this.proxies.map(proxy => ({
      id: proxy.id,
      host: proxy.host,
      port: proxy.port,
      type: proxy.type,
      active: proxy.active,
      lastUsed: proxy.lastUsed,
      successCount: proxy.successCount,
      failCount: proxy.failCount,
      testResult: this.proxyTestResults.get(proxy.id) || null
    }));

    return stats;
  }

  loadProxiesFromList(proxyList) {
    // proxyList format: ["host:port", "host:port:username:password", ...]
    const loaded = [];
    
    for (const proxyString of proxyList) {
      try {
        const parts = proxyString.split(':');
        
        if (parts.length >= 2) {
          const proxy = {
            host: parts[0],
            port: parseInt(parts[1]),
            username: parts[2] || null,
            password: parts[3] || null,
            type: 'http'
          };

          const proxyId = this.addProxy(proxy);
          loaded.push(proxyId);
        }
      } catch (error) {
        console.error(`Failed to parse proxy: ${proxyString}`, error);
      }
    }

    return loaded;
  }

  exportProxies() {
    return this.proxies.map(proxy => ({
      host: proxy.host,
      port: proxy.port,
      username: proxy.username,
      password: proxy.password,
      type: proxy.type,
      active: proxy.active
    }));
  }

  clearProxies() {
    this.proxies = [];
    this.currentProxyIndex = 0;
    this.proxyTestResults.clear();
  }

  // Automatic proxy rotation for failed requests
  async handleProxyFailure(failedProxy) {
    if (failedProxy) {
      failedProxy.failCount++;
      
      if (failedProxy.failCount >= 3) {
        failedProxy.active = false;
        console.log(`Proxy ${failedProxy.id} disabled due to repeated failures`);
      }
    }

    // Get next working proxy
    return this.getNextProxy();
  }

  // Get random proxy instead of sequential
  getRandomProxy() {
    if (!this.proxyRotationEnabled || this.proxies.length === 0) {
      return null;
    }

    const activeProxies = this.proxies.filter(p => p.active);
    if (activeProxies.length === 0) {
      return null;
    }

    const randomIndex = Math.floor(Math.random() * activeProxies.length);
    const proxy = activeProxies[randomIndex];
    proxy.lastUsed = new Date();
    
    return proxy;
  }

  // Get proxy with best performance
  getBestProxy() {
    if (!this.proxyRotationEnabled || this.proxies.length === 0) {
      return null;
    }

    const activeProxies = this.proxies.filter(p => p.active);
    if (activeProxies.length === 0) {
      return null;
    }

    // Sort by success rate and response time
    const sortedProxies = activeProxies.sort((a, b) => {
      const aSuccessRate = a.successCount / (a.successCount + a.failCount) || 0;
      const bSuccessRate = b.successCount / (b.successCount + b.failCount) || 0;
      
      if (aSuccessRate !== bSuccessRate) {
        return bSuccessRate - aSuccessRate; // Higher success rate first
      }

      // If success rates are equal, prefer faster proxy
      const aResult = this.proxyTestResults.get(a.id);
      const bResult = this.proxyTestResults.get(b.id);
      
      if (aResult && bResult) {
        return (aResult.responseTime || Infinity) - (bResult.responseTime || Infinity);
      }

      return 0;
    });

    const proxy = sortedProxies[0];
    proxy.lastUsed = new Date();
    
    return proxy;
  }
}

module.exports = ProxyService;


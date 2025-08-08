const axios = require('axios');

class CaptchaService {
  constructor() {
    this.apiKey = null;
    this.service = '2captcha'; // Default service
    this.baseUrls = {
      '2captcha': 'http://2captcha.com',
      'anticaptcha': 'https://api.anti-captcha.com'
    };
  }

  setApiKey(apiKey, service = '2captcha') {
    this.apiKey = apiKey;
    this.service = service;
  }

  async solveCaptcha(captchaData) {
    if (!this.apiKey) {
      throw new Error('Captcha API key not configured');
    }

    switch (this.service) {
      case '2captcha':
        return await this.solve2Captcha(captchaData);
      case 'anticaptcha':
        return await this.solveAntiCaptcha(captchaData);
      default:
        throw new Error('Unsupported captcha service');
    }
  }

  async solve2Captcha(captchaData) {
    try {
      const { type, data } = captchaData;
      let submitResponse;

      switch (type) {
        case 'image':
          submitResponse = await this.submit2CaptchaImage(data);
          break;
        case 'recaptcha':
          submitResponse = await this.submit2CaptchaRecaptcha(data);
          break;
        case 'hcaptcha':
          submitResponse = await this.submit2CaptchaHCaptcha(data);
          break;
        default:
          throw new Error('Unsupported captcha type for 2captcha');
      }

      if (submitResponse.status !== 1) {
        throw new Error(`2captcha submission failed: ${submitResponse.error_text}`);
      }

      const captchaId = submitResponse.request;
      return await this.get2CaptchaResult(captchaId);

    } catch (error) {
      console.error('2captcha solving error:', error);
      throw error;
    }
  }

  async submit2CaptchaImage(imageData) {
    const formData = new FormData();
    formData.append('key', this.apiKey);
    formData.append('method', 'base64');
    formData.append('body', imageData);

    const response = await axios.post(`${this.baseUrls['2captcha']}/in.php`, formData);
    return this.parse2CaptchaResponse(response.data);
  }

  async submit2CaptchaRecaptcha(data) {
    const { sitekey, pageurl, invisible = false } = data;
    
    const params = {
      key: this.apiKey,
      method: 'userrecaptcha',
      googlekey: sitekey,
      pageurl: pageurl,
      invisible: invisible ? 1 : 0
    };

    const response = await axios.post(`${this.baseUrls['2captcha']}/in.php`, null, { params });
    return this.parse2CaptchaResponse(response.data);
  }

  async submit2CaptchaHCaptcha(data) {
    const { sitekey, pageurl } = data;
    
    const params = {
      key: this.apiKey,
      method: 'hcaptcha',
      sitekey: sitekey,
      pageurl: pageurl
    };

    const response = await axios.post(`${this.baseUrls['2captcha']}/in.php`, null, { params });
    return this.parse2CaptchaResponse(response.data);
  }

  async get2CaptchaResult(captchaId, maxAttempts = 30) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await this.delay(5000); // Wait 5 seconds between attempts

      const params = {
        key: this.apiKey,
        action: 'get',
        id: captchaId
      };

      const response = await axios.get(`${this.baseUrls['2captcha']}/res.php`, { params });
      const result = this.parse2CaptchaResponse(response.data);

      if (result.status === 1) {
        return {
          success: true,
          solution: result.request,
          captchaId: captchaId
        };
      } else if (result.error_text && result.error_text !== 'CAPCHA_NOT_READY') {
        throw new Error(`2captcha result error: ${result.error_text}`);
      }
    }

    throw new Error('2captcha solving timeout');
  }

  parse2CaptchaResponse(responseText) {
    if (responseText.startsWith('OK|')) {
      return {
        status: 1,
        request: responseText.split('|')[1]
      };
    } else if (responseText.startsWith('ERROR_')) {
      return {
        status: 0,
        error_text: responseText
      };
    } else {
      return {
        status: 0,
        error_text: responseText
      };
    }
  }

  async solveAntiCaptcha(captchaData) {
    try {
      const { type, data } = captchaData;
      let task;

      switch (type) {
        case 'image':
          task = {
            type: 'ImageToTextTask',
            body: data
          };
          break;
        case 'recaptcha':
          task = {
            type: 'NoCaptchaTaskProxyless',
            websiteURL: data.pageurl,
            websiteKey: data.sitekey
          };
          break;
        case 'hcaptcha':
          task = {
            type: 'HCaptchaTaskProxyless',
            websiteURL: data.pageurl,
            websiteKey: data.sitekey
          };
          break;
        default:
          throw new Error('Unsupported captcha type for AntiCaptcha');
      }

      const taskId = await this.submitAntiCaptchaTask(task);
      return await this.getAntiCaptchaResult(taskId);

    } catch (error) {
      console.error('AntiCaptcha solving error:', error);
      throw error;
    }
  }

  async submitAntiCaptchaTask(task) {
    const payload = {
      clientKey: this.apiKey,
      task: task
    };

    const response = await axios.post(`${this.baseUrls['anticaptcha']}/createTask`, payload);
    const result = response.data;

    if (result.errorId !== 0) {
      throw new Error(`AntiCaptcha task submission failed: ${result.errorDescription}`);
    }

    return result.taskId;
  }

  async getAntiCaptchaResult(taskId, maxAttempts = 30) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await this.delay(5000);

      const payload = {
        clientKey: this.apiKey,
        taskId: taskId
      };

      const response = await axios.post(`${this.baseUrls['anticaptcha']}/getTaskResult`, payload);
      const result = response.data;

      if (result.errorId !== 0) {
        throw new Error(`AntiCaptcha result error: ${result.errorDescription}`);
      }

      if (result.status === 'ready') {
        return {
          success: true,
          solution: result.solution.text || result.solution.gRecaptchaResponse,
          taskId: taskId
        };
      }
    }

    throw new Error('AntiCaptcha solving timeout');
  }

  async testApiKey(apiKey, service = '2captcha') {
    try {
      const oldApiKey = this.apiKey;
      const oldService = this.service;
      
      this.setApiKey(apiKey, service);

      if (service === '2captcha') {
        const params = {
          key: apiKey,
          action: 'getbalance'
        };
        const response = await axios.get(`${this.baseUrls['2captcha']}/res.php`, { params });
        const isValid = !response.data.startsWith('ERROR_');
        
        // Restore old settings
        this.apiKey = oldApiKey;
        this.service = oldService;
        
        return isValid;
      } else if (service === 'anticaptcha') {
        const payload = {
          clientKey: apiKey
        };
        const response = await axios.post(`${this.baseUrls['anticaptcha']}/getBalance`, payload);
        const isValid = response.data.errorId === 0;
        
        // Restore old settings
        this.apiKey = oldApiKey;
        this.service = oldService;
        
        return isValid;
      }

      return false;
    } catch (error) {
      console.error('Captcha API key test failed:', error);
      return false;
    }
  }

  async detectCaptcha(page) {
    try {
      const captchaTypes = [];

      // Check for reCAPTCHA
      const recaptcha = await page.$('.g-recaptcha, [data-sitekey]');
      if (recaptcha) {
        const sitekey = await recaptcha.getAttribute('data-sitekey');
        if (sitekey) {
          captchaTypes.push({
            type: 'recaptcha',
            element: recaptcha,
            sitekey: sitekey,
            pageurl: page.url()
          });
        }
      }

      // Check for hCaptcha
      const hcaptcha = await page.$('.h-captcha, [data-sitekey]');
      if (hcaptcha) {
        const sitekey = await hcaptcha.getAttribute('data-sitekey');
        if (sitekey) {
          captchaTypes.push({
            type: 'hcaptcha',
            element: hcaptcha,
            sitekey: sitekey,
            pageurl: page.url()
          });
        }
      }

      // Check for image captcha
      const imageCaptcha = await page.$('img[src*="captcha"], img[alt*="captcha"], img[id*="captcha"]');
      if (imageCaptcha) {
        const src = await imageCaptcha.getAttribute('src');
        if (src) {
          captchaTypes.push({
            type: 'image',
            element: imageCaptcha,
            src: src
          });
        }
      }

      return captchaTypes;
    } catch (error) {
      console.error('Error detecting captcha:', error);
      return [];
    }
  }

  async solveCaptchaOnPage(page, logCallback) {
    try {
      const captchas = await this.detectCaptcha(page);
      
      if (captchas.length === 0) {
        logCallback('No captcha detected on page', 'info');
        return true;
      }

      logCallback(`Found ${captchas.length} captcha(s) on page`, 'info');

      for (const captcha of captchas) {
        logCallback(`Solving ${captcha.type} captcha...`, 'info');
        
        let captchaData;
        if (captcha.type === 'image') {
          // Get image as base64
          const imageBase64 = await this.getImageAsBase64(page, captcha.src);
          captchaData = { type: 'image', data: imageBase64 };
        } else {
          captchaData = { 
            type: captcha.type, 
            data: {
              sitekey: captcha.sitekey,
              pageurl: captcha.pageurl
            }
          };
        }

        const solution = await this.solveCaptcha(captchaData);
        
        if (solution.success) {
          logCallback(`Captcha solved: ${solution.solution.substring(0, 20)}...`, 'success');
          
          // Apply solution to page
          await this.applyCaptchaSolution(page, captcha, solution.solution);
          return true;
        } else {
          logCallback('Failed to solve captcha', 'error');
        }
      }

      return false;
    } catch (error) {
      logCallback(`Captcha solving error: ${error.message}`, 'error');
      return false;
    }
  }

  async getImageAsBase64(page, imageSrc) {
    // If it's a relative URL, make it absolute
    if (imageSrc.startsWith('/')) {
      const url = new URL(page.url());
      imageSrc = `${url.protocol}//${url.host}${imageSrc}`;
    }

    // Download image and convert to base64
    const response = await axios.get(imageSrc, { responseType: 'arraybuffer' });
    return Buffer.from(response.data, 'binary').toString('base64');
  }

  async applyCaptchaSolution(page, captcha, solution) {
    try {
      if (captcha.type === 'image') {
        // Find input field near the captcha image
        const input = await page.$('input[type="text"], input[name*="captcha"], input[id*="captcha"]');
        if (input) {
          await input.fill(solution);
        }
      } else if (captcha.type === 'recaptcha') {
        // Inject reCAPTCHA solution
        await page.evaluate((token) => {
          if (window.grecaptcha && window.grecaptcha.getResponse) {
            // Find the reCAPTCHA widget and set the response
            const widgets = document.querySelectorAll('.g-recaptcha');
            widgets.forEach(widget => {
              const widgetId = widget.getAttribute('data-widget-id');
              if (widgetId !== null) {
                window.grecaptcha.getResponse(widgetId);
              }
            });
          }
          
          // Set the response in hidden textarea
          const textarea = document.querySelector('textarea[name="g-recaptcha-response"]');
          if (textarea) {
            textarea.value = token;
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }, solution);
      } else if (captcha.type === 'hcaptcha') {
        // Inject hCaptcha solution
        await page.evaluate((token) => {
          const textarea = document.querySelector('textarea[name="h-captcha-response"]');
          if (textarea) {
            textarea.value = token;
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }, solution);
      }
    } catch (error) {
      console.error('Error applying captcha solution:', error);
      throw error;
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = CaptchaService;


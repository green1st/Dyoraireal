# AI Web Agent - Installation Guide

## 📋 System Requirements

### Minimum Requirements
- **OS**: Windows 10/11, macOS 10.15+, Ubuntu 18.04+
- **Node.js**: Version 18.0 or higher
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 2GB free space
- **Internet**: Stable connection for AI API calls

### Recommended Requirements
- **OS**: Latest version of your operating system
- **Node.js**: Version 20.0 or higher
- **RAM**: 16GB for optimal performance
- **Storage**: 5GB free space
- **Internet**: High-speed broadband connection

## 🛠️ Step-by-Step Installation

### Step 1: Install Node.js

**Windows:**
1. Download Node.js from [nodejs.org](https://nodejs.org)
2. Run the installer (.msi file)
3. Follow installation wizard
4. Verify installation:
```cmd
node --version
npm --version
```

**macOS:**
```bash
# Using Homebrew (recommended)
brew install node

# Or download from nodejs.org
```

**Linux (Ubuntu/Debian):**
```bash
# Update package index
sudo apt update

# Install Node.js
sudo apt install nodejs npm

# Verify installation
node --version
npm --version
```

### Step 2: Download AI Web Agent

**Option A: Extract from ZIP**
1. Extract the provided ZIP file
2. Navigate to extracted folder
```bash
cd ai_web_agent
```

**Option B: Clone from Repository (if available)**
```bash
git clone <repository-url>
cd ai_web_agent
```

### Step 3: Install Dependencies

```bash
# Install all required packages
npm install

# This will install:
# - express (web framework)
# - playwright (browser automation)
# - @google/generative-ai (Gemini AI)
# - sqlite3 (database)
# - cors, dotenv, uuid, axios
```

### Step 4: Install Browser Dependencies

```bash
# Install Playwright browsers
npx playwright install

# This downloads Chrome, Firefox, Safari browsers
# Required for automation functionality
```

### Step 5: Verify Installation

```bash
# Check if all dependencies are installed
npm list

# Verify Playwright installation
npx playwright --version
```

## ⚙️ Configuration

### Step 1: Environment Setup

The `.env` file is already configured with Gemini API key:
```env
GEMINI_API_KEY=AIzaSyBjos5S03noZxcYqU-eKPWbhw1DDQixP_E
NODE_ENV=development
PORT=3000
```

### Step 2: Database Initialization

Database will be created automatically on first run:
```bash
# Database location
data/ai_agent.db

# Tables created automatically:
# - tasks (task storage)
# - logs (execution logs)  
# - settings (configuration)
```

### Step 3: Test Installation

```bash
# Start the application
node index.js

# Expected output:
# AI Web Agent backend listening at http://localhost:3000
# Environment: development
```

### Step 4: Access Dashboard

1. Open web browser
2. Navigate to: `http://localhost:3000`
3. You should see the AI Web Agent Dashboard

## 🔧 Advanced Configuration

### Custom Port Configuration

Edit `.env` file:
```env
PORT=8080  # Change to desired port
```

Or set environment variable:
```bash
# Windows
set PORT=8080 && node index.js

# macOS/Linux
PORT=8080 node index.js
```

### Database Location

Default location: `data/ai_agent.db`

To change location, modify `src/models/database.js`:
```javascript
this.dbPath = path.join(__dirname, '../../custom/path/database.db');
```

### Browser Configuration

Edit `src/services/browserService.js` for custom browser settings:
```javascript
// Custom viewport size
viewport: { width: 1920, height: 1080 }

// Different browser
const { firefox } = require('playwright');
// or
const { webkit } = require('playwright');
```

## 🚀 Running the Application

### Development Mode

```bash
# Standard run
node index.js

# With debug logging
DEBUG=* node index.js

# With custom port
PORT=8080 node index.js
```

### Production Mode

```bash
# Set production environment
NODE_ENV=production node index.js

# Or use PM2 for process management
npm install -g pm2
pm2 start index.js --name "ai-web-agent"
```

### Auto-restart on Changes

```bash
# Install nodemon for development
npm install -g nodemon

# Run with auto-restart
nodemon index.js
```

## 🔍 Verification Checklist

### ✅ Installation Verification

- [ ] Node.js version 18+ installed
- [ ] npm packages installed successfully
- [ ] Playwright browsers downloaded
- [ ] Application starts without errors
- [ ] Dashboard accessible at localhost:3000
- [ ] Database file created in data/ folder

### ✅ Functionality Tests

- [ ] Can create new tasks
- [ ] Browser opens when executing tasks
- [ ] Settings modal opens and saves
- [ ] Task history displays correctly
- [ ] API endpoints respond correctly

### ✅ API Tests

```bash
# Test health endpoint
curl http://localhost:3000/api/health

# Expected response:
# {"status":"ok","timestamp":"...","version":"1.0.0"}

# Test tasks endpoint
curl http://localhost:3000/api/tasks

# Expected response: JSON array of tasks
```

## 🐛 Troubleshooting Installation

### Common Issues

**1. Node.js Version Error**
```
Error: Node.js version 16.x is not supported
```
**Solution**: Upgrade to Node.js 18+

**2. Playwright Installation Failed**
```
Error: Failed to download browsers
```
**Solution**: 
```bash
# Clear npm cache
npm cache clean --force

# Reinstall Playwright
npx playwright install --force
```

**3. SQLite Installation Error**
```
Error: Cannot find module 'sqlite3'
```
**Solution**:
```bash
# Rebuild native modules
npm rebuild sqlite3

# Or install with specific Python version
npm install sqlite3 --python=python3
```

**4. Permission Errors (Linux/macOS)**
```
Error: EACCES permission denied
```
**Solution**:
```bash
# Fix npm permissions
sudo chown -R $(whoami) ~/.npm

# Or use node version manager
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20
nvm use 20
```

**5. Port Already in Use**
```
Error: listen EADDRINUSE :::3000
```
**Solution**:
```bash
# Find process using port 3000
lsof -i :3000  # macOS/Linux
netstat -ano | findstr :3000  # Windows

# Kill process or use different port
PORT=8080 node index.js
```

### System-Specific Issues

**Windows:**
- Install Visual Studio Build Tools if native modules fail
- Use PowerShell or Command Prompt as Administrator
- Disable antivirus temporarily during installation

**macOS:**
- Install Xcode Command Line Tools: `xcode-select --install`
- Use Homebrew for package management
- Grant accessibility permissions for browser automation

**Linux:**
- Install build essentials: `sudo apt install build-essential`
- Install additional dependencies: `sudo apt install libnss3-dev libatk-bridge2.0-dev libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxrandr2 libgbm1 libxss1 libasound2`

## 📊 Performance Optimization

### Memory Usage
```bash
# Monitor memory usage
node --max-old-space-size=4096 index.js

# For systems with limited RAM
node --max-old-space-size=2048 index.js
```

### Database Optimization
```bash
# Vacuum database periodically
sqlite3 data/ai_agent.db "VACUUM;"

# Check database size
ls -lh data/ai_agent.db
```

### Browser Performance
- Close unused browser instances
- Clear browser cache periodically
- Limit concurrent tasks

## 🔄 Updates and Maintenance

### Updating Dependencies
```bash
# Check for outdated packages
npm outdated

# Update all packages
npm update

# Update specific package
npm install package-name@latest
```

### Database Maintenance
```bash
# Backup database
cp data/ai_agent.db data/ai_agent_backup.db

# Clean old logs (via API)
curl -X POST http://localhost:3000/api/data/cleanup \
  -H "Content-Type: application/json" \
  -d '{"daysOld": 30}'
```

### Log Management
```bash
# View application logs
tail -f logs/app.log  # if logging to file

# Clear browser cache
rm -rf ~/.cache/ms-playwright/  # Linux/macOS
```

## 🎯 Next Steps

After successful installation:

1. **Configure API Keys**: Add captcha service API keys in Settings
2. **Test Basic Commands**: Try simple automation tasks
3. **Setup Proxies**: Configure proxy list if needed
4. **Explore Features**: Test different automation scenarios
5. **Monitor Performance**: Check task execution and system resources

## 📞 Support

If you encounter issues during installation:

1. Check this troubleshooting guide
2. Verify system requirements
3. Review error messages carefully
4. Test with minimal configuration first
5. Check Node.js and npm versions

---

**Installation Complete!** 🎉

Your AI Web Agent is now ready to automate web tasks with intelligent AI guidance.


# AI Web Agent - Intelligent Browser Automation System

## 🤖 Overview

AI Web Agent adalah sistem otomasi browser cerdas yang menggunakan AI (Gemini) untuk memahami perintah bahasa natural dan mengeksekusinya secara otomatis di browser. Sistem ini dilengkapi dengan fitur anti-bot, captcha solving, dan proxy rotation untuk automation yang lebih robust.

## ✨ Key Features

### 🧠 AI-Powered Automation
- **Natural Language Processing**: Berikan perintah dalam bahasa natural (Indonesia/English)
- **Intelligent Planning**: AI membuat execution plan step-by-step
- **Adaptive Execution**: Sistem beradaptasi dengan kondisi halaman web

### 🌐 Advanced Browser Automation
- **Visible Browser Mode**: Lihat automation berjalan secara real-time
- **Stealth Technology**: Anti-detection dengan fingerprint spoofing
- **Human-like Behavior**: Mouse movement dan typing yang natural
- **Multi-step Tasks**: Eksekusi task kompleks dengan multiple steps

### 🛡️ Anti-Bot & Security Features
- **Captcha Solving**: Support 2captcha dan AntiCaptcha
- **Proxy Rotation**: Automatic proxy switching untuk anonymity
- **Stealth Headers**: Browser fingerprint masking
- **Random Delays**: Human-like timing simulation

### 📊 Management Dashboard
- **Real-time Monitoring**: Live task execution logs
- **Task History**: Riwayat semua task yang dijalankan
- **Settings Management**: Konfigurasi API keys dan proxy
- **Progress Tracking**: Visual progress bar dan status

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm atau yarn
- Chrome/Chromium browser

### Installation

1. **Clone atau extract project**
```bash
cd ai_web_agent
```

2. **Install dependencies**
```bash
npm install
```

3. **Setup environment**
```bash
# File .env sudah tersedia dengan Gemini API key
# Anda bisa menambahkan API key lain jika diperlukan
```

4. **Start the application**
```bash
node index.js
```

5. **Open dashboard**
```
http://localhost:3000
```

## 🎯 Usage Examples

### Basic Commands
```
Buka Google dan cari informasi tentang AI
Buka YouTube dan cari video tentang programming
Buka GitHub dan cari repository tentang automation
```

### Advanced Commands
```
Daftar akun baru di website example.com dengan email test@gmail.com
Isi form kontak di website company.com dengan nama John Doe
Ekstrak data produk dari halaman e-commerce
```

### Form Filling
```
Isi form pendaftaran dengan data:
- Nama: John Doe
- Email: john@example.com  
- Password: mypassword123
```

## ⚙️ Configuration

### 1. API Keys Setup

**Gemini AI (Required)**
- Buka Settings di dashboard
- Masukkan Gemini API key
- Test API key untuk memastikan valid

**Captcha Services (Optional)**
- 2captcha: Untuk solving image captcha dan reCAPTCHA
- AntiCaptcha: Alternative captcha solving service

### 2. Proxy Configuration

**Format Proxy List:**
```
host1:port1
host2:port2:username:password
host3:port3
```

**Proxy Settings:**
- Enable rotation untuk automatic switching
- Test proxies untuk check connectivity
- Monitor proxy performance

### 3. Browser Settings

**Visible Mode (Default)**
- Browser terbuka dan terlihat
- Window size: 1280x720
- Real-time automation viewing

**Headless Mode**
- Set `headless: true` di browserService
- Background execution
- Faster performance

## 🏗️ Architecture

### Backend Components
```
src/
├── controllers/     # API request handlers
├── services/        # Core business logic
├── models/          # Database models
├── routes/          # API routes
└── utils/           # Utility functions
```

### Key Services
- **AIService**: Gemini integration untuk command analysis
- **BrowserService**: Playwright automation dengan stealth
- **CaptchaService**: 2captcha/AntiCaptcha integration
- **ProxyService**: Proxy rotation dan management
- **StealthService**: Anti-detection measures

### Database
- **SQLite**: Local database untuk task dan logs
- **Tables**: tasks, logs, settings
- **Location**: `data/ai_agent.db`

## 🔧 API Endpoints

### Tasks
```
POST /api/tasks              # Create new task
GET  /api/tasks              # Get all tasks
GET  /api/tasks/:id          # Get specific task
GET  /api/tasks/:id/logs     # Get task logs
```

### Settings
```
GET  /api/settings           # Get configuration
PUT  /api/settings           # Update settings
POST /api/settings/test-api-key  # Test API keys
```

### Data Management
```
GET  /api/data/export        # Export data (CSV/JSON)
GET  /api/data/stats         # Database statistics
POST /api/data/cleanup       # Cleanup old data
```

## 🛠️ Advanced Features

### Custom Actions
Sistem mendukung berbagai aksi automation:
- `navigate`: Buka URL
- `click`: Klik element
- `type`: Input text
- `scroll`: Scroll halaman
- `extract`: Ambil data
- `screenshot`: Capture layar
- `fill_form`: Isi form otomatis
- `solve_captcha`: Solve captcha

### Error Handling
- Automatic retry untuk failed steps
- Captcha detection dan solving
- Proxy failover
- Browser recovery

### Logging System
- Real-time log streaming
- Multiple log levels (info, warning, error, success)
- Persistent log storage
- Export capabilities

## 🔒 Security & Privacy

### Data Protection
- Local database storage
- No data sent to external services (except AI API)
- Secure API key storage
- Session isolation

### Anti-Detection
- Browser fingerprint spoofing
- Random user agents
- Human-like behavior simulation
- Proxy rotation support

## 📈 Performance

### Optimization
- Efficient database queries
- Memory management
- Browser resource cleanup
- Concurrent task handling

### Monitoring
- Task execution metrics
- Browser performance tracking
- Database size monitoring
- API response times

## 🐛 Troubleshooting

### Common Issues

**Browser tidak terbuka**
- Check Playwright installation: `npx playwright install`
- Verify Chrome/Chromium availability
- Check system permissions

**Task gagal execute**
- Verify Gemini API key
- Check internet connection
- Review task logs untuk error details

**Captcha tidak ter-solve**
- Verify captcha API key
- Check service balance
- Test API key di settings

**Proxy tidak bekerja**
- Test proxy connectivity
- Verify proxy format
- Check proxy credentials

### Debug Mode
```bash
# Enable debug logging
DEBUG=* node index.js

# Check database
sqlite3 data/ai_agent.db ".tables"
```

## 🤝 Contributing

### Development Setup
1. Fork repository
2. Install dependencies
3. Make changes
4. Test thoroughly
5. Submit pull request

### Code Structure
- Follow existing patterns
- Add comprehensive comments
- Include error handling
- Write tests for new features

## 📄 License

This project is for educational and personal use only. Please respect website terms of service and applicable laws when using automation tools.

## 🆘 Support

### Documentation
- Check this README for basic usage
- Review code comments for technical details
- Check test results for functionality status

### Issues
- Browser automation issues: Check Playwright docs
- AI integration issues: Verify Gemini API key
- Database issues: Check SQLite installation

## 🎉 Acknowledgments

- **Playwright**: Browser automation framework
- **Google Gemini**: AI language model
- **Express.js**: Web framework
- **SQLite**: Database engine
- **Tailwind CSS**: UI styling

---

**Version**: 1.0.0  
**Last Updated**: August 8, 2025  
**Status**: Production Ready (85% functional)

Enjoy automating the web with AI! 🚀


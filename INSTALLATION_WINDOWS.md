# AI Web Agent - Windows Installation Guide

This guide provides step-by-step instructions to install and run the AI Web Agent on your Windows machine.

## 📋 System Requirements

### Minimum Requirements
- **OS**: Windows 10/11
- **Node.js**: Version 18.0 or higher
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 2GB free space
- **Internet**: Stable connection for AI API calls

### Recommended Requirements
- **OS**: Latest version of Windows
- **Node.js**: Version 20.0 or higher
- **RAM**: 16GB for optimal performance
- **Storage**: 5GB free space
- **Internet**: High-speed broadband connection

## 🛠️ Step-by-Step Installation

### Step 1: Install Node.js

1.  Download the Node.js installer (.msi file) from the official website: [nodejs.org](https://nodejs.org)
2.  Run the downloaded installer and follow the prompts in the installation wizard. It is recommended to keep all default settings.
3.  After installation, open your Command Prompt or PowerShell and verify the installation by typing:
    ```cmd
    node --version
    npm --version
    ```
    You should see the installed Node.js and npm versions.

### Step 2: Download AI Web Agent

1.  Download the provided project archive (e.g., `ai_web_agent_complete.tar.gz`).
2.  Extract the contents of the archive to a folder of your choice (e.g., `C:\AI_Web_Agent`). You might need a tool like 7-Zip to extract `.tar.gz` files.
3.  Open your Command Prompt or PowerShell and navigate to the extracted folder:
    ```cmd
    cd C:\AI_Web_Agent
    ```
    (Replace `C:\AI_Web_Agent` with the actual path where you extracted the project).

### Step 3: Install Dependencies

Once you are in the project directory, run the following command to install all necessary Node.js packages:

```cmd
npm install
```

This command will install required libraries such as `express` (web framework), `playwright` (browser automation), `@google/generative-ai` (Gemini AI), `sqlite3` (database), and others.

### Step 4: Install Browser Dependencies

AI Web Agent uses Playwright for browser automation. You need to install the necessary browser binaries by running:

```cmd
npx playwright install
```

This will download Chrome, Firefox, and Safari browsers, which are required for the automation functionality.

### Step 5: Verify Installation

To ensure all dependencies are correctly installed, you can run:

```cmd
npm list
```

And to verify Playwright installation:

```cmd
npx playwright --version
```

## ⚙️ Configuration

### Step 1: Environment Setup

The `.env` file in the project root is already configured with a Gemini API key and default settings:

```env
GEMINI_API_KEY=AIzaSyBjos5S03noZxcYqU-eKPWbhw1DDQixP_E
NODE_ENV=development
PORT=3000
```

### Step 2: Database Initialization

The SQLite database (`data/ai_agent.db`) will be created automatically the first time you run the application. It will contain tables for tasks, logs, and settings.

### Step 3: Test Installation

To start the application and test your installation, run:

```cmd
node index.js
```

You should see output similar to:
`AI Web Agent backend listening at http://localhost:3000`
`Environment: development`

### Step 4: Access Dashboard

1.  Open your web browser (e.g., Chrome, Firefox, Edge).
2.  Navigate to: `http://localhost:3000`
3.  You should now see the AI Web Agent Dashboard, ready for use.

## 🚀 Running the Application

To run the application in development mode, simply use:

```cmd
node index.js
```

## 🐛 Troubleshooting Installation (Windows Specific)

-   **Install Visual Studio Build Tools**: If you encounter errors related to native modules (like `sqlite3`), you might need to install Visual Studio Build Tools. You can download them from the Microsoft website.
-   **Administrator Privileges**: Use PowerShell or Command Prompt as an Administrator for installation steps if you face permission issues.
-   **Antivirus Interference**: Temporarily disable your antivirus software during the installation process if it interferes with package downloads or installations.
-   **Port Already in Use**: If you see `Error: listen EADDRINUSE :::3000`, another program is using port 3000. You can find and kill the process using `netstat -ano | findstr :3000` in Command Prompt, then use `taskkill /PID <PID> /F` to terminate it. Alternatively, you can change the port in the `.env` file (e.g., `PORT=8080`).

---

**Installation Complete!** 🎉

Your AI Web Agent is now ready to automate web tasks with intelligent AI guidance. If you encounter any further issues, please refer to the `README.md` for general troubleshooting or contact support.


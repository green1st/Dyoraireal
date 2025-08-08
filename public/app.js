class AIWebAgentDashboard {
    constructor() {
        this.currentTaskId = null;
        this.logPollingInterval = null;
        this.taskPollingInterval = null;
        this.init();
    }

    init() {
        // Initialize Lucide icons
        lucide.createIcons();

        // Bind event listeners
        this.bindEvents();

        // Load initial data
        this.loadTaskHistory();
        this.loadSettings();

        // Start polling for active tasks
        this.startTaskPolling();
    }

    bindEvents() {
        // Execute button
        document.getElementById('executeBtn').addEventListener('click', () => {
            this.executeCommand();
        });

        // Enter key in command input
        document.getElementById('commandInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.executeCommand();
            }
        });

        // Refresh button
        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.loadTaskHistory();
        });

        // Settings modal
        document.getElementById('settingsBtn').addEventListener('click', () => {
            this.showSettings();
        });

        document.getElementById('closeSettings').addEventListener('click', () => {
            this.hideSettings();
        });

        document.getElementById('saveSettings').addEventListener('click', () => {
            this.saveSettings();
        });

        document.getElementById('testApiKey').addEventListener('click', () => {
            this.testApiKey();
        });

        // Close modal on outside click
        document.getElementById('settingsModal').addEventListener('click', (e) => {
            if (e.target.id === 'settingsModal') {
                this.hideSettings();
            }
        });
    }

    async executeCommand() {
        const command = document.getElementById('commandInput').value.trim();
        if (!command) {
            this.showNotification('Please enter a command', 'error');
            return;
        }

        try {
            const response = await fetch('/api/tasks', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ command })
            });

            const result = await response.json();

            if (response.ok) {
                this.currentTaskId = result.taskId;
                this.showCurrentTask(command);
                this.startLogPolling();
                document.getElementById('commandInput').value = '';
                this.showNotification('Task started successfully', 'success');
            } else {
                this.showNotification(result.error || 'Failed to create task', 'error');
            }
        } catch (error) {
            console.error('Error executing command:', error);
            this.showNotification('Network error occurred', 'error');
        }
    }

    showCurrentTask(command) {
        const section = document.getElementById('currentTaskSection');
        const commandDiv = document.getElementById('currentCommand');
        
        commandDiv.textContent = `Command: ${command}`;
        section.classList.remove('hidden');
        
        // Reset progress
        this.updateProgress(0, 0, 'running');
        
        // Clear logs
        const logContainer = document.getElementById('logContainer');
        logContainer.innerHTML = '<div class="text-gray-500">Starting task execution...</div>';
    }

    updateProgress(completed, total, status) {
        const progressBar = document.getElementById('progressBar');
        const progressText = document.getElementById('progressText');
        const statusIndicator = document.getElementById('statusIndicator');
        const statusText = document.getElementById('statusText');

        const percentage = total > 0 ? (completed / total) * 100 : 0;
        progressBar.style.width = `${percentage}%`;
        progressText.textContent = `${completed}/${total} steps`;

        // Update status
        statusText.textContent = status.charAt(0).toUpperCase() + status.slice(1);
        
        switch (status) {
            case 'running':
                statusIndicator.className = 'w-3 h-3 rounded-full bg-yellow-500 animate-pulse';
                break;
            case 'completed':
                statusIndicator.className = 'w-3 h-3 rounded-full bg-green-500';
                break;
            case 'failed':
                statusIndicator.className = 'w-3 h-3 rounded-full bg-red-500';
                break;
            default:
                statusIndicator.className = 'w-3 h-3 rounded-full bg-gray-500';
        }
    }

    startLogPolling() {
        if (this.logPollingInterval) {
            clearInterval(this.logPollingInterval);
        }

        this.logPollingInterval = setInterval(async () => {
            if (this.currentTaskId) {
                await this.updateTaskLogs();
            }
        }, 1000);
    }

    async updateTaskLogs() {
        try {
            const response = await fetch(`/api/tasks/${this.currentTaskId}`);
            const task = await response.json();

            if (response.ok) {
                this.displayLogs(task.logs);
                
                // Update progress if task has results
                if (task.result) {
                    try {
                        const result = JSON.parse(task.result);
                        if (result.results) {
                            const completed = result.completedSteps || 0;
                            const total = result.totalSteps || 0;
                            this.updateProgress(completed, total, task.status);
                        }
                    } catch (e) {
                        // Ignore JSON parse errors
                    }
                }

                // Stop polling if task is complete
                if (task.status === 'completed' || task.status === 'failed') {
                    clearInterval(this.logPollingInterval);
                    this.currentTaskId = null;
                    this.loadTaskHistory(); // Refresh history
                    
                    setTimeout(() => {
                        document.getElementById('currentTaskSection').classList.add('hidden');
                    }, 5000);
                }
            }
        } catch (error) {
            console.error('Error updating task logs:', error);
        }
    }

    displayLogs(logs) {
        const logContainer = document.getElementById('logContainer');
        
        if (!logs || logs.length === 0) {
            logContainer.innerHTML = '<div class="text-gray-500">No logs yet...</div>';
            return;
        }

        const logHTML = logs.map(log => {
            const timestamp = new Date(log.timestamp).toLocaleTimeString();
            const levelColor = this.getLogLevelColor(log.level);
            
            return `
                <div class="log-entry flex gap-2 mb-1">
                    <span class="text-gray-400 text-xs">[${timestamp}]</span>
                    <span class="${levelColor} text-xs uppercase">${log.level}</span>
                    <span class="flex-1">${log.message}</span>
                </div>
            `;
        }).join('');

        logContainer.innerHTML = logHTML;
        logContainer.scrollTop = logContainer.scrollHeight;
    }

    getLogLevelColor(level) {
        switch (level) {
            case 'error': return 'text-red-400';
            case 'warning': return 'text-yellow-400';
            case 'success': return 'text-green-400';
            case 'info': 
            default: return 'text-blue-400';
        }
    }

    async loadTaskHistory() {
        try {
            const response = await fetch('/api/tasks');
            const tasks = await response.json();

            if (response.ok) {
                this.displayTaskHistory(tasks);
            } else {
                console.error('Failed to load task history');
            }
        } catch (error) {
            console.error('Error loading task history:', error);
        }
    }

    displayTaskHistory(tasks) {
        const historyContainer = document.getElementById('taskHistory');
        
        if (!tasks || tasks.length === 0) {
            historyContainer.innerHTML = '<div class="text-gray-500 text-center py-8">No tasks yet. Create your first task above!</div>';
            return;
        }

        const historyHTML = tasks.map(task => {
            const createdAt = new Date(task.created_at).toLocaleString();
            const statusColor = this.getStatusColor(task.status);
            const statusIcon = this.getStatusIcon(task.status);

            return `
                <div class="task-card border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div class="flex justify-between items-start mb-2">
                        <div class="flex-1">
                            <h3 class="font-medium text-gray-800 mb-1">${task.command}</h3>
                            <p class="text-sm text-gray-500">${createdAt}</p>
                        </div>
                        <div class="flex items-center gap-2">
                            <i data-lucide="${statusIcon}" class="w-4 h-4 ${statusColor}"></i>
                            <span class="text-sm font-medium ${statusColor}">${task.status}</span>
                        </div>
                    </div>
                    ${task.result ? `
                        <div class="mt-2 p-2 bg-gray-50 rounded text-sm">
                            <strong>Result:</strong> ${this.formatResult(task.result)}
                        </div>
                    ` : ''}
                    <div class="mt-2 flex gap-2">
                        <button onclick="dashboard.viewTaskDetails('${task.id}')" class="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200">
                            View Details
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        historyContainer.innerHTML = historyHTML;
        lucide.createIcons(); // Re-initialize icons
    }

    getStatusColor(status) {
        switch (status) {
            case 'completed': return 'text-green-600';
            case 'failed': return 'text-red-600';
            case 'running': return 'text-yellow-600';
            case 'pending': return 'text-gray-600';
            default: return 'text-gray-600';
        }
    }

    getStatusIcon(status) {
        switch (status) {
            case 'completed': return 'check-circle';
            case 'failed': return 'x-circle';
            case 'running': return 'loader';
            case 'pending': return 'clock';
            default: return 'circle';
        }
    }

    formatResult(result) {
        try {
            const parsed = JSON.parse(result);
            if (parsed.completedSteps && parsed.totalSteps) {
                return `Completed ${parsed.completedSteps}/${parsed.totalSteps} steps`;
            }
            return 'Task completed';
        } catch (e) {
            return result.substring(0, 100) + (result.length > 100 ? '...' : '');
        }
    }

    async viewTaskDetails(taskId) {
        try {
            const response = await fetch(`/api/tasks/${taskId}`);
            const task = await response.json();

            if (response.ok) {
                this.showTaskDetailsModal(task);
            }
        } catch (error) {
            console.error('Error loading task details:', error);
        }
    }

    showTaskDetailsModal(task) {
        // Create modal dynamically
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        modal.innerHTML = `
            <div class="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-96 overflow-y-auto">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-xl font-semibold">Task Details</h3>
                    <button onclick="this.closest('.fixed').remove()" class="text-gray-500 hover:text-gray-700">
                        <i data-lucide="x"></i>
                    </button>
                </div>
                <div class="space-y-4">
                    <div>
                        <strong>Command:</strong> ${task.command}
                    </div>
                    <div>
                        <strong>Status:</strong> ${task.status}
                    </div>
                    <div>
                        <strong>Created:</strong> ${new Date(task.created_at).toLocaleString()}
                    </div>
                    ${task.logs && task.logs.length > 0 ? `
                        <div>
                            <strong>Logs:</strong>
                            <div class="bg-gray-900 text-green-400 p-4 rounded-lg h-48 overflow-y-auto font-mono text-sm mt-2">
                                ${task.logs.map(log => `
                                    <div class="mb-1">
                                        <span class="text-gray-400">[${new Date(log.timestamp).toLocaleTimeString()}]</span>
                                        <span class="${this.getLogLevelColor(log.level)} uppercase">${log.level}</span>
                                        ${log.message}
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        lucide.createIcons();
    }

    startTaskPolling() {
        this.taskPollingInterval = setInterval(() => {
            this.loadTaskHistory();
        }, 10000); // Refresh every 10 seconds
    }

    showSettings() {
        document.getElementById('settingsModal').classList.remove('hidden');
        document.getElementById('settingsModal').classList.add('flex');
    }

    hideSettings() {
        document.getElementById('settingsModal').classList.add('hidden');
        document.getElementById('settingsModal').classList.remove('flex');
    }

    async loadSettings() {
        try {
            const response = await fetch('/api/settings');
            const settings = await response.json();

            if (response.ok) {
                document.getElementById('geminiApiKey').value = settings.geminiApiKey || '';
                document.getElementById('captchaApiKey').value = settings.captchaApiKey || '';
            }
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }

    async saveSettings() {
        const settings = {
            geminiApiKey: document.getElementById('geminiApiKey').value,
            captchaApiKey: document.getElementById('captchaApiKey').value
        };

        try {
            const response = await fetch('/api/settings', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(settings)
            });

            const result = await response.json();

            if (response.ok) {
                this.showNotification('Settings saved successfully', 'success');
                this.hideSettings();
            } else {
                this.showNotification(result.error || 'Failed to save settings', 'error');
            }
        } catch (error) {
            console.error('Error saving settings:', error);
            this.showNotification('Network error occurred', 'error');
        }
    }

    async testApiKey() {
        const apiKey = document.getElementById('geminiApiKey').value;
        
        if (!apiKey) {
            this.showNotification('Please enter an API key first', 'error');
            return;
        }

        try {
            const response = await fetch('/api/settings/test-api-key', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ apiKey, service: 'gemini' })
            });

            const result = await response.json();

            if (response.ok) {
                if (result.valid) {
                    this.showNotification('API key is valid!', 'success');
                } else {
                    this.showNotification('API key is invalid', 'error');
                }
            } else {
                this.showNotification(result.error || 'Failed to test API key', 'error');
            }
        } catch (error) {
            console.error('Error testing API key:', error);
            this.showNotification('Network error occurred', 'error');
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        const bgColor = type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500';
        
        notification.className = `fixed top-4 right-4 ${bgColor} text-white px-6 py-3 rounded-lg shadow-lg z-50 transform translate-x-full transition-transform`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // Slide in
        setTimeout(() => {
            notification.classList.remove('translate-x-full');
        }, 100);
        
        // Slide out and remove
        setTimeout(() => {
            notification.classList.add('translate-x-full');
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }
}

// Initialize dashboard
const dashboard = new AIWebAgentDashboard();


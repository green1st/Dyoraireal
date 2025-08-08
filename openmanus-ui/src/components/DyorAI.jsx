import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, Zap, Activity, Cpu, HardDrive, Wifi, RefreshCw, Power, Settings } from 'lucide-react';

const DyorAI = () => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [selectedAgent, setSelectedAgent] = useState('auto'); // Changed default to 'auto'
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [systemMetrics, setSystemMetrics] = useState({
    cpu_usage: 0,
    memory_usage: 0,
    network_activity: 0,
    active_agents: 4
  });
  const [autoSelectEnabled, setAutoSelectEnabled] = useState(true); // New state for auto-selection
  const [agentSuggestions, setAgentSuggestions] = useState([]); // New state for suggestions
  const [lastAutoSelection, setLastAutoSelection] = useState(null); // Track last auto-selection
  
  const messagesEndRef = useRef(null);
  const wsRef = useRef(null);

  const agents = [
    { id: 'auto', name: 'Auto Select', icon: '🤖', description: 'Automatically selects the best agent for your task', color: 'bg-gradient-to-r from-purple-500 to-pink-500' },
    { id: 'manus', name: 'Manus', icon: '🧠', description: 'General-purpose AI agent', color: 'bg-gradient-to-r from-blue-500 to-cyan-500' },
    { id: 'browser', name: 'Browser', icon: '🌐', description: 'Web automation specialist', color: 'bg-gradient-to-r from-green-500 to-emerald-500' },
    { id: 'data', name: 'DataAnalysis', icon: '📊', description: 'Data analysis expert', color: 'bg-gradient-to-r from-orange-500 to-red-500' },
    { id: 'swe', name: 'SWE', icon: '💻', description: 'Software engineering agent', color: 'bg-gradient-to-r from-indigo-500 to-purple-500' }
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    connectWebSocket();
    fetchSystemMetrics();
    
    const metricsInterval = setInterval(fetchSystemMetrics, 5000);
    
    return () => {
      clearInterval(metricsInterval);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const connectWebSocket = () => {
    try {
      wsRef.current = new WebSocket("ws://localhost:8002/ws");
      
      wsRef.current.onopen = () => {
        setIsConnected(true);
        console.log('WebSocket connected');
      };
      
      wsRef.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
      };
      
      wsRef.current.onclose = () => {
        setIsConnected(false);
        console.log('WebSocket disconnected');
        // Attempt to reconnect after 3 seconds
        setTimeout(connectWebSocket, 3000);
      };
      
      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsConnected(false);
      };
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      setIsConnected(false);
    }
  };

  const handleWebSocketMessage = (data) => {
    switch (data.type) {
      case 'connection_established':
        addSystemMessage(`Connected to Dyor AI with Auto-Agent Selection. Features: ${data.features?.join(', ')}`);
        break;
      case 'agent_selection':
        setLastAutoSelection(data);
        addSystemMessage(`🤖 Auto-selected ${data.selected_agent.toUpperCase()} agent (confidence: ${(data.confidence * 100).toFixed(1)}%)`);
        break;
      case 'agent_status':
        if (data.status === 'thinking') {
          setIsLoading(true);
          addSystemMessage(`${data.auto_selected ? '🤖 ' : ''}${data.agent.toUpperCase()} is ${data.status}...`);
        }
        break;
      case 'agent_response':
        setIsLoading(false);
        if (data.response) {
          addMessage('assistant', data.response.response, data.response.agent, data.response.tools_used, data.response.auto_selected);
        }
        break;
      case 'agent_error':
        setIsLoading(false);
        addSystemMessage(`❌ Error from ${data.agent}: ${data.error}`);
        break;
      case 'system_metrics':
        setSystemMetrics(data.data);
        break;
      case 'agent_suggestions':
        setAgentSuggestions(data.suggestions);
        break;
    }
  };

  const fetchSystemMetrics = async () => {
    try {
      const response = await fetch("http://localhost:8002/system/metrics");
      if (response.ok) {
        const metrics = await response.json();
        setSystemMetrics(metrics);
      }
    } catch (error) {
      console.error('Failed to fetch system metrics:', error);
    }
  };

  const addMessage = (sender, content, agent = null, tools = [], autoSelected = false) => {
    const newMessage = {
      id: Date.now(),
      sender,
      content,
      agent,
      tools,
      autoSelected,
      timestamp: new Date().toLocaleTimeString()
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const addSystemMessage = (content) => {
    addMessage('system', content);
  };

  const getAgentSuggestions = async (message) => {
    try {
      const response = await fetch("http://localhost:8002/agents/suggest", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setAgentSuggestions(data.suggestions);
      }
    } catch (error) {
      console.error('Failed to get agent suggestions:', error);
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMessage = inputMessage.trim();
    addMessage('user', userMessage);
    setInputMessage('');
    setIsLoading(true);

    // Get suggestions if auto-select is enabled
    if (autoSelectEnabled && selectedAgent === 'auto') {
      await getAgentSuggestions(userMessage);
    }

    try {
      const response = await fetch("http://localhost:8002/chat", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage,
          agent_type: selectedAgent,
          auto_select: autoSelectEnabled
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Response will be handled via WebSocket
    } catch (error) {
      setIsLoading(false);
      addSystemMessage(`❌ Error: ${error.message}`);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const getAgentInfo = (agentId) => {
    return agents.find(agent => agent.id === agentId) || agents[0];
  };

  const formatMetric = (value, unit = '%') => {
    return `${typeof value === 'number' ? value.toFixed(1) : '0.0'}${unit}`;
  };

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      {/* Sidebar */}
      <div className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-700">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            Dyor AI
          </h1>
          <p className="text-gray-400 text-sm mt-1">Advanced AI Agent Platform</p>
        </div>

        {/* Auto-Selection Toggle */}
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">Auto Agent Selection</span>
            <button
              onClick={() => setAutoSelectEnabled(!autoSelectEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                autoSelectEnabled ? 'bg-blue-600' : 'bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  autoSelectEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          {autoSelectEnabled && lastAutoSelection && (
            <div className="text-xs text-gray-400 bg-gray-700 p-2 rounded">
              Last: {lastAutoSelection.selected_agent.toUpperCase()} ({(lastAutoSelection.confidence * 100).toFixed(1)}%)
            </div>
          )}
        </div>

        {/* Agent Selection */}
        <div className="p-4 border-b border-gray-700">
          <h3 className="text-sm font-semibold mb-3 flex items-center">
            <Bot className="w-4 h-4 mr-2" />
            {autoSelectEnabled ? 'Agent Preferences' : 'Select Agent'}
          </h3>
          <div className="space-y-2">
            {agents.map((agent) => (
              <button
                key={agent.id}
                onClick={() => setSelectedAgent(agent.id)}
                disabled={autoSelectEnabled && agent.id !== 'auto'}
                className={`w-full p-3 rounded-lg text-left transition-all duration-200 ${
                  selectedAgent === agent.id
                    ? `${agent.color} text-white shadow-lg`
                    : autoSelectEnabled && agent.id !== 'auto'
                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                }`}
              >
                <div className="flex items-center">
                  <span className="text-lg mr-3">{agent.icon}</span>
                  <div className="flex-1">
                    <div className="font-medium text-sm">{agent.name}</div>
                    <div className="text-xs opacity-75 mt-1">{agent.description}</div>
                  </div>
                  {selectedAgent === agent.id && (
                    <div className="w-2 h-2 bg-white rounded-full ml-2"></div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Agent Suggestions */}
        {agentSuggestions.length > 0 && (
          <div className="p-4 border-b border-gray-700">
            <h3 className="text-sm font-semibold mb-3 flex items-center">
              <Zap className="w-4 h-4 mr-2 text-yellow-400" />
              Suggestions
            </h3>
            <div className="space-y-2">
              {agentSuggestions.slice(0, 3).map((suggestion, index) => (
                <div key={index} className="bg-gray-700 p-2 rounded text-xs">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{suggestion.agent.toUpperCase()}</span>
                    <span className="text-green-400">{(suggestion.confidence * 100).toFixed(1)}%</span>
                  </div>
                  <div className="text-gray-400 mt-1">{suggestion.description}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tools */}
        <div className="p-4 border-b border-gray-700">
          <h3 className="text-sm font-semibold mb-3 flex items-center">
            <Settings className="w-4 h-4 mr-2" />
            Tools
          </h3>
          <div className="space-y-2">
            {[
              { name: 'Browser Tool', count: 15, icon: '🌐' },
              { name: 'Python Execute', count: 8, icon: '🐍' },
              { name: 'File Editor', count: 12, icon: '📝' },
              { name: 'Web Search', count: 6, icon: '🔍' }
            ].map((tool, index) => (
              <div key={index} className="flex items-center justify-between text-sm">
                <div className="flex items-center">
                  <span className="mr-2">{tool.icon}</span>
                  <span className="text-gray-300">{tool.name}</span>
                </div>
                <span className="bg-gray-700 px-2 py-1 rounded text-xs">{tool.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Tasks */}
        <div className="flex-1 p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center">
            <Activity className="w-4 h-4 mr-2" />
            Recent
          </h3>
          <div className="space-y-2">
            {[
              { task: 'Web scraping analysis', agent: 'Browser', time: '2 min ago' },
              { task: 'Data visualization', agent: 'DataAnalysis', time: '5 min ago' },
              { task: 'Code optimization', agent: 'SWE', time: '8 min ago' }
            ].map((item, index) => (
              <div key={index} className="bg-gray-700 p-2 rounded text-xs">
                <div className="text-gray-300 font-medium">{item.task}</div>
                <div className="text-gray-400 mt-1">{item.agent} • {item.time}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-gray-800 border-b border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`}></div>
                <span className="text-sm text-gray-300">
                  {isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              {autoSelectEnabled && (
                <div className="flex items-center space-x-2 bg-blue-600 px-3 py-1 rounded-full">
                  <Zap className="w-3 h-3" />
                  <span className="text-xs font-medium">Auto-Select ON</span>
                </div>
              )}
            </div>
            <div className="text-sm text-gray-400">
              Dyor AI initialized successfully. All agents ready.
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-gray-400 mt-20">
              <Bot className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <h3 className="text-xl font-semibold mb-2">Welcome to Dyor AI</h3>
              <p className="text-gray-500 max-w-md mx-auto">
                {autoSelectEnabled 
                  ? "Start a conversation and I'll automatically select the best agent for your task."
                  : "Choose an agent and start your conversation. Each agent specializes in different areas."
                }
              </p>
            </div>
          )}

          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-3xl ${message.sender === 'user' ? 'order-2' : 'order-1'}`}>
                <div className={`flex items-start space-x-3 ${message.sender === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    message.sender === 'user' 
                      ? 'bg-blue-600' 
                      : message.sender === 'system'
                      ? 'bg-gray-600'
                      : getAgentInfo(message.agent).color
                  }`}>
                    {message.sender === 'user' ? (
                      <User className="w-4 h-4" />
                    ) : message.sender === 'system' ? (
                      <Activity className="w-4 h-4" />
                    ) : (
                      <span className="text-sm">{getAgentInfo(message.agent).icon}</span>
                    )}
                  </div>
                  <div className={`flex-1 ${message.sender === 'user' ? 'text-right' : ''}`}>
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-sm font-medium">
                        {message.sender === 'user' 
                          ? 'You' 
                          : message.sender === 'system'
                          ? 'System'
                          : getAgentInfo(message.agent).name
                        }
                      </span>
                      {message.autoSelected && (
                        <span className="bg-purple-600 text-xs px-2 py-0.5 rounded-full">Auto</span>
                      )}
                      <span className="text-xs text-gray-400">{message.timestamp}</span>
                    </div>
                    <div className={`p-3 rounded-lg ${
                      message.sender === 'user'
                        ? 'bg-blue-600 text-white'
                        : message.sender === 'system'
                        ? 'bg-gray-700 text-gray-300'
                        : 'bg-gray-700 text-gray-100'
                    }`}>
                      <p className="whitespace-pre-wrap">{message.content}</p>
                      {message.tools && message.tools.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-gray-600">
                          <div className="flex flex-wrap gap-1">
                            {message.tools.map((tool, index) => (
                              <span key={index} className="bg-gray-600 text-xs px-2 py-1 rounded">
                                {tool}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                </div>
                <div className="bg-gray-700 p-3 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                    </div>
                    <span className="text-gray-400 text-sm">Agent is thinking...</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-700 p-4">
          <div className="flex items-end space-x-4">
            <div className="flex-1">
              <textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={autoSelectEnabled ? "Ask Dyor AI to help you with any task..." : `Ask ${getAgentInfo(selectedAgent).name} to help you...`}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows="1"
                style={{ minHeight: '44px', maxHeight: '120px' }}
              />
            </div>
            <button
              onClick={sendMessage}
              disabled={!inputMessage.trim() || isLoading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white p-3 rounded-lg transition-colors duration-200 flex items-center justify-center"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
            <span>
              {autoSelectEnabled 
                ? `Auto-selection enabled • ${getAgentInfo(selectedAgent).name} preferred`
                : `Selected: ${getAgentInfo(selectedAgent).name}`
              }
            </span>
            <span>Press Enter to send</span>
          </div>
        </div>
      </div>

      {/* Right Sidebar - Metrics */}
      <div className="w-80 bg-gray-800 border-l border-gray-700 p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <Activity className="w-5 h-5 mr-2" />
          Monitoring
        </h3>

        {/* Connection Status */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-300">Connection</span>
            <div className={`px-2 py-1 rounded text-xs ${isConnected ? 'bg-green-600' : 'bg-red-600'}`}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </div>
          </div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-300">WebSocket Status</span>
            <div className={`px-2 py-1 rounded text-xs ${isConnected ? 'bg-green-600' : 'bg-red-600'}`}>
              {isConnected ? 'Running' : 'Stopped'}
            </div>
          </div>
        </div>

        {/* Performance */}
        <div className="mb-6">
          <h4 className="text-sm font-semibold mb-3 flex items-center">
            <Cpu className="w-4 h-4 mr-2" />
            Performance
          </h4>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-300">CPU Usage</span>
                <span className="text-white">{formatMetric(systemMetrics.cpu_usage)}</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(systemMetrics.cpu_usage || 0, 100)}%` }}
                ></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-300">Memory Usage</span>
                <span className="text-white">{formatMetric(systemMetrics.memory_usage)}</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-green-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(systemMetrics.memory_usage || 0, 100)}%` }}
                ></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-300">Network Activity</span>
                <span className="text-white">{formatMetric(systemMetrics.network_activity, ' MB')}</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-purple-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min((systemMetrics.network_activity || 0) * 5, 100)}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-6">
          <h4 className="text-sm font-semibold mb-3 flex items-center">
            <Zap className="w-4 h-4 mr-2" />
            Quick Actions
          </h4>
          <div className="space-y-2">
            <button 
              onClick={fetchSystemMetrics}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white p-2 rounded text-sm flex items-center justify-center space-x-2 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Refresh Metrics</span>
            </button>
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white p-2 rounded text-sm flex items-center justify-center space-x-2 transition-colors"
            >
              <Power className="w-4 h-4" />
              <span>Reload Agents</span>
            </button>
            <button 
              onClick={connectWebSocket}
              className="w-full bg-green-600 hover:bg-green-700 text-white p-2 rounded text-sm flex items-center justify-center space-x-2 transition-colors"
            >
              <Wifi className="w-4 h-4" />
              <span>Reconnect</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DyorAI;


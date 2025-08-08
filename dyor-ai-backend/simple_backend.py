#!/usr/bin/env python3
"""
Dyor AI Backend Server - Enhanced Version with Auto-Agent Selection
Real-time API server with intelligent agent selection
"""

import asyncio
import json
import logging
import os
import random
from datetime import datetime
from typing import Dict, List, Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import psutil

# Import our agent selector
from agent_selector import AgentSelector

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Dyor AI Backend", version="1.0.0")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Data models
class ChatMessage(BaseModel):
    message: str
    agent_type: str = "auto"  # Changed default to "auto"
    auto_select: bool = True  # New field for auto-selection

class AgentResponse(BaseModel):
    response: str
    agent: str
    tools_used: List[str] = []
    execution_time: float
    timestamp: str
    auto_selected: bool = False
    selection_confidence: float = 0.0
    selection_explanation: str = ""

class AgentSuggestion(BaseModel):
    agent: str
    confidence: float
    description: str

class SystemMetrics(BaseModel):
    cpu_usage: float
    memory_usage: float
    network_activity: float
    active_agents: int
    timestamp: str

# Mock Agent Classes
class MockAgent:
    def __init__(self, name: str, description: str):
        self.name = name
        self.description = description
        self.last_tools_used = []
    
    async def run(self, message: str) -> str:
        # Simulate thinking time
        await asyncio.sleep(random.uniform(1, 3))
        
        # Mock different responses based on agent type
        if self.name == "manus":
            self.last_tools_used = ["Browser Tool", "Python Execute"]
            return f"I'll help you with that task. As a general-purpose AI agent, I can analyze websites, extract data, and perform various operations. Let me break this down into steps: 1) Navigate to the target website, 2) Analyze the page structure, 3) Extract the required data, 4) Process and format the results."
        
        elif self.name == "browser":
            self.last_tools_used = ["Browser Tool", "Web Search"]
            return f"I'm specialized in web automation. I can navigate to websites, interact with elements, extract content, and perform complex web scraping tasks. For your request, I would: 1) Open the target website, 2) Identify the data elements, 3) Extract the information systematically, 4) Handle any dynamic content or pagination."
        
        elif self.name == "data":
            self.last_tools_used = ["Python Execute", "Data Visualization"]
            return f"As a data analysis expert, I can help you process and analyze the extracted data. I would: 1) Clean and structure the raw data, 2) Perform statistical analysis, 3) Create visualizations and charts, 4) Generate insights and recommendations based on the findings."
        
        elif self.name == "swe":
            self.last_tools_used = ["Code Editor", "Python Execute", "File Manager"]
            return f"I'm a software engineering agent. I can help you build tools and scripts for data extraction and analysis. I would: 1) Write efficient scraping scripts, 2) Implement data processing pipelines, 3) Create reusable functions and modules, 4) Optimize performance and handle edge cases."
        
        return f"Agent {self.name} processed your message: {message}"

# Global state
active_agents: Dict[str, MockAgent] = {}
websocket_connections: List[WebSocket] = []
agent_selector = AgentSelector()

# Initialize mock agents
def initialize_agents():
    """Initialize all available mock agents"""
    global active_agents
    
    active_agents["manus"] = MockAgent("manus", "General-purpose AI agent")
    active_agents["browser"] = MockAgent("browser", "Web automation specialist")
    active_agents["data"] = MockAgent("data", "Data analysis expert")
    active_agents["swe"] = MockAgent("swe", "Software engineering agent")
    
    logger.info(f"Initialized {len(active_agents)} mock agents")

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket connected. Total connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        logger.info(f"WebSocket disconnected. Total connections: {len(self.active_connections)}")

    async def send_personal_message(self, message: str, websocket: WebSocket):
        try:
            await websocket.send_text(message)
        except Exception as e:
            logger.error(f"Failed to send personal message: {e}")

    async def broadcast(self, message: str):
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception as e:
                logger.error(f"Failed to broadcast to connection: {e}")
                disconnected.append(connection)
        
        # Remove disconnected connections
        for conn in disconnected:
            self.disconnect(conn)

manager = ConnectionManager()

# API Routes
@app.get("/")
async def root():
    return {"message": "Dyor AI Backend is running", "agents": list(active_agents.keys())}

@app.get("/agents")
async def get_agents():
    """Get list of available agents"""
    agent_info = {}
    for name, agent in active_agents.items():
        agent_info[name] = {
            "name": name,
            "type": type(agent).__name__,
            "status": "active",
            "description": agent.description
        }
    return agent_info

@app.post("/agents/suggest")
async def suggest_agents(message: ChatMessage):
    """Get agent suggestions for a given task"""
    suggestions = agent_selector.get_agent_suggestions(message.message)
    
    return {
        "task": message.message,
        "suggestions": [
            AgentSuggestion(
                agent=agent,
                confidence=confidence,
                description=description
            ) for agent, confidence, description in suggestions
        ]
    }

@app.get("/system/metrics")
async def get_system_metrics():
    """Get current system metrics"""
    try:
        cpu_usage = psutil.cpu_percent(interval=0.1)
        memory_usage = psutil.virtual_memory().percent
        network_stats = psutil.net_io_counters()
        network_activity = (network_stats.bytes_sent + network_stats.bytes_recv) / (1024 * 1024)
    except:
        # Fallback to mock data if psutil fails
        cpu_usage = random.uniform(10, 30)
        memory_usage = random.uniform(40, 60)
        network_activity = random.uniform(5, 15)
    
    metrics = SystemMetrics(
        cpu_usage=cpu_usage,
        memory_usage=memory_usage,
        network_activity=network_activity,
        active_agents=len(active_agents),
        timestamp=datetime.now().isoformat()
    )
    
    return metrics

@app.post("/chat")
async def chat_with_agent(message: ChatMessage):
    """Send message to specified agent with auto-selection support"""
    start_time = datetime.now()
    
    selected_agent = message.agent_type
    auto_selected = False
    selection_confidence = 0.0
    selection_explanation = ""
    
    # Auto-select agent if requested
    if message.auto_select or message.agent_type == "auto":
        selected_agent, selection_confidence, all_scores = agent_selector.select_best_agent(message.message)
        auto_selected = True
        selection_explanation = agent_selector.explain_selection(message.message, selected_agent)
        
        logger.info(f"Auto-selected agent: {selected_agent} (confidence: {selection_confidence:.2f})")
        
        # Broadcast agent selection info
        await manager.broadcast(json.dumps({
            "type": "agent_selection",
            "selected_agent": selected_agent,
            "confidence": selection_confidence,
            "all_scores": all_scores,
            "explanation": selection_explanation
        }))
    
    if selected_agent not in active_agents:
        raise HTTPException(status_code=404, detail=f"Agent {selected_agent} not found")
    
    agent = active_agents[selected_agent]
    
    try:
        # Broadcast status update
        await manager.broadcast(json.dumps({
            "type": "agent_status",
            "agent": selected_agent,
            "status": "thinking",
            "message": "Processing your request...",
            "auto_selected": auto_selected
        }))
        
        # Execute agent task
        response = await agent.run(message.message)
        
        execution_time = (datetime.now() - start_time).total_seconds()
        
        # Create response
        agent_response = AgentResponse(
            response=response,
            agent=selected_agent,
            tools_used=agent.last_tools_used,
            execution_time=execution_time,
            timestamp=datetime.now().isoformat(),
            auto_selected=auto_selected,
            selection_confidence=selection_confidence,
            selection_explanation=selection_explanation
        )
        
        # Broadcast completion
        await manager.broadcast(json.dumps({
            "type": "agent_response",
            "agent": selected_agent,
            "status": "completed",
            "response": agent_response.dict()
        }))
        
        return agent_response
        
    except Exception as e:
        logger.error(f"Error executing agent {selected_agent}: {e}")
        
        # Broadcast error
        await manager.broadcast(json.dumps({
            "type": "agent_error",
            "agent": selected_agent,
            "status": "error",
            "error": str(e)
        }))
        
        raise HTTPException(status_code=500, detail=str(e))

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time communication"""
    await manager.connect(websocket)
    
    try:
        # Send initial status
        await websocket.send_text(json.dumps({
            "type": "connection_established",
            "message": "Connected to Dyor AI with Auto-Agent Selection",
            "agents": list(active_agents.keys()),
            "features": ["auto_agent_selection", "real_time_monitoring", "agent_suggestions"],
            "timestamp": datetime.now().isoformat()
        }))
        
        while True:
            # Keep connection alive and handle incoming messages
            data = await websocket.receive_text()
            message_data = json.loads(data)
            
            if message_data.get("type") == "ping":
                await websocket.send_text(json.dumps({
                    "type": "pong",
                    "timestamp": datetime.now().isoformat()
                }))
            elif message_data.get("type") == "get_suggestions":
                task = message_data.get("task", "")
                suggestions = agent_selector.get_agent_suggestions(task)
                await websocket.send_text(json.dumps({
                    "type": "agent_suggestions",
                    "task": task,
                    "suggestions": [
                        {"agent": agent, "confidence": conf, "description": desc}
                        for agent, conf, desc in suggestions
                    ]
                }))
            
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)

# Background task for system monitoring
async def system_monitor():
    """Background task to monitor system and broadcast updates"""
    while True:
        try:
            # Update system metrics
            metrics = await get_system_metrics()
            
            # Broadcast to all connected clients
            await manager.broadcast(json.dumps({
                "type": "system_metrics",
                "data": metrics.dict()
            }))
            
            await asyncio.sleep(5)  # Update every 5 seconds
            
        except Exception as e:
            logger.error(f"System monitor error: {e}")
            await asyncio.sleep(10)

@app.on_event("startup")
async def startup_event():
    """Initialize agents and start background tasks"""
    logger.info("Starting Dyor AI Backend with Auto-Agent Selection...")
    
    # Initialize mock agents
    initialize_agents()
    
    # Start background monitoring
    asyncio.create_task(system_monitor())
    
    logger.info("Dyor AI Backend started successfully!")

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    logger.info("Shutting down Dyor AI Backend...")
    logger.info("Dyor AI Backend shutdown complete")

if __name__ == "__main__":
    # Run the server
    uvicorn.run(
        "simple_backend:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )


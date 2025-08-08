#!/usr/bin/env python3
"""
Dyor AI Backend Server
Real-time API server that integrates with OpenManus agents
"""

import asyncio
import json
import logging
import os
import sys
from datetime import datetime
from typing import Dict, List, Optional
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import uvicorn

# Add OpenManus to path
sys.path.append('/home/ubuntu/OpenManus')

from app.agent.manus import Manus
from app.agent.browser import BrowserAgent
from app.agent.data_analysis import DataAnalysisAgent
from app.agent.swe import SWEAgent
from app.config import config

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
    agent_type: str = "manus"

class AgentResponse(BaseModel):
    response: str
    agent: str
    tools_used: List[str] = []
    execution_time: float
    timestamp: str

class SystemMetrics(BaseModel):
    cpu_usage: float
    memory_usage: float
    network_activity: float
    active_agents: int
    timestamp: str

# Global state
active_agents: Dict[str, object] = {}
websocket_connections: List[WebSocket] = []
system_metrics = SystemMetrics(
    cpu_usage=12.0,
    memory_usage=45.0,
    network_activity=8.0,
    active_agents=0,
    timestamp=datetime.now().isoformat()
)

# Initialize agents
async def initialize_agents():
    """Initialize all available agents"""
    global active_agents
    
    try:
        # Initialize Manus agent
        manus_agent = await Manus.create()
        active_agents["manus"] = manus_agent
        logger.info("Manus agent initialized")
        
        # Initialize Browser agent
        browser_agent = BrowserAgent()
        active_agents["browser"] = browser_agent
        logger.info("Browser agent initialized")
        
        # Initialize Data Analysis agent (if available)
        try:
            data_agent = DataAnalysisAgent()
            active_agents["data"] = data_agent
            logger.info("Data Analysis agent initialized")
        except Exception as e:
            logger.warning(f"Data Analysis agent not available: {e}")
        
        # Initialize SWE agent (if available)
        try:
            swe_agent = SWEAgent()
            active_agents["swe"] = swe_agent
            logger.info("SWE agent initialized")
        except Exception as e:
            logger.warning(f"SWE agent not available: {e}")
            
        system_metrics.active_agents = len(active_agents)
        logger.info(f"Initialized {len(active_agents)} agents")
        
    except Exception as e:
        logger.error(f"Failed to initialize agents: {e}")
        raise

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
            "description": getattr(agent, 'description', 'AI Agent')
        }
    return agent_info

@app.get("/system/metrics")
async def get_system_metrics():
    """Get current system metrics"""
    import psutil
    
    # Update real system metrics
    system_metrics.cpu_usage = psutil.cpu_percent(interval=1)
    system_metrics.memory_usage = psutil.virtual_memory().percent
    system_metrics.network_activity = sum([
        psutil.net_io_counters().bytes_sent,
        psutil.net_io_counters().bytes_recv
    ]) / (1024 * 1024)  # Convert to MB
    system_metrics.active_agents = len(active_agents)
    system_metrics.timestamp = datetime.now().isoformat()
    
    return system_metrics

@app.post("/chat")
async def chat_with_agent(message: ChatMessage):
    """Send message to specified agent"""
    start_time = datetime.now()
    
    if message.agent_type not in active_agents:
        raise HTTPException(status_code=404, detail=f"Agent {message.agent_type} not found")
    
    agent = active_agents[message.agent_type]
    
    try:
        # Broadcast status update
        await manager.broadcast(json.dumps({
            "type": "agent_status",
            "agent": message.agent_type,
            "status": "thinking",
            "message": "Processing your request..."
        }))
        
        # Execute agent task
        if hasattr(agent, 'run'):
            response = await agent.run(message.message)
        else:
            # Fallback for agents without run method
            response = f"Agent {message.agent_type} received: {message.message}"
        
        execution_time = (datetime.now() - start_time).total_seconds()
        
        # Create response
        agent_response = AgentResponse(
            response=str(response),
            agent=message.agent_type,
            tools_used=getattr(agent, 'last_tools_used', []),
            execution_time=execution_time,
            timestamp=datetime.now().isoformat()
        )
        
        # Broadcast completion
        await manager.broadcast(json.dumps({
            "type": "agent_response",
            "agent": message.agent_type,
            "status": "completed",
            "response": agent_response.dict()
        }))
        
        return agent_response
        
    except Exception as e:
        logger.error(f"Error executing agent {message.agent_type}: {e}")
        
        # Broadcast error
        await manager.broadcast(json.dumps({
            "type": "agent_error",
            "agent": message.agent_type,
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
            "message": "Connected to Dyor AI",
            "agents": list(active_agents.keys()),
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
    logger.info("Starting Dyor AI Backend...")
    
    # Initialize agents
    await initialize_agents()
    
    # Start background monitoring
    asyncio.create_task(system_monitor())
    
    logger.info("Dyor AI Backend started successfully!")

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    logger.info("Shutting down Dyor AI Backend...")
    
    # Cleanup agents
    for name, agent in active_agents.items():
        if hasattr(agent, 'cleanup'):
            try:
                await agent.cleanup()
                logger.info(f"Cleaned up {name} agent")
            except Exception as e:
                logger.error(f"Error cleaning up {name} agent: {e}")
    
    logger.info("Dyor AI Backend shutdown complete")

if __name__ == "__main__":
    # Install required packages if not available
    try:
        import psutil
    except ImportError:
        os.system("pip install psutil")
        import psutil
    
    # Run the server
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )


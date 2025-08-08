import asyncio
import json
import logging
import os
import time
from datetime import datetime
from typing import Dict, List, Optional

import psutil
import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI

# Import agent selector
from agent_selector import AgentSelector

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize OpenAI client
OPENAI_API_KEY = "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"
client = OpenAI(api_key=OPENAI_API_KEY)

app = FastAPI(title="Dyor AI Backend - Real LLM Integration", version="2.1.0")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models
class ChatMessage(BaseModel):
    message: str
    agent_type: str = "auto"
    auto_select: bool = True

class AgentSuggestionRequest(BaseModel):
    message: str

# Global variables
connected_clients: List[WebSocket] = []
agent_selector = AgentSelector()

# Real agent configurations with specialized prompts
AGENT_CONFIGS = {
    "manus": {
        "name": "Manus",
        "description": "General-purpose AI agent for basic tasks and explanations",
        "system_prompt": """You are Manus, a general-purpose AI agent. You excel at:
- Answering general questions and providing explanations
- Helping with basic tasks and problem-solving
- Providing guidance and recommendations
- General conversation and assistance

Keep responses helpful, clear, and concise. Always be friendly and professional.""",
        "tools": ["General Knowledge", "Problem Solving", "Guidance"]
    },
    "browser": {
        "name": "Browser Agent",
        "description": "Web automation and scraping specialist",
        "system_prompt": """You are a Browser Agent, specialized in web automation and scraping. You excel at:
- Web scraping and data extraction from websites
- Browser automation and interaction with web elements
- Analyzing web content and structure
- Navigating websites and handling dynamic content
- Working with APIs and web services

When given web-related tasks, provide detailed step-by-step approaches. Mention specific tools and techniques you would use.""",
        "tools": ["Browser Tool", "Web Scraping", "DOM Navigation", "API Integration"]
    },
    "data": {
        "name": "DataAnalysis Agent",
        "description": "Data analysis and visualization expert",
        "system_prompt": """You are a DataAnalysis Agent, specialized in data processing and visualization. You excel at:
- Statistical analysis and data interpretation
- Creating visualizations and charts
- Data cleaning and preprocessing
- Machine learning and predictive modeling
- Working with datasets and databases

When given data-related tasks, provide comprehensive analysis approaches. Mention specific Python libraries and visualization techniques you would use.""",
        "tools": ["Python Execute", "Data Visualization", "Statistical Analysis", "Machine Learning"]
    },
    "swe": {
        "name": "Software Engineering Agent",
        "description": "Software engineering and development agent",
        "system_prompt": """You are a Software Engineering Agent, specialized in coding and development. You excel at:
- Writing, debugging, and optimizing code
- Software architecture and design patterns
- Code review and best practices
- Building applications and tools
- Working with various programming languages and frameworks

When given coding tasks, provide clean, well-documented code with explanations. Mention specific technologies and best practices.""",
        "tools": ["Code Editor", "Debugging", "Testing", "Version Control"]
    }
}

async def broadcast_to_clients(message: dict):
    """Broadcast message to all connected WebSocket clients"""
    if connected_clients:
        disconnected = []
        for client in connected_clients:
            try:
                await client.send_text(json.dumps(message))
            except Exception as e:
                logger.error(f"Error broadcasting to client: {e}")
                disconnected.append(client)
        
        # Remove disconnected clients
        for client in disconnected:
            if client in connected_clients:
                connected_clients.remove(client)

async def get_llm_response(message: str, agent_type: str) -> dict:
    """Get real response from OpenAI ChatGPT"""
    try:
        agent_config = AGENT_CONFIGS.get(agent_type, AGENT_CONFIGS["manus"])
        
        # Prepare messages for ChatGPT
        messages = [
            {"role": "system", "content": agent_config["system_prompt"]},
            {"role": "user", "content": message}
        ]
        
        # Call OpenAI API
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=messages,
            max_tokens=1000,
            temperature=0.7
        )
        
        # Extract response
        llm_response = response.choices[0].message.content
        
        return {
            "response": llm_response,
            "agent": agent_type,
            "tools_used": agent_config["tools"],
            "auto_selected": False,
            "model": "gpt-3.5-turbo",
            "tokens_used": response.usage.total_tokens if response.usage else 0
        }
        
    except Exception as e:
        logger.error(f"Error getting LLM response: {e}")
        return {
            "response": f"Sorry, I encountered an error: {str(e)}",
            "agent": agent_type,
            "tools_used": [],
            "auto_selected": False,
            "error": True
        }

def get_system_metrics():
    """Get real system metrics"""
    try:
        cpu_percent = psutil.cpu_percent(interval=1)
        memory = psutil.virtual_memory()
        network = psutil.net_io_counters()
        
        return {
            "cpu_usage": cpu_percent,
            "memory_usage": memory.percent,
            "network_activity": round((network.bytes_sent + network.bytes_recv) / (1024 * 1024), 2),
            "active_agents": len(AGENT_CONFIGS),
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Error getting system metrics: {e}")
        return {
            "cpu_usage": 0,
            "memory_usage": 0,
            "network_activity": 0,
            "active_agents": 4,
            "timestamp": datetime.now().isoformat()
        }

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_clients.append(websocket)
    
    # Send connection established message
    await websocket.send_text(json.dumps({
        "type": "connection_established",
        "message": "Connected to Dyor AI with Real LLM Integration",
        "features": ["real_llm_integration", "auto_agent_selection", "real_time_monitoring", "agent_suggestions"],
        "timestamp": datetime.now().isoformat()
    }))
    
    try:
        while True:
            # Send periodic system metrics
            metrics = get_system_metrics()
            await websocket.send_text(json.dumps({
                "type": "system_metrics",
                "data": metrics
            }))
            
            # Wait for 5 seconds before next update
            await asyncio.sleep(5)
            
    except WebSocketDisconnect:
        if websocket in connected_clients:
            connected_clients.remove(websocket)
        logger.info("WebSocket client disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        if websocket in connected_clients:
            connected_clients.remove(websocket)

@app.post("/chat")
async def chat_endpoint(chat_message: ChatMessage):
    """Handle chat messages with real LLM integration"""
    try:
        message = chat_message.message
        agent_type = chat_message.agent_type
        auto_select = chat_message.auto_select
        
        # Auto-select agent if enabled
        if auto_select and agent_type == "auto":
            selection_result = agent_selector.select_best_agent(message)
            selected_agent, confidence, all_scores = selection_result
            
            # Broadcast agent selection
            await broadcast_to_clients({
                "type": "agent_selection",
                "selected_agent": selected_agent,
                "confidence": confidence,
                "explanation": selection_result["explanation"],
                "all_scores": selection_result["all_scores"],
                "timestamp": datetime.now().isoformat()
            })
            
            agent_type = selected_agent
            auto_selected = True
        else:
            auto_selected = False
        
        # Broadcast agent status
        await broadcast_to_clients({
            "type": "agent_status",
            "agent": agent_type,
            "status": "thinking",
            "auto_selected": auto_selected,
            "timestamp": datetime.now().isoformat()
        })
        
        # Get real LLM response
        response_data = await get_llm_response(message, agent_type)
        response_data["auto_selected"] = auto_selected
        
        # Broadcast response
        await broadcast_to_clients({
            "type": "agent_response",
            "response": response_data,
            "timestamp": datetime.now().isoformat()
        })
        
        return {"status": "success", "message": "Response sent via WebSocket"}
        
    except Exception as e:
        logger.error(f"Error in chat endpoint: {e}")
        await broadcast_to_clients({
            "type": "agent_error",
            "agent": agent_type,
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        })
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/agents/suggest")
async def suggest_agents(request: AgentSuggestionRequest):
    """Get agent suggestions for a message"""
    try:
        suggestions = agent_selector.get_agent_suggestions(request.message)
        
        # Broadcast suggestions
        await broadcast_to_clients({
            "type": "agent_suggestions",
            "suggestions": suggestions,
            "timestamp": datetime.now().isoformat()
        })
        
        return {"suggestions": suggestions}
        
    except Exception as e:
        logger.error(f"Error getting agent suggestions: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/system/metrics")
async def get_metrics():
    """Get current system metrics"""
    return get_system_metrics()

@app.get("/agents")
async def get_agents():
    """Get available agents"""
    agents = []
    for agent_id, config in AGENT_CONFIGS.items():
        agents.append({
            "id": agent_id,
            "name": config["name"],
            "description": config["description"],
            "tools": config["tools"]
        })
    return {"agents": agents}

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "version": "2.1.0",
        "features": ["real_llm_integration", "auto_agent_selection"],
        "openai_configured": bool(OPENAI_API_KEY),
        "timestamp": datetime.now().isoformat()
    }

@app.on_event("startup")
async def startup_event():
    logger.info("Starting Dyor AI Backend with Real LLM Integration...")
    logger.info(f"OpenAI API configured: {bool(OPENAI_API_KEY)}")
    logger.info(f"Initialized {len(AGENT_CONFIGS)} real agents")
    logger.info("Dyor AI Backend started successfully!")

@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Shutting down Dyor AI Backend...")

if __name__ == "__main__":
    uvicorn.run(
        "real_backend_v2:app",
        host="0.0.0.0",
        port=8002,
        reload=True,
        log_level="info"
    )



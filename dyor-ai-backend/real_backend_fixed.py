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
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
client = OpenAI(api_key=OPENAI_API_KEY)

app = FastAPI(title="Dyor AI Backend - Real LLM Integration", version="2.2.0")

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

async def safe_send_to_client(websocket: WebSocket, message: dict) -> bool:
    """Safely send message to a WebSocket client"""
    try:
        await websocket.send_text(json.dumps(message))
        return True
    except WebSocketDisconnect:
        logger.info("Client disconnected during send")
        return False
    except Exception as e:
        logger.error(f"Error sending to client: {e}")
        return False

async def broadcast_to_clients(message: dict):
    """Broadcast message to all connected WebSocket clients with improved error handling"""
    if not connected_clients:
        return
    
    disconnected = []
    for client in connected_clients:
        success = await safe_send_to_client(client, message)
        if not success:
            disconnected.append(client)
    
    # Remove disconnected clients
    for client in disconnected:
        if client in connected_clients:
            connected_clients.remove(client)
            logger.info(f"Removed disconnected client. Active clients: {len(connected_clients)}")

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
        cpu_percent = psutil.cpu_percent(interval=0.1)  # Reduced interval for faster response
        memory = psutil.virtual_memory()
        network = psutil.net_io_counters()
        
        return {
            "cpu_usage": round(cpu_percent, 1),
            "memory_usage": round(memory.percent, 1),
            "network_activity": round((network.bytes_sent + network.bytes_recv) / (1024 * 1024), 2),
            "active_agents": len(AGENT_CONFIGS),
            "connected_clients": len(connected_clients),
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Error getting system metrics: {e}")
        return {
            "cpu_usage": 0,
            "memory_usage": 0,
            "network_activity": 0,
            "active_agents": 4,
            "connected_clients": len(connected_clients),
            "timestamp": datetime.now().isoformat()
        }

async def heartbeat_task(websocket: WebSocket):
    """Send periodic heartbeat to keep connection alive"""
    try:
        while True:
            await asyncio.sleep(30)  # Send heartbeat every 30 seconds
            success = await safe_send_to_client(websocket, {
                "type": "heartbeat",
                "timestamp": datetime.now().isoformat()
            })
            if not success:
                break
    except Exception as e:
        logger.error(f"Heartbeat error: {e}")

async def metrics_task(websocket: WebSocket):
    """Send periodic system metrics"""
    try:
        while True:
            await asyncio.sleep(5)  # Send metrics every 5 seconds
            metrics = get_system_metrics()
            success = await safe_send_to_client(websocket, {
                "type": "system_metrics",
                "data": metrics
            })
            if not success:
                break
    except Exception as e:
        logger.error(f"Metrics task error: {e}")

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_clients.append(websocket)
    logger.info(f"New WebSocket connection. Active clients: {len(connected_clients)}")
    
    # Send connection established message
    await safe_send_to_client(websocket, {
        "type": "connection_established",
        "message": "Connected to Dyor AI with Real LLM Integration",
        "features": ["real_llm_integration", "auto_agent_selection", "real_time_monitoring", "agent_suggestions"],
        "timestamp": datetime.now().isoformat()
    })
    
    # Start background tasks
    heartbeat_task_handle = asyncio.create_task(heartbeat_task(websocket))
    metrics_task_handle = asyncio.create_task(metrics_task(websocket))
    
    try:
        # Keep connection alive and listen for messages
        while True:
            try:
                # Wait for incoming messages with timeout
                data = await asyncio.wait_for(websocket.receive_text(), timeout=60.0)
                logger.info(f"Received WebSocket message: {data}")
                
                # Echo back for testing
                await safe_send_to_client(websocket, {
                    "type": "echo",
                    "message": f"Received: {data}",
                    "timestamp": datetime.now().isoformat()
                })
                
            except asyncio.TimeoutError:
                # Send ping to check if connection is still alive
                await safe_send_to_client(websocket, {
                    "type": "ping",
                    "timestamp": datetime.now().isoformat()
                })
                
    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected normally")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        # Cleanup
        heartbeat_task_handle.cancel()
        metrics_task_handle.cancel()
        
        if websocket in connected_clients:
            connected_clients.remove(websocket)
        logger.info(f"WebSocket connection closed. Active clients: {len(connected_clients)}")

@app.post("/chat")
async def chat_endpoint(chat_message: ChatMessage):
    """Handle chat messages with real LLM integration"""
    try:
        message = chat_message.message
        agent_type = chat_message.agent_type
        auto_select = chat_message.auto_select
        
        logger.info(f"Chat request: {message[:50]}... | Agent: {agent_type} | Auto: {auto_select}")
        
        # Auto-select agent if enabled
        if auto_select and agent_type == "auto":
            selection_result = agent_selector.select_best_agent(message)
            selected_agent = selection_result[0]
            confidence = selection_result[1]
            
            # Broadcast agent selection
            await broadcast_to_clients({
                "type": "agent_selection",
                "selected_agent": selected_agent,
                "confidence": confidence,
                "explanation": f"Selected {selected_agent} agent with {confidence:.1f}% confidence",
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
        
        logger.info(f"Chat response sent for agent: {agent_type}")
        return {"status": "success", "message": "Response sent via WebSocket"}
        
    except Exception as e:
        logger.error(f"Error in chat endpoint: {e}")
        await broadcast_to_clients({
            "type": "agent_error",
            "agent": agent_type if 'agent_type' in locals() else "unknown",
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
        "version": "2.2.0",
        "features": ["real_llm_integration", "auto_agent_selection", "improved_websocket"],
        "openai_configured": bool(OPENAI_API_KEY),
        "connected_clients": len(connected_clients),
        "timestamp": datetime.now().isoformat()
    }

# Test endpoint for WebSocket functionality
@app.post("/test/websocket")
async def test_websocket():
    """Test WebSocket broadcasting"""
    test_message = {
        "type": "test_broadcast",
        "message": "This is a test message",
        "timestamp": datetime.now().isoformat()
    }
    
    await broadcast_to_clients(test_message)
    
    return {
        "status": "success",
        "message": "Test broadcast sent",
        "connected_clients": len(connected_clients)
    }

@app.on_event("startup")
async def startup_event():
    logger.info("Starting Dyor AI Backend with Real LLM Integration...")
    logger.info(f"OpenAI API configured: {bool(OPENAI_API_KEY)}")
    logger.info(f"Initialized {len(AGENT_CONFIGS)} real agents")
    logger.info("Enhanced WebSocket stability features enabled")
    logger.info("Dyor AI Backend started successfully!")

@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Shutting down Dyor AI Backend...")
    # Close all WebSocket connections
    for client in connected_clients:
        try:
            await client.close()
        except:
            pass
    connected_clients.clear()

if __name__ == "__main__":
    uvicorn.run(
        "real_backend_fixed:app",
        host="0.0.0.0",
        port=8002,
        reload=True,
        log_level="info"
    )


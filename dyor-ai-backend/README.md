# Dyor AI Backend

This is the backend for the Dyor AI project, built with FastAPI and integrated with OpenAI's GPT-3.5-turbo for real LLM responses. It includes specialized agents (Manus, Browser, DataAnalysis, SWE) and a WebSocket for real-time communication.

## Features

- Real LLM Integration with OpenAI GPT-3.5-turbo
- Specialized Agents with unique system prompts
- Auto-Agent Selection based on user queries
- Real-time System Metrics (CPU, Memory, Network)
- WebSocket for real-time communication with the frontend
- Improved WebSocket stability with heartbeat and reconnection logic

## Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/green1st/Dyoraireal.git
    cd Dyoraireal/backend
    ```

2.  **Create a virtual environment (recommended):**
    ```bash
    python3 -m venv venv
    source venv/bin/activate
    ```

3.  **Install dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

4.  **Set your OpenAI API Key:**
    The application expects the OpenAI API key to be set as an environment variable named `OPENAI_API_KEY`. Replace `YOUR_OPENAI_API_KEY` with your actual key.
    ```bash
    export OPENAI_API_KEY="YOUR_OPENAI_API_KEY"
    ```
    *Note: For persistent environment variable, add the above line to your `~/.bashrc` or `~/.zshrc` file and then run `source ~/.bashrc`.*

## Running the Backend

To start the backend server, run the following command from the `backend` directory:

```bash
uvicorn real_backend_fixed:app --host 0.0.0.0 --port 8002 --reload
```

The backend will be accessible at `http://0.0.0.0:8002`.

## API Endpoints

- `/ws`: WebSocket endpoint for real-time communication.
- `/chat` (POST): Handle chat messages and get LLM responses.
- `/agents/suggest` (POST): Get agent suggestions for a message.
- `/system/metrics` (GET): Get current system metrics.
- `/agents` (GET): Get available agents.
- `/health` (GET): Health check endpoint.
- `/test/websocket` (POST): Test WebSocket broadcasting.



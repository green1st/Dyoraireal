#!/usr/bin/env python3
"""
Agent Selector Module
Automatically selects the best agent based on task analysis
"""

import re
from typing import Dict, List, Tuple
from dataclasses import dataclass

@dataclass
class AgentCapability:
    """Represents an agent's capabilities and keywords"""
    name: str
    keywords: List[str]
    description: str
    priority_score: int = 1

class AgentSelector:
    """Intelligent agent selection based on task analysis"""
    
    def __init__(self):
        self.agents = {
            "manus": AgentCapability(
                name="manus",
                keywords=[
                    "general", "help", "assist", "explain", "overview", "summary",
                    "guide", "tutorial", "basic", "simple", "question", "what",
                    "how", "why", "tell me", "describe", "general purpose"
                ],
                description="General-purpose AI agent for basic tasks and explanations",
                priority_score=1
            ),
            "browser": AgentCapability(
                name="browser",
                keywords=[
                    "website", "web", "scrape", "scraping", "crawl", "extract",
                    "browser", "navigate", "click", "form", "automation",
                    "selenium", "url", "link", "page", "html", "css", "xpath",
                    "download", "upload", "login", "submit", "search online",
                    "visit", "open", "browse", "internet", "online"
                ],
                description="Web automation and scraping specialist",
                priority_score=3
            ),
            "data": AgentCapability(
                name="data",
                keywords=[
                    "data", "analyze", "analysis", "statistics", "chart", "graph",
                    "visualization", "plot", "pandas", "numpy", "csv", "excel",
                    "database", "sql", "query", "report", "insights", "trends",
                    "correlation", "regression", "machine learning", "ml",
                    "dataset", "dataframe", "pivot", "aggregate", "clean",
                    "process", "transform", "filter", "sort", "group"
                ],
                description="Data analysis and visualization expert",
                priority_score=3
            ),
            "swe": AgentCapability(
                name="swe",
                keywords=[
                    "code", "programming", "script", "function", "class", "module",
                    "python", "javascript", "java", "c++", "development", "build",
                    "create", "implement", "algorithm", "software", "application",
                    "api", "framework", "library", "package", "install", "setup",
                    "debug", "fix", "error", "bug", "test", "unit test",
                    "refactor", "optimize", "performance", "architecture",
                    "design pattern", "oop", "functional", "git", "version control"
                ],
                description="Software engineering and development agent",
                priority_score=3
            )
        }
    
    def analyze_task(self, task: str) -> Dict[str, float]:
        """
        Analyze task and return confidence scores for each agent
        
        Args:
            task: User's task description
            
        Returns:
            Dictionary with agent names as keys and confidence scores as values
        """
        task_lower = task.lower()
        scores = {}
        
        for agent_name, agent in self.agents.items():
            score = 0.0
            keyword_matches = 0
            
            # Count keyword matches
            for keyword in agent.keywords:
                if keyword in task_lower:
                    keyword_matches += 1
                    # Give higher weight to exact matches
                    if keyword == task_lower.strip():
                        score += 2.0
                    else:
                        score += 1.0
            
            # Apply priority multiplier
            score *= agent.priority_score
            
            # Bonus for multiple keyword matches
            if keyword_matches > 1:
                score *= (1 + (keyword_matches - 1) * 0.2)
            
            scores[agent_name] = score
        
        # Normalize scores
        max_score = max(scores.values()) if scores.values() else 1
        if max_score > 0:
            scores = {k: v / max_score for k, v in scores.items()}
        
        return scores
    
    def select_best_agent(self, task: str, threshold: float = 0.3) -> Tuple[str, float, Dict[str, float]]:
        """
        Select the best agent for a given task
        
        Args:
            task: User's task description
            threshold: Minimum confidence threshold for auto-selection
            
        Returns:
            Tuple of (selected_agent, confidence, all_scores)
        """
        scores = self.analyze_task(task)
        
        # Find the best agent
        best_agent = max(scores.keys(), key=lambda k: scores[k])
        best_score = scores[best_agent]
        
        # If confidence is too low, default to manus
        if best_score < threshold:
            return "manus", best_score, scores
        
        return best_agent, best_score, scores
    
    def get_agent_suggestions(self, task: str, top_n: int = 3) -> List[Tuple[str, float, str]]:
        """
        Get top N agent suggestions with their confidence scores
        
        Args:
            task: User's task description
            top_n: Number of top suggestions to return
            
        Returns:
            List of tuples (agent_name, confidence, description)
        """
        scores = self.analyze_task(task)
        
        # Sort by confidence score
        sorted_agents = sorted(scores.items(), key=lambda x: x[1], reverse=True)
        
        suggestions = []
        for agent_name, confidence in sorted_agents[:top_n]:
            agent = self.agents[agent_name]
            suggestions.append((agent_name, confidence, agent.description))
        
        return suggestions
    
    def explain_selection(self, task: str, selected_agent: str) -> str:
        """
        Provide explanation for why an agent was selected
        
        Args:
            task: User's task description
            selected_agent: The selected agent name
            
        Returns:
            Explanation string
        """
        task_lower = task.lower()
        agent = self.agents[selected_agent]
        
        matched_keywords = [kw for kw in agent.keywords if kw in task_lower]
        
        explanation = f"Selected {agent.name.upper()} agent because:\n"
        explanation += f"- Task description: '{task}'\n"
        explanation += f"- Agent specialization: {agent.description}\n"
        
        if matched_keywords:
            explanation += f"- Matched keywords: {', '.join(matched_keywords[:5])}\n"
        else:
            explanation += "- No specific keywords matched, using general-purpose agent\n"
        
        return explanation

# Example usage and testing
if __name__ == "__main__":
    selector = AgentSelector()
    
    # Test cases
    test_tasks = [
        "Help me scrape data from a website",
        "Analyze this CSV file and create visualizations",
        "Write a Python script to automate file processing",
        "What is machine learning?",
        "Extract product information from e-commerce sites",
        "Create charts from sales data",
        "Build a web scraper for news articles",
        "Debug my Python code"
    ]
    
    print("=== Agent Selection Testing ===\n")
    
    for task in test_tasks:
        agent, confidence, scores = selector.select_best_agent(task)
        suggestions = selector.get_agent_suggestions(task)
        
        print(f"Task: '{task}'")
        print(f"Selected Agent: {agent.upper()} (confidence: {confidence:.2f})")
        print(f"All Scores: {scores}")
        print(f"Top Suggestions: {suggestions}")
        print(f"Explanation: {selector.explain_selection(task, agent)}")
        print("-" * 80)


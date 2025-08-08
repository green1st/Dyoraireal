const { GoogleGenerativeAI } = require('@google/generative-ai');

class AIService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || 'AIzaSyBjos5S03noZxcYqU-eKPWbhw1DDQixP_E';
    this.genAI = new GoogleGenerativeAI(this.apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  }

  async createExecutionPlan(command) {
    try {
      const prompt = `
You are an AI web automation assistant. Given a natural language command, create a detailed execution plan.

Command: "${command}"

Create a JSON execution plan with the following structure:
{
  "steps": [
    {
      "action": "navigate|click|type|wait|scroll|extract",
      "target": "URL or element selector or text to type",
      "description": "Human readable description of this step",
      "waitFor": "optional - what to wait for after this action"
    }
  ],
  "expectedOutcome": "What should happen when this plan is executed",
  "riskLevel": "low|medium|high - based on the actions involved"
}

Focus on common web automation tasks like:
- Account registration
- Form filling
- Data extraction/scraping
- Online purchases
- File uploads
- Social media interactions

Provide a practical, step-by-step plan that can be executed by a browser automation tool.
`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      try {
        // Clean the response text to extract JSON
        let cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        
        // Try to find JSON object
        const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found in response');
        }
      } catch (parseError) {
        console.log('Raw AI response:', text);
        // If JSON parsing fails, create a basic plan
        return {
          steps: [
            {
              action: "navigate",
              target: "https://www.google.com",
              description: `Execute command: ${command}`,
              waitFor: "page load"
            }
          ],
          expectedOutcome: `Complete the task: ${command}`,
          riskLevel: "medium"
        };
      }
    } catch (error) {
      console.error('Error creating execution plan:', error);
      throw new Error('Failed to create execution plan');
    }
  }

  async analyzePageContent(content, objective) {
    try {
      const prompt = `
Analyze this webpage content and provide guidance for achieving the objective.

Objective: "${objective}"

Page Content:
${content.substring(0, 2000)}...

Provide a JSON response with:
{
  "relevantElements": ["list of important elements or selectors"],
  "nextAction": "what action should be taken next",
  "confidence": "high|medium|low - how confident you are about the next action",
  "reasoning": "explanation of your analysis"
}
`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      try {
        let cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found in response');
        }
      } catch (parseError) {
        return {
          relevantElements: [],
          nextAction: "continue",
          confidence: "low",
          reasoning: "Unable to parse page content"
        };
      }
    } catch (error) {
      console.error('Error analyzing page content:', error);
      throw new Error('Failed to analyze page content');
    }
  }

  async testApiKey(apiKey = null) {
    try {
      const testKey = apiKey || this.apiKey;
      const testGenAI = new GoogleGenerativeAI(testKey);
      const testModel = testGenAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      
      const result = await testModel.generateContent('Hello, this is a test.');
      const response = await result.response;
      const text = response.text();
      
      return text && text.length > 0;
    } catch (error) {
      console.error('API key test failed:', error);
      return false;
    }
  }

  async improveExecutionPlan(originalPlan, pageContent, error = null) {
    try {
      const prompt = `
You are an AI web automation assistant. Improve the execution plan based on the current page content and any errors encountered.

Original Plan:
${JSON.stringify(originalPlan, null, 2)}

Current Page Content:
${pageContent.substring(0, 1500)}...

${error ? `Error Encountered: ${error}` : ''}

Provide an improved JSON execution plan with the same structure:
{
  "steps": [
    {
      "action": "navigate|click|type|wait|scroll|extract",
      "target": "URL or element selector or text to type",
      "description": "Human readable description of this step",
      "waitFor": "optional - what to wait for after this action"
    }
  ],
  "expectedOutcome": "What should happen when this plan is executed",
  "riskLevel": "low|medium|high - based on the actions involved"
}

Focus on:
- Adapting to the current page structure
- Fixing any errors in the original plan
- Using more specific selectors based on the page content
- Adding necessary wait conditions
`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      try {
        let cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        } else {
          return originalPlan; // Return original if parsing fails
        }
      } catch (parseError) {
        return originalPlan; // Return original if parsing fails
      }
    } catch (error) {
      console.error('Error improving execution plan:', error);
      return originalPlan; // Return original if API call fails
    }
  }
}

module.exports = AIService;


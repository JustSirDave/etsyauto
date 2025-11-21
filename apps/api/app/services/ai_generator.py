"""
AI Content Generator
Generates Etsy-compliant titles, descriptions, and tags
"""
from openai import AsyncOpenAI
from typing import Dict, List
import json
import os


class AIContentGenerator:
    """Generate product content using OpenAI"""
    
    def __init__(self):
        api_key = os.getenv("OPENAI_API_KEY", "")
        if api_key:
            self.client = AsyncOpenAI(api_key=api_key)
        else:
            self.client = None
        self.model = os.getenv("AI_DEFAULT_MODEL", "gpt-4o-mini")
    
    async def generate_content(
        self,
        title: str,
        description: str = None,
        style: str = "friendly",
        tone: str = "helpful"
    ) -> Dict:
        """
        Generate Etsy listing content
        """
        if not self.client:
            raise Exception("OpenAI API key not configured")
        
        # Build prompt
        prompt = self._build_prompt(title, description, style, tone)
        
        # Call OpenAI
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert Etsy listing writer. Generate compelling, "
                               "policy-compliant product titles, descriptions, and tags."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0.7,
            max_tokens=1000,
            response_format={"type": "json_object"}
        )
        
        # Parse response
        content = json.loads(response.choices[0].message.content)
        
        # Calculate cost
        tokens_used = response.usage.total_tokens
        cost_usd_cents = self._calculate_cost(tokens_used)
        
        return {
            "title": content.get("title", title),
            "description": content.get("description", ""),
            "tags": content.get("tags", []),
            "tokens": tokens_used,
            "cost_usd_cents": cost_usd_cents
        }
    
    def _build_prompt(self, title: str, description: str, style: str, tone: str) -> str:
        """Build the AI prompt"""
        prompt = f"""Generate an Etsy listing for this product:

Original Title: {title}
{"Original Description: " + description if description else ""}

Style: {style}
Tone: {tone}

Requirements:
1. Title: 140 characters max, clear and searchable
2. Description: 500-1000 characters, highlight benefits
3. Tags: 13 relevant keywords for Etsy search
4. MUST mention "handmade" or "original design"
5. NO copyrighted brand names

Return JSON:
{{
    "title": "optimized title",
    "description": "compelling description",
    "tags": ["tag1", "tag2", ...]
}}
"""
        return prompt
    
    def _calculate_cost(self, tokens: int) -> int:
        """Calculate cost in USD cents"""
        cost_per_million = 40
        cost_cents = (tokens / 1_000_000) * cost_per_million
        return max(1, int(cost_cents))


# Global instance
ai_generator = AIContentGenerator()
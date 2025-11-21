"""
Policy Compliance Checker
"""
from typing import Dict, List


class PolicyChecker:
    """Check if content complies with Etsy policies"""
    
    PROHIBITED_TERMS = [
        "counterfeit", "replica", "fake",
        "mass-produced", "factory-made",
        "guaranteed", "cure",
        "Disney", "Marvel", "Nike"
    ]
    
    HANDMADE_INDICATORS = [
        "handmade", "hand-made",
        "original design", "custom",
        "artisan", "craft"
    ]
    
    def check_compliance(self, title: str, description: str, tags: List[str]) -> Dict:
        """Check if content is policy compliant"""
        combined_text = f"{title} {description} {' '.join(tags)}".lower()
        
        flags = {
            "handmade_ok": self._check_handmade(combined_text),
            "prohibited_terms": self._check_prohibited(combined_text),
            "compliant": True
        }
        
        if not flags["handmade_ok"] or flags["prohibited_terms"]:
            flags["compliant"] = False
        
        return flags
    
    def _check_handmade(self, text: str) -> bool:
        """Check if handmade indicators present"""
        return any(term in text for term in self.HANDMADE_INDICATORS)
    
    def _check_prohibited(self, text: str) -> List[str]:
        """Check for prohibited terms"""
        found = []
        for term in self.PROHIBITED_TERMS:
            if term.lower() in text:
                found.append(term)
        return found


# Global instance
policy_checker = PolicyChecker()
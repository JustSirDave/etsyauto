"""
Policy Engine for Etsy Compliance
Validates generated content against Etsy policies and platform rules
"""
import re
from typing import List, Dict, Tuple, Optional
from enum import Enum


class PolicyStatus(str, Enum):
    """Policy check status"""
    PASSED = "passed"
    FAILED = "failed"
    NEEDS_REVIEW = "needs_review"
    WARNING = "warning"


class PolicyViolationType(str, Enum):
    """Types of policy violations"""
    BANNED_TERM = "banned_term"
    MISSING_HANDMADE = "missing_handmade"
    TITLE_TOO_LONG = "title_too_long"
    DESCRIPTION_TOO_LONG = "description_too_long"
    TOO_MANY_TAGS = "too_many_tags"
    TAG_TOO_LONG = "tag_too_long"
    PROHIBITED_CLAIMS = "prohibited_claims"
    MISSING_REQUIRED_INFO = "missing_required_info"


# Etsy banned/prohibited terms
BANNED_TERMS = [
    # Intellectual property violations
    "replica", "inspired by", "knockoff", "fake", "bootleg",
    "unauthorized", "counterfeit", "imitation", "copy", "dupe",
    
    # Trademark violations (common examples)
    "disney style", "marvel style", "harry potter style",
    
    # Reselling indicators
    "drop ship", "dropship", "dropshipping", "resell", "reselling",
    "wholesale", "bulk order", "alibaba", "aliexpress",
    
    # Medical/health claims (requires verification)
    "cure", "cures", "heal", "heals", "medical grade",
    "fda approved", "clinically proven", "doctor recommended",
    
    # Prohibited items
    "drug", "weapon", "explosive", "hazmat",
    
    # Misleading terms
    "authentic", "genuine", "official", "licensed" 
]

# Terms that satisfy "handmade" requirement
HANDMADE_TERMS = [
    "handmade", "hand made", "hand-made",
    "handcrafted", "hand crafted", "hand-crafted",
    "handwoven", "hand woven", "hand-woven",
    "handpainted", "hand painted", "hand-painted",
    "custom made", "custom-made", "custommade",
    "artisan", "artisanal", "handbuilt", "hand built",
    "handstitched", "hand stitched", "hand-stitched",
    "personally made", "made by hand", "crafted by hand"
]

# Prohibited claims requiring evidence
PROHIBITED_CLAIMS = [
    "guaranteed", "100% effective", "proven to",
    "scientifically proven", "best in the world",
    "number one", "#1", "miracle", "perfect"
]

# Etsy character limits
ETSY_LIMITS = {
    "title": 140,
    "description": 1000,  # Short description for AI, full is 10k
    "tags": 13,
    "tag_length": 20
}


class PolicyEngine:
    """
    Etsy Policy Compliance Engine
    
    Validates generated content against:
    - Banned terms
    - Handmade requirements
    - Character limits
    - Etsy marketplace policies
    """
    
    def __init__(self, strict_mode: bool = True):
        """
        Initialize policy engine
        
        Args:
            strict_mode: If True, fail on any violation. If False, allow warnings.
        """
        self.strict_mode = strict_mode
        self.banned_terms = [term.lower() for term in BANNED_TERMS]
        self.handmade_terms = [term.lower() for term in HANDMADE_TERMS]
        self.prohibited_claims = [claim.lower() for claim in PROHIBITED_CLAIMS]
    
    def check_content(
        self,
        title: str,
        description: Optional[str] = None,
        tags: Optional[List[str]] = None
    ) -> Tuple[PolicyStatus, List[Dict]]:
        """
        Run all policy checks on generated content
        
        Args:
            title: Product title
            description: Product description (optional)
            tags: Product tags (optional)
            
        Returns:
            Tuple of (overall_status, list_of_violations)
        """
        violations = []
        
        # Check banned terms
        violations.extend(self._check_banned_terms(title, description, tags))
        
        # Check handmade requirement
        handmade_violation = self._check_handmade_requirement(title, description)
        if handmade_violation:
            violations.append(handmade_violation)
        
        # Check character limits
        violations.extend(self._check_character_limits(title, description, tags))
        
        # Check prohibited claims
        violations.extend(self._check_prohibited_claims(title, description))
        
        # Determine overall status
        if not violations:
            return PolicyStatus.PASSED, []
        
        # Check severity
        critical_violations = [v for v in violations if v.get("severity") == "critical"]
        warning_violations = [v for v in violations if v.get("severity") == "warning"]
        
        if critical_violations:
            if self.strict_mode:
                return PolicyStatus.FAILED, violations
            else:
                return PolicyStatus.NEEDS_REVIEW, violations
        elif warning_violations:
            return PolicyStatus.WARNING, violations
        else:
            return PolicyStatus.NEEDS_REVIEW, violations
    
    def _check_banned_terms(
        self,
        title: str,
        description: Optional[str],
        tags: Optional[List[str]]
    ) -> List[Dict]:
        """Check for banned terms in content"""
        violations = []
        
        # Combine all text
        all_text = title.lower()
        if description:
            all_text += " " + description.lower()
        if tags:
            all_text += " " + " ".join(tags).lower()
        
        # Check each banned term
        found_terms = []
        for term in self.banned_terms:
            # Use word boundaries to avoid false positives
            pattern = r'\b' + re.escape(term) + r'\b'
            if re.search(pattern, all_text):
                found_terms.append(term)
        
        if found_terms:
            violations.append({
                "type": PolicyViolationType.BANNED_TERM,
                "severity": "critical",
                "message": f"Contains banned terms: {', '.join(found_terms)}",
                "details": {
                    "banned_terms": found_terms,
                    "locations": self._find_term_locations(title, description, tags, found_terms)
                }
            })
        
        return violations
    
    def _check_handmade_requirement(
        self,
        title: str,
        description: Optional[str]
    ) -> Optional[Dict]:
        """Check if content includes handmade-related terms"""
        # Combine title and description
        all_text = title.lower()
        if description:
            all_text += " " + description.lower()
        
        # Check for any handmade term
        for term in self.handmade_terms:
            pattern = r'\b' + re.escape(term) + r'\b'
            if re.search(pattern, all_text):
                return None  # Found handmade term, requirement satisfied
        
        # No handmade term found
        return {
            "type": PolicyViolationType.MISSING_HANDMADE,
            "severity": "critical",
            "message": "Content must include handmade/handcrafted terminology for Etsy compliance",
            "details": {
                "suggestion": "Add terms like 'handmade', 'handcrafted', 'artisan', or 'custom made'",
                "acceptable_terms": self.handmade_terms[:10]  # Show first 10 options
            }
        }
    
    def _check_character_limits(
        self,
        title: str,
        description: Optional[str],
        tags: Optional[List[str]]
    ) -> List[Dict]:
        """Check Etsy character limits"""
        violations = []
        
        # Title length
        if len(title) > ETSY_LIMITS["title"]:
            violations.append({
                "type": PolicyViolationType.TITLE_TOO_LONG,
                "severity": "critical",
                "message": f"Title exceeds {ETSY_LIMITS['title']} character limit",
                "details": {
                    "current_length": len(title),
                    "max_length": ETSY_LIMITS["title"],
                    "excess": len(title) - ETSY_LIMITS["title"]
                }
            })
        
        # Description length
        if description and len(description) > ETSY_LIMITS["description"]:
            violations.append({
                "type": PolicyViolationType.DESCRIPTION_TOO_LONG,
                "severity": "warning",
                "message": f"Description exceeds {ETSY_LIMITS['description']} character limit",
                "details": {
                    "current_length": len(description),
                    "max_length": ETSY_LIMITS["description"],
                    "excess": len(description) - ETSY_LIMITS["description"]
                }
            })
        
        # Tags
        if tags:
            if len(tags) > ETSY_LIMITS["tags"]:
                violations.append({
                    "type": PolicyViolationType.TOO_MANY_TAGS,
                    "severity": "critical",
                    "message": f"Exceeds {ETSY_LIMITS['tags']} tag limit",
                    "details": {
                        "current_count": len(tags),
                        "max_count": ETSY_LIMITS["tags"],
                        "excess": len(tags) - ETSY_LIMITS["tags"]
                    }
                })
            
            # Check individual tag lengths
            long_tags = [tag for tag in tags if len(tag) > ETSY_LIMITS["tag_length"]]
            if long_tags:
                violations.append({
                    "type": PolicyViolationType.TAG_TOO_LONG,
                    "severity": "critical",
                    "message": f"Some tags exceed {ETSY_LIMITS['tag_length']} character limit",
                    "details": {
                        "long_tags": [
                            {"tag": tag, "length": len(tag)}
                            for tag in long_tags
                        ]
                    }
                })
        
        return violations
    
    def _check_prohibited_claims(
        self,
        title: str,
        description: Optional[str]
    ) -> List[Dict]:
        """Check for prohibited marketing claims"""
        violations = []
        
        # Combine text
        all_text = title.lower()
        if description:
            all_text += " " + description.lower()
        
        # Check prohibited claims
        found_claims = []
        for claim in self.prohibited_claims:
            pattern = r'\b' + re.escape(claim) + r'\b'
            if re.search(pattern, all_text):
                found_claims.append(claim)
        
        if found_claims:
            violations.append({
                "type": PolicyViolationType.PROHIBITED_CLAIMS,
                "severity": "warning",
                "message": "Contains unverifiable marketing claims",
                "details": {
                    "claims": found_claims,
                    "note": "Claims like 'guaranteed' or 'proven' require evidence"
                }
            })
        
        return violations
    
    def _find_term_locations(
        self,
        title: str,
        description: Optional[str],
        tags: Optional[List[str]],
        terms: List[str]
    ) -> Dict[str, List[str]]:
        """Find where banned terms appear"""
        locations = {}
        
        for term in terms:
            pattern = r'\b' + re.escape(term) + r'\b'
            found_in = []
            
            if re.search(pattern, title.lower()):
                found_in.append("title")
            if description and re.search(pattern, description.lower()):
                found_in.append("description")
            if tags:
                for tag in tags:
                    if re.search(pattern, tag.lower()):
                        found_in.append(f"tag: {tag}")
                        break
            
            locations[term] = found_in
        
        return locations
    
    def suggest_fixes(self, violations: List[Dict]) -> List[str]:
        """Generate suggestions to fix violations"""
        suggestions = []
        
        for violation in violations:
            vtype = violation["type"]
            
            if vtype == PolicyViolationType.BANNED_TERM:
                terms = violation["details"]["banned_terms"]
                suggestions.append(f"Remove or replace banned terms: {', '.join(terms)}")
            
            elif vtype == PolicyViolationType.MISSING_HANDMADE:
                suggestions.append("Add 'handmade', 'handcrafted', or similar term to title or description")
            
            elif vtype == PolicyViolationType.TITLE_TOO_LONG:
                excess = violation["details"]["excess"]
                suggestions.append(f"Shorten title by {excess} characters")
            
            elif vtype == PolicyViolationType.TOO_MANY_TAGS:
                excess = violation["details"]["excess"]
                suggestions.append(f"Remove {excess} tags")
            
            elif vtype == PolicyViolationType.TAG_TOO_LONG:
                long_tags = violation["details"]["long_tags"]
                suggestions.append(f"Shorten tags: {', '.join([t['tag'] for t in long_tags])}")
            
            elif vtype == PolicyViolationType.PROHIBITED_CLAIMS:
                claims = violation["details"]["claims"]
                suggestions.append(f"Remove or substantiate claims: {', '.join(claims)}")
        
        return suggestions


# Singleton instance
_policy_engine = None


def get_policy_engine(strict_mode: bool = True) -> PolicyEngine:
    """Get or create policy engine instance"""
    global _policy_engine
    if _policy_engine is None or _policy_engine.strict_mode != strict_mode:
        _policy_engine = PolicyEngine(strict_mode=strict_mode)
    return _policy_engine


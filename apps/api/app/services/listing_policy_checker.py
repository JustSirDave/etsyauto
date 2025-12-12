"""
Listing Policy Compliance Checker
Pre-publish policy enforcement for Etsy listings
"""
from typing import Dict, List, Optional, Tuple, Any
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from app.models.listings import Product
from app.services.policy_engine import PolicyEngine


class ListingPolicyChecker:
    """
    Service for checking listing compliance with Etsy policies before publish/update
    Enforces: handmade requirement, prohibited terms, required fields
    """
    
    def __init__(self, db: Session):
        self.db = db
        self.policy_engine = PolicyEngine()
    
    def check_listing_compliance(
        self,
        listing: Any,  # Mock listing object with product_id
        product: Optional[Product] = None
    ) -> Dict:
        """
        Run comprehensive policy checks on a listing before publish
        
        Args:
            listing: Listing object to check
            product: Optional Product object (if not, will fetch from listing)
        
        Returns:
            Dict with compliance status and details:
            {
                "compliant": bool,
                "policy_status": "passed" | "failed" | "warning",
                "policy_flags": [list of policy violations],
                "can_publish": bool,
                "remediation_required": bool,
                "checks": {detailed check results}
            }
        """
        # Get product if not provided
        if not product and listing.product_id:
            product = self.db.query(Product).filter(Product.id == listing.product_id).first()
        
        if not product:
            return {
                "compliant": False,
                "policy_status": "failed",
                "policy_flags": ["missing_product"],
                "can_publish": False,
                "remediation_required": True,
                "checks": {},
                "error": "No product associated with listing"
            }
        
        # Get title, description, tags from product (handle _raw vs direct)
        title = getattr(product, 'title', None) or getattr(product, 'title_raw', '')
        description = getattr(product, 'description', None) or getattr(product, 'description_raw', '')
        tags = getattr(product, 'tags', None) or getattr(product, 'tags_raw', [])
        
        # Run all policy checks
        checks = {}
        policy_flags = []
        
        # 1. Check title
        title_result = self._check_title(title)
        checks["title"] = title_result
        if title_result["violations"]:
            policy_flags.extend([f"title_{v}" for v in title_result["violations"]])
        
        # 2. Check description
        desc_result = self._check_description(description)
        checks["description"] = desc_result
        if desc_result["violations"]:
            policy_flags.extend([f"description_{v}" for v in desc_result["violations"]])
        
        # 3. Check tags
        tags_result = self._check_tags(tags or [])
        checks["tags"] = tags_result
        if tags_result["violations"]:
            policy_flags.extend([f"tags_{v}" for v in tags_result["violations"]])
        
        # 4. Check required fields
        required_result = self._check_required_fields(product)
        checks["required_fields"] = required_result
        if required_result["violations"]:
            policy_flags.extend([f"required_{v}" for v in required_result["violations"]])
        
        # 5. Check handmade requirement
        handmade_result = self._check_handmade_requirement(title, description)
        checks["handmade"] = handmade_result
        if handmade_result["violations"]:
            policy_flags.extend([f"handmade_{v}" for v in handmade_result["violations"]])
        
        # Determine overall compliance
        has_critical_violations = any(
            check.get("severity") == "critical" 
            for check in checks.values()
        )
        
        has_warnings = any(
            check.get("severity") == "warning"
            for check in checks.values()
        )
        
        # Fail closed: block publish if any critical violations
        can_publish = not has_critical_violations
        compliant = not has_critical_violations and not has_warnings
        
        if has_critical_violations:
            policy_status = "failed"
        elif has_warnings:
            policy_status = "warning"
        else:
            policy_status = "passed"
        
        return {
            "compliant": compliant,
            "policy_status": policy_status,
            "policy_flags": policy_flags,
            "can_publish": can_publish,
            "remediation_required": has_critical_violations or has_warnings,
            "checks": checks,
            "checked_at": datetime.now(timezone.utc).isoformat()
        }
    
    def _check_title(self, title: str) -> Dict:
        """Check title for policy violations"""
        violations = []
        severity = "passed"
        
        if not title or len(title.strip()) == 0:
            violations.append("empty")
            severity = "critical"
            return {
                "passed": False,
                "violations": violations,
                "severity": severity,
                "message": "Title is required"
            }
        
        # Check length (Etsy requires 1-140 characters)
        if len(title) > 140:
            violations.append("too_long")
            severity = "critical"
        
        # Check for prohibited terms
        prohibited_terms = self.policy_engine.get_prohibited_terms()
        found_terms = [term for term in prohibited_terms if term.lower() in title.lower()]
        if found_terms:
            violations.append("prohibited_terms")
            severity = "critical"
        
        # Check for promotional language
        promotional = ["sale", "discount", "promo", "coupon", "free shipping"]
        found_promo = [term for term in promotional if term.lower() in title.lower()]
        if found_promo:
            violations.append("promotional_language")
            severity = "warning"
        
        return {
            "passed": len(violations) == 0,
            "violations": violations,
            "severity": severity,
            "message": f"Found violations: {', '.join(violations)}" if violations else "Title compliant",
            "details": {
                "length": len(title),
                "prohibited_terms_found": found_terms,
                "promotional_terms_found": found_promo
            }
        }
    
    def _check_description(self, description: str) -> Dict:
        """Check description for policy violations"""
        violations = []
        severity = "passed"
        
        if not description or len(description.strip()) == 0:
            violations.append("empty")
            severity = "critical"
            return {
                "passed": False,
                "violations": violations,
                "severity": severity,
                "message": "Description is required"
            }
        
        # Check minimum length (Etsy recommends at least 200 characters)
        if len(description) < 50:
            violations.append("too_short")
            severity = "warning"
        
        # Check for prohibited terms
        prohibited_terms = self.policy_engine.get_prohibited_terms()
        found_terms = [term for term in prohibited_terms if term.lower() in description.lower()]
        if found_terms:
            violations.append("prohibited_terms")
            severity = "critical"
        
        # Check for prohibited claims
        prohibited_claims = [
            "cure", "treat", "heal", "medical", "therapeutic",
            "FDA approved", "clinically proven", "guaranteed results"
        ]
        found_claims = [claim for claim in prohibited_claims if claim.lower() in description.lower()]
        if found_claims:
            violations.append("prohibited_claims")
            severity = "critical"
        
        return {
            "passed": severity != "critical",
            "violations": violations,
            "severity": severity,
            "message": f"Found violations: {', '.join(violations)}" if violations else "Description compliant",
            "details": {
                "length": len(description),
                "prohibited_terms_found": found_terms,
                "prohibited_claims_found": found_claims
            }
        }
    
    def _check_tags(self, tags: List[str]) -> Dict:
        """Check tags for policy violations"""
        violations = []
        severity = "passed"
        
        if not tags or len(tags) == 0:
            violations.append("no_tags")
            severity = "warning"
            return {
                "passed": False,
                "violations": violations,
                "severity": severity,
                "message": "At least 3 tags recommended"
            }
        
        # Check tag count (Etsy allows up to 13 tags)
        if len(tags) > 13:
            violations.append("too_many")
            severity = "critical"
        
        # Check for prohibited terms in tags
        prohibited_terms = self.policy_engine.get_prohibited_terms()
        for tag in tags:
            if any(term.lower() in tag.lower() for term in prohibited_terms):
                violations.append("prohibited_terms")
                severity = "critical"
                break
        
        # Check tag length (max 20 characters each)
        long_tags = [tag for tag in tags if len(tag) > 20]
        if long_tags:
            violations.append("tags_too_long")
            severity = "critical"
        
        return {
            "passed": severity != "critical",
            "violations": violations,
            "severity": severity,
            "message": f"Found violations: {', '.join(violations)}" if violations else "Tags compliant",
            "details": {
                "tag_count": len(tags),
                "long_tags": long_tags
            }
        }
    
    def _check_required_fields(self, product: Product) -> Dict:
        """Check that all required fields are present"""
        violations = []
        missing_fields = []
        
        # Get fields (handle both _raw and direct attributes)
        title = getattr(product, 'title', None) or getattr(product, 'title_raw', '')
        description = getattr(product, 'description', None) or getattr(product, 'description_raw', '')
        
        # Check required fields
        if not title or len(str(title).strip()) == 0:
            missing_fields.append("title")
        
        if not description or len(str(description).strip()) == 0:
            missing_fields.append("description")
        
        if not product.price or product.price <= 0:
            missing_fields.append("price")
        
        if product.quantity is None or product.quantity < 0:
            missing_fields.append("quantity")
        
        if missing_fields:
            violations.append("missing_fields")
        
        severity = "critical" if violations else "passed"
        
        return {
            "passed": len(violations) == 0,
            "violations": violations,
            "severity": severity,
            "message": f"Missing required fields: {', '.join(missing_fields)}" if missing_fields else "All required fields present",
            "details": {
                "missing_fields": missing_fields
            }
        }
    
    def _check_handmade_requirement(self, title: str, description: str) -> Dict:
        """Check for handmade indication (Etsy requirement)"""
        violations = []
        severity = "passed"
        
        # Etsy requires listings to indicate if items are handmade
        handmade_indicators = [
            "handmade", "hand made", "hand-made", "handcrafted", "hand crafted",
            "artisan", "custom made", "made to order", "bespoke"
        ]
        
        combined_text = f"{title} {description}".lower()
        
        has_handmade = any(indicator in combined_text for indicator in handmade_indicators)
        
        if not has_handmade:
            violations.append("no_handmade_indication")
            severity = "warning"  # Warning, not critical (some items may not be handmade)
        
        return {
            "passed": len(violations) == 0,
            "violations": violations,
            "severity": severity,
            "message": "Handmade indication missing. Consider adding 'handmade' or similar terms." if violations else "Handmade indication present",
            "details": {
                "has_handmade_indicator": has_handmade
            }
        }
    
    def store_policy_result(self, listing: Any, compliance_result: Dict) -> None:
        """
        Store policy check results on the listing
        
        Args:
            listing: Listing object to update
            compliance_result: Result from check_listing_compliance()
        """
        listing.policy_status = compliance_result["policy_status"]
        listing.policy_flags = compliance_result["policy_flags"]
        listing.policy_checked_at = datetime.now(timezone.utc)
        listing.can_publish = compliance_result["can_publish"]
        
        self.db.commit()
    
    def can_publish_listing(self, listing: Any) -> Tuple[bool, Optional[str]]:
        """
        Check if a listing can be published based on policy compliance
        
        Args:
            listing: Listing to check
        
        Returns:
            Tuple of (can_publish, reason)
        """
        if not listing.policy_checked_at:
            return False, "Policy check required before publish"
        
        if listing.policy_status == "failed":
            return False, f"Policy violations must be resolved: {', '.join(listing.policy_flags or [])}"
        
        if not listing.can_publish:
            return False, "Listing marked as non-compliant"
        
        return True, None


"""
Listing Policy Compliance Checker
Simple field presence and Etsy limit checks before publish (no AI/policy engine).
"""
from typing import Dict, List, Optional, Tuple, Any
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from app.models.listings import Product


# Etsy limits
ETSY_TITLE_MAX = 140
ETSY_TAGS_MAX = 13
ETSY_TAG_LENGTH_MAX = 20


class ListingPolicyChecker:
    """
    Simple compliance checker: required fields and Etsy character/count limits only.
    """

    def __init__(self, db: Session):
        self.db = db

    def check_listing_compliance(
        self,
        listing: Any,
        product: Optional[Product] = None,
    ) -> Dict:
        """
        Run simple field and limit checks on a listing before publish.

        Returns:
            Dict with compliant, policy_status, policy_flags, can_publish,
            remediation_required, checks, checked_at
        """
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
                "checked_at": datetime.now(timezone.utc).isoformat(),
            }

        title = getattr(product, "title", None) or getattr(product, "title_raw", "") or ""
        description = getattr(product, "description", None) or getattr(product, "description_raw", "") or ""
        tags = getattr(product, "tags", None) or getattr(product, "tags_raw", []) or []

        if not isinstance(tags, list):
            tags = []

        checks = {}
        policy_flags = []

        title_result = self._check_title(title)
        checks["title"] = title_result
        if title_result["violations"]:
            policy_flags.extend([f"title_{v}" for v in title_result["violations"]])

        desc_result = self._check_description(description)
        checks["description"] = desc_result
        if desc_result["violations"]:
            policy_flags.extend([f"description_{v}" for v in desc_result["violations"]])

        tags_result = self._check_tags(tags)
        checks["tags"] = tags_result
        if tags_result["violations"]:
            policy_flags.extend([f"tags_{v}" for v in tags_result["violations"]])

        required_result = self._check_required_fields(product)
        checks["required_fields"] = required_result
        if required_result["violations"]:
            policy_flags.extend([f"required_{v}" for v in required_result["violations"]])

        has_critical = any(c.get("severity") == "critical" for c in checks.values())
        has_warning = any(c.get("severity") == "warning" for c in checks.values())
        can_publish = not has_critical
        compliant = not has_critical and not has_warning
        policy_status = "failed" if has_critical else ("warning" if has_warning else "passed")

        return {
            "compliant": compliant,
            "policy_status": policy_status,
            "policy_flags": policy_flags,
            "can_publish": can_publish,
            "remediation_required": has_critical or has_warning,
            "checks": checks,
            "checked_at": datetime.now(timezone.utc).isoformat(),
        }

    def _check_title(self, title: str) -> Dict:
        violations = []
        severity = "passed"
        if not title or len(title.strip()) == 0:
            violations.append("empty")
            severity = "critical"
        elif len(title) > ETSY_TITLE_MAX:
            violations.append("too_long")
            severity = "critical"
        return {
            "passed": len(violations) == 0,
            "violations": violations,
            "severity": severity,
            "message": "Title required, max 140 characters" if violations else "Title OK",
            "details": {"length": len(title)},
        }

    def _check_description(self, description: str) -> Dict:
        violations = []
        severity = "passed"
        if not description or len(description.strip()) == 0:
            violations.append("empty")
            severity = "critical"
        return {
            "passed": len(violations) == 0,
            "violations": violations,
            "severity": severity,
            "message": "Description is required" if violations else "Description OK",
            "details": {"length": len(description)},
        }

    def _check_tags(self, tags: List[str]) -> Dict:
        violations = []
        severity = "passed"
        long_tags = []
        if not tags or len(tags) == 0:
            violations.append("no_tags")
            severity = "warning"
        else:
            if len(tags) > ETSY_TAGS_MAX:
                violations.append("too_many")
                severity = "critical"
            long_tags = [t for t in tags if len(t) > ETSY_TAG_LENGTH_MAX]
            if long_tags:
                violations.append("tags_too_long")
                severity = "critical"
        return {
            "passed": severity != "critical",
            "violations": violations,
            "severity": severity,
            "message": "Up to 13 tags, each max 20 characters" if violations else "Tags OK",
            "details": {"tag_count": len(tags), "long_tags": long_tags},
        }

    def _check_required_fields(self, product: Product) -> Dict:
        violations = []
        missing = []
        title = getattr(product, "title", None) or getattr(product, "title_raw", "")
        description = getattr(product, "description", None) or getattr(product, "description_raw", "")
        if not title or len(str(title).strip()) == 0:
            missing.append("title")
        if not description or len(str(description).strip()) == 0:
            missing.append("description")
        if not product.price or product.price <= 0:
            missing.append("price")
        if product.quantity is None or product.quantity < 0:
            missing.append("quantity")
        if missing:
            violations.append("missing_fields")
        severity = "critical" if violations else "passed"
        return {
            "passed": len(violations) == 0,
            "violations": violations,
            "severity": severity,
            "message": f"Missing: {', '.join(missing)}" if missing else "Required fields OK",
            "details": {"missing_fields": missing},
        }

    def store_policy_result(self, listing: Any, compliance_result: Dict) -> None:
        listing.policy_status = compliance_result["policy_status"]
        listing.policy_flags = compliance_result["policy_flags"]
        listing.policy_checked_at = datetime.now(timezone.utc)
        listing.can_publish = compliance_result["can_publish"]
        self.db.commit()

    def can_publish_listing(self, listing: Any) -> Tuple[bool, Optional[str]]:
        if not getattr(listing, "policy_checked_at", None):
            return False, "Policy check required before publish"
        if getattr(listing, "policy_status", None) == "failed":
            return False, ", ".join(listing.policy_flags or [])
        if not getattr(listing, "can_publish", True):
            return False, "Listing marked as non-compliant"
        return True, None

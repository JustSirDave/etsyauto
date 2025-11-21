"""
Placeholder router - will be implemented in subsequent phases
"""
from fastapi import APIRouter

router = APIRouter()

@router.get("/")
async def placeholder():
    return {"message": "Endpoint not yet implemented"}

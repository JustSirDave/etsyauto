"""
Pytest configuration for async tests
"""
import pytest

# Configure pytest-asyncio to use default event loop
pytest_plugins = ('pytest_asyncio',)


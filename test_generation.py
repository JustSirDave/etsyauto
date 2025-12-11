"""
Quick test script to verify AI generation endpoint
"""
import requests
import json

# Configuration
API_URL = "http://localhost:8000"
# Replace with your actual token
TOKEN = "your_token_here"

def test_generation():
    """Test the AI generation endpoint"""
    
    # First, let's create a test product
    product_data = {
        "sku": "TEST-001",
        "title_raw": "Blue Ceramic Mug",
        "description_raw": "A beautiful ceramic mug with blue glaze",
        "price": 25.00,
        "quantity": 10
    }
    
    print("1. Creating test product...")
    response = requests.post(
        f"{API_URL}/api/products/import",
        headers={
            "Authorization": f"Bearer {TOKEN}",
            "Content-Type": "application/json"
        },
        json=product_data
    )
    
    if response.status_code == 200:
        product_id = response.json()["product_id"]
        print(f"✅ Product created with ID: {product_id}")
    else:
        print(f"❌ Failed to create product: {response.status_code}")
        print(response.text)
        return
    
    # Now test generation
    print(f"\n2. Generating AI content for product {product_id}...")
    response = requests.post(
        f"{API_URL}/api/products/{product_id}/generate",
        headers={
            "Authorization": f"Bearer {TOKEN}",
            "Content-Type": "application/json"
        },
        json={
            "model": "gpt-4o-mini",
            "style": "friendly",
            "tone": "professional"
        }
    )
    
    print(f"Status: {response.status_code}")
    
    if response.status_code == 200:
        result = response.json()
        print("\n✅ Generation successful!")
        print(f"\nTitle: {result['title']}")
        print(f"\nDescription: {result['description'][:100]}...")
        print(f"\nTags: {', '.join(result['tags'])}")
        print(f"\nPolicy Status: {result['policy_status']}")
        print(f"\nNeeds Review: {result['needs_review']}")
        
        if result['needs_review']:
            print(f"\n⚠️ {result['message']}")
            if result['policy_flags']:
                print("\nViolations:")
                for violation in result['policy_flags'].get('violations', []):
                    print(f"  - {violation['message']}")
    else:
        print(f"\n❌ Generation failed!")
        print(f"Response: {response.text}")

if __name__ == "__main__":
    print("=" * 60)
    print("AI Generation Test Script")
    print("=" * 60)
    print("\nNote: Replace TOKEN variable with your actual token")
    print("\nTo get a token, login via the frontend and copy it from localStorage")
    print("=" * 60 + "\n")
    
    # Uncomment to run the test
    # test_generation()
    
    print("Update the TOKEN variable and uncomment test_generation() to run")


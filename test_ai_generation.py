"""
Diagnostic Script: Test AI Generation Endpoint
Run this to test if the AI generation backend is working correctly
"""
import requests
import json
import sys
import os

# Configuration
API_BASE_URL = "http://localhost:8080"
TEST_PRODUCT_ID = 1  # Change this to an actual product ID from your database

def test_backend_health():
    """Test if backend is running"""
    print("\n📡 Testing backend health...")
    try:
        response = requests.get(f"{API_BASE_URL}/healthz", timeout=5)
        if response.status_code == 200:
            print("✅ Backend is running")
            print(f"   Response: {response.json()}")
            return True
        else:
            print(f"❌ Backend health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Cannot connect to backend: {e}")
        return False

def test_openai_key():
    """Check if OpenAI API key is configured"""
    print("\n🔑 Checking OpenAI API key...")
    api_key = os.getenv("OPENAI_API_KEY", "")
    if api_key:
        print(f"✅ OpenAI API key found (starts with: {api_key[:20]}...)")
        return True
    else:
        print("❌ OpenAI API key not found in environment")
        print("   Make sure your .env file has OPENAI_API_KEY set")
        return False

def login():
    """Login to get auth token"""
    print("\n🔐 Logging in...")
    print("   Enter your credentials:")
    email = input("   Email: ")
    password = input("   Password: ")

    try:
        response = requests.post(
            f"{API_BASE_URL}/api/auth/login",
            json={"email": email, "password": password},
            headers={"Content-Type": "application/json"}
        )

        if response.status_code == 200:
            data = response.json()
            token = data.get("access_token")
            print(f"✅ Login successful")
            return token
        else:
            print(f"❌ Login failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return None
    except Exception as e:
        print(f"❌ Login error: {e}")
        return None

def get_products(token):
    """Get list of products"""
    print("\n📦 Fetching products...")
    try:
        response = requests.get(
            f"{API_BASE_URL}/api/products/",
            headers={"Authorization": f"Bearer {token}"}
        )

        if response.status_code == 200:
            data = response.json()
            products = data.get("products", [])
            print(f"✅ Found {len(products)} products")

            if products:
                print("\n   Available products:")
                for i, product in enumerate(products[:5]):
                    print(f"   {i+1}. ID: {product['id']} - {product['title_raw'][:50]}")
                return products
            else:
                print("⚠️  No products found. Please import products first.")
                return []
        else:
            print(f"❌ Failed to fetch products: {response.status_code}")
            print(f"   Response: {response.text}")
            return []
    except Exception as e:
        print(f"❌ Error fetching products: {e}")
        return []

def test_ai_generation(token, product_id):
    """Test AI generation for a specific product"""
    print(f"\n🤖 Testing AI generation for product ID {product_id}...")

    try:
        response = requests.post(
            f"{API_BASE_URL}/api/products/{product_id}/generate",
            json={
                "model": "gpt-4o-mini",
                "style": "friendly",
                "tone": "helpful"
            },
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            }
        )

        print(f"\n   Status Code: {response.status_code}")

        if response.status_code == 200:
            data = response.json()
            print("✅ AI generation successful!")
            print(f"\n   Generated Content:")
            print(f"   - Title: {data.get('title', 'N/A')[:80]}")
            print(f"   - Description: {data.get('description', 'N/A')[:100]}...")
            print(f"   - Tags: {', '.join(data.get('tags', [])[:5])}")
            print(f"   - Cost: ${data.get('cost', {}).get('usd_cents', 0) / 100:.4f}")
            print(f"   - Policy Compliant: {data.get('policy_flags', {}).get('compliant', False)}")
            return True
        else:
            print(f"❌ AI generation failed")
            print(f"   Status: {response.status_code}")
            print(f"   Response: {response.text}")

            try:
                error_data = response.json()
                if "detail" in error_data:
                    print(f"\n   Error Detail: {error_data['detail']}")
            except:
                pass

            return False
    except Exception as e:
        print(f"❌ Error during AI generation: {e}")
        return False

def main():
    """Main diagnostic flow"""
    print("=" * 60)
    print("🔍 AI Generation Diagnostic Tool")
    print("=" * 60)

    # Step 1: Check backend health
    if not test_backend_health():
        print("\n❌ Backend is not running. Start it with:")
        print("   cd apps/api && python main.py")
        sys.exit(1)

    # Step 2: Check OpenAI key
    test_openai_key()

    # Step 3: Login
    token = login()
    if not token:
        print("\n❌ Authentication failed. Cannot continue.")
        sys.exit(1)

    # Step 4: Get products
    products = get_products(token)
    if not products:
        print("\n⚠️  No products available for testing.")
        print("   Import products first from the Products page.")
        sys.exit(1)

    # Step 5: Select product to test
    print("\n   Which product would you like to test?")
    choice = input(f"   Enter number (1-{min(len(products), 5)}) or product ID: ")

    try:
        choice_num = int(choice)
        if choice_num <= 5:
            product_id = products[choice_num - 1]['id']
        else:
            product_id = choice_num
    except:
        product_id = products[0]['id']
        print(f"   Using first product (ID: {product_id})")

    # Step 6: Test AI generation
    success = test_ai_generation(token, product_id)

    print("\n" + "=" * 60)
    if success:
        print("✅ AI generation is working correctly!")
        print("\nIf it's still not working in the browser:")
        print("1. Check browser console (F12) for errors")
        print("2. Clear browser cache and reload")
        print("3. Check that product is selected in the dropdown")
    else:
        print("❌ AI generation failed")
        print("\nPossible issues:")
        print("1. OpenAI API key is invalid or expired")
        print("2. OpenAI API is down or rate limited")
        print("3. Backend database connection issue")
        print("4. Backend environment variables not loaded")
    print("=" * 60)

if __name__ == "__main__":
    main()

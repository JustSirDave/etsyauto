#!/usr/bin/env python3
"""
Test Sentry Integration
Verifies that Sentry is properly integrated and PII/secrets are scrubbed
"""
import os
import sys

# Set test environment (no real Sentry DSN needed for scrubbing tests)
os.environ['SENTRY_DSN'] = ''  # Disable actual Sentry sending for tests

sys.path.insert(0, 'apps/api')

from app.core.sentry_config import (
    scrub_sensitive_data,
    scrub_pii,
    before_send
)

def test_sensitive_data_scrubbing():
    """Test that sensitive data is properly scrubbed"""
    print("🧪 Testing Sensitive Data Scrubbing...")
    
    # Test data with secrets
    data = {
        'username': 'john_doe',
        'password': 'super_secret_password',
        'api_key': 'sk-1234567890',
        'access_token': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
        'refresh_token': 'refresh_abc123',
        'authorization': 'Bearer token_here',
        'safe_field': 'this should remain'
    }
    
    scrubbed = scrub_sensitive_data(data)
    
    # Verify secrets are redacted
    assert scrubbed['password'] == '[REDACTED]', "❌ Password not redacted"
    assert scrubbed['api_key'] == '[REDACTED]', "❌ API key not redacted"
    assert scrubbed['access_token'] == '[REDACTED]', "❌ Access token not redacted"
    assert scrubbed['refresh_token'] == '[REDACTED]', "❌ Refresh token not redacted"
    assert scrubbed['authorization'] == '[REDACTED]', "❌ Authorization not redacted"
    
    # Verify safe fields remain
    assert scrubbed['username'] == 'john_doe', "❌ Username was incorrectly scrubbed"
    assert scrubbed['safe_field'] == 'this should remain', "❌ Safe field was scrubbed"
    
    print("✅ Sensitive data scrubbing works correctly")

def test_pii_scrubbing():
    """Test that PII is properly scrubbed"""
    print("\n🧪 Testing PII Scrubbing...")
    
    # Test data with PII
    data = {
        'email': 'user@example.com',
        'phone': '+1-555-0123',
        'first_name': 'John',
        'last_name': 'Doe',
        'credit_card': '4532-1111-2222-3333',
        'ip_address': '192.168.1.1',
        'user_id': '12345',
        'safe_data': 'this is safe'
    }
    
    scrubbed = scrub_pii(data)
    
    # Verify PII is redacted
    assert scrubbed['email'] == '[PII]', "❌ Email not scrubbed"
    assert scrubbed['phone'] == '[PII]', "❌ Phone not scrubbed"
    assert scrubbed['first_name'] == '[PII]', "❌ First name not scrubbed"
    assert scrubbed['last_name'] == '[PII]', "❌ Last name not scrubbed"
    assert scrubbed['credit_card'] == '[PII]', "❌ Credit card not scrubbed"
    assert scrubbed['ip_address'] == '[PII]', "❌ IP address not scrubbed"
    
    # Verify safe fields remain
    assert scrubbed['user_id'] == '12345', "❌ User ID was incorrectly scrubbed"
    assert scrubbed['safe_data'] == 'this is safe', "❌ Safe data was scrubbed"
    
    print("✅ PII scrubbing works correctly")

def test_nested_scrubbing():
    """Test that nested data structures are scrubbed"""
    print("\n🧪 Testing Nested Data Scrubbing...")
    
    data = {
        'user': {
            'name': 'John Doe',
            'credentials': {
                'password': 'secret123',
                'api_key': 'sk-test-key'
            }
        },
        'items': [
            {'token': 'abc123', 'value': 100},
            {'token': 'def456', 'value': 200}
        ]
    }
    
    scrubbed = scrub_sensitive_data(data)
    
    # Verify nested secrets are redacted
    assert scrubbed['user']['name'] == '[PII]', "❌ Nested name not scrubbed"
    assert scrubbed['user']['credentials']['password'] == '[REDACTED]', "❌ Nested password not redacted"
    assert scrubbed['user']['credentials']['api_key'] == '[REDACTED]', "❌ Nested API key not redacted"
    assert scrubbed['items'][0]['token'] == '[REDACTED]', "❌ Array token not redacted"
    assert scrubbed['items'][1]['token'] == '[REDACTED]', "❌ Array token not redacted"
    
    # Verify safe fields remain
    assert scrubbed['items'][0]['value'] == 100, "❌ Safe value was scrubbed"
    
    print("✅ Nested data scrubbing works correctly")

def test_sentry_event_scrubbing():
    """Test that Sentry events are scrubbed before sending"""
    print("\n🧪 Testing Sentry Event Scrubbing...")
    
    # Mock Sentry event
    event = {
        'request': {
            'headers': {
                'Authorization': 'Bearer secret_token',
                'User-Agent': 'Mozilla/5.0'
            },
            'data': {
                'username': 'test_user',
                'password': 'secret_password'
            },
            'cookies': {
                'session': 'session_token_here'
            }
        },
        'extra': {
            'api_key': 'sk-test-key',
            'tenant_id': '123'
        }
    }
    
    scrubbed_event = before_send(event, {})
    
    # Verify request data is scrubbed
    assert scrubbed_event['request']['headers']['Authorization'] == '[REDACTED]', "❌ Authorization header not scrubbed"
    assert scrubbed_event['request']['data']['password'] == '[REDACTED]', "❌ Request password not scrubbed"
    assert scrubbed_event['request']['cookies']['session'] == '[REDACTED]', "❌ Cookie not scrubbed"
    assert scrubbed_event['extra']['api_key'] == '[REDACTED]', "❌ Extra API key not scrubbed"
    
    # Verify safe fields remain
    assert scrubbed_event['request']['headers']['User-Agent'] == 'Mozilla/5.0', "❌ User-Agent was scrubbed"
    assert scrubbed_event['extra']['tenant_id'] == '123', "❌ Tenant ID was scrubbed"
    
    print("✅ Sentry event scrubbing works correctly")

def test_context_tagging():
    """Test that context tagging works"""
    print("\n🧪 Testing Context Tagging...")
    
    from app.core.sentry_config import set_sentry_context
    import sentry_sdk
    
    # Set context
    set_sentry_context(
        tenant_id=123,
        shop_id=456,
        user_id=789,
        request_id='test-request-id',
        job_id=999
    )
    
    # Get current scope (would normally be sent to Sentry)
    with sentry_sdk.configure_scope() as scope:
        tags = scope._tags
        user = scope._user
        
        # Verify tags are set
        assert tags.get('tenant_id') == '123', "❌ Tenant ID tag not set"
        assert tags.get('shop_id') == '456', "❌ Shop ID tag not set"
        assert tags.get('request_id') == 'test-request-id', "❌ Request ID tag not set"
        assert tags.get('job_id') == '999', "❌ Job ID tag not set"
        
        # Verify user context
        assert user.get('id') == '789', "❌ User ID not set"
    
    print("✅ Context tagging works correctly")

def run_all_tests():
    """Run all Sentry integration tests"""
    print("=" * 60)
    print("🚀 Testing Sentry Integration")
    print("=" * 60)
    
    try:
        test_sensitive_data_scrubbing()
        test_pii_scrubbing()
        test_nested_scrubbing()
        test_sentry_event_scrubbing()
        test_context_tagging()
        
        print("\n" + "=" * 60)
        print("✅ ALL TESTS PASSED")
        print("=" * 60)
        print("\n📝 Summary:")
        print("  ✅ Sensitive data scrubbing (passwords, tokens, keys)")
        print("  ✅ PII scrubbing (emails, names, phone numbers)")
        print("  ✅ Nested data structure scrubbing")
        print("  ✅ Sentry event scrubbing before send")
        print("  ✅ Context tagging (tenant_id, shop_id, etc.)")
        print("\n🎯 Sentry integration is production-ready!")
        
        return 0
        
    except AssertionError as e:
        print(f"\n❌ TEST FAILED: {e}")
        return 1
    except Exception as e:
        print(f"\n💥 ERROR: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == '__main__':
    sys.exit(run_all_tests())


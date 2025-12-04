import { NextRequest, NextResponse } from 'next/server';
import { mockUsers, mockTokens } from '../_storage';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { detail: 'Email and password required' },
        { status: 400 }
      );
    }

    // Find or create user for demo
    let user = mockUsers.find(u => u.email === email);
    
    if (!user) {
      user = {
        id: mockUsers.length + 1,
        email,
        name: email.split('@')[0],
        tenant_id: mockUsers.length + 1,
        tenant_name: 'My Shop',
        role: 'owner',
        email_verified: true,
        onboarding_completed: false,
      };
      mockUsers.push(user);
    }

    // Generate simple token
    const token = `demo_token_${Date.now()}_${user.id}`;
    mockTokens.set(token, user);

    return NextResponse.json({
      access_token: token,
      token_type: 'bearer',
      expires_in: 604800,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        email_verified: user.email_verified,
        profile_picture_url: null,
      },
      tenant: {
        id: user.tenant_id,
        name: user.tenant_name,
        role: user.role,
        description: null,
        onboarding_completed: user.onboarding_completed,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { detail: error.message || 'Login failed' },
      { status: 500 }
    );
  }
}


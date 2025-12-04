import { NextRequest, NextResponse } from 'next/server';
import { mockTokens } from '../_storage';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { detail: 'Not authenticated' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const user = mockTokens.get(token);

    if (!user) {
      // Return demo user for demo purposes
      return NextResponse.json({
        id: 1,
        email: 'demo@example.com',
        name: 'Demo User',
        email_verified: true,
        profile_picture_url: null,
        tenant_id: 1,
        tenant_name: 'My Shop',
        tenant_description: null,
        onboarding_completed: false,
        role: 'owner',
      });
    }

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      email_verified: user.email_verified,
      profile_picture_url: user.profile_picture_url || null,
      tenant_id: user.tenant_id,
      tenant_name: user.tenant_name,
      tenant_description: user.tenant_description || null,
      onboarding_completed: user.onboarding_completed,
      role: user.role,
    });
  } catch (error: any) {
    return NextResponse.json(
      { detail: 'Invalid token' },
      { status: 401 }
    );
  }
}


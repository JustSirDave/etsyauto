import { NextRequest, NextResponse } from 'next/server';
import { mockUsers, mockTokens } from '../../auth/_storage';

export async function POST(request: NextRequest) {
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
      return NextResponse.json(
        { detail: 'User not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { shop_name, description } = body;

    // Update user
    user.tenant_name = shop_name || user.tenant_name;
    user.tenant_description = description || null;
    user.onboarding_completed = true;

    return NextResponse.json({
      message: 'Onboarding completed successfully',
      tenant: {
        id: user.tenant_id,
        name: user.tenant_name,
        description: user.tenant_description,
        onboarding_completed: true,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { detail: error.message || 'Failed to complete onboarding' },
      { status: 500 }
    );
  }
}


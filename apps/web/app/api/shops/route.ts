import { NextRequest, NextResponse } from 'next/server';
import { mockTokens } from '../auth/_storage';

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
      // Return empty array for demo
      return NextResponse.json([]);
    }

    // Return mock shops
    return NextResponse.json([
      {
        id: 1,
        etsy_shop_id: 'demo_shop_123',
        display_name: user.tenant_name || 'My Shop',
        status: 'connected',
        created_at: new Date().toISOString(),
      },
    ]);
  } catch (error: any) {
    return NextResponse.json(
      { detail: error.message || 'Failed to fetch shops' },
      { status: 500 }
    );
  }
}


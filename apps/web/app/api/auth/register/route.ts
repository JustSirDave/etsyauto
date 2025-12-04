import { NextRequest, NextResponse } from 'next/server';

// Mock storage (in-memory, resets on deployment)
const mockUsers: any[] = [];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, name, tenant_name } = body;

    if (!email || !password || !name || !tenant_name) {
      return NextResponse.json(
        { detail: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if user exists
    if (mockUsers.find(u => u.email === email)) {
      return NextResponse.json(
        { detail: 'Email already registered' },
        { status: 400 }
      );
    }

    // Create mock user
    const newUser = {
      id: mockUsers.length + 1,
      email,
      name,
      tenant_id: mockUsers.length + 1,
      tenant_name,
      role: 'owner',
      email_verified: false,
      onboarding_completed: false,
    };

    mockUsers.push(newUser);

    // Return 202 for email verification
    return NextResponse.json(
      {
        message: 'Account created successfully. Please check your email to verify your account.',
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          email_verified: false,
        },
      },
      { status: 202 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { detail: error.message || 'Registration failed' },
      { status: 500 }
    );
  }
}


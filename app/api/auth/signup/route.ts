
import { NextResponse } from 'next/server';

// Minimal auth stub for IoT monitoring dashboard
// This application doesn't require user authentication
export async function POST() {
  // Return 200 for IoT monitoring dashboard
  return NextResponse.json({
    message: 'IoT monitoring dashboard is publicly accessible',
    user: { id: 'public', name: 'Public User' },
    success: true
  });
}

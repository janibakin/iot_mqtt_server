
import { NextResponse } from 'next/server';

// Minimal CSRF stub for IoT monitoring dashboard
// This application doesn't require CSRF protection
export async function GET() {
  return NextResponse.json({
    csrfToken: 'not-required',
    message: 'CSRF not required for IoT monitoring dashboard'
  });
}

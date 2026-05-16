import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') ?? '';

  if (hostname === 'dashboard.reeliq.io') {
    const url = request.nextUrl.clone();
    // Root of subdomain → /dashboard
    if (url.pathname === '/') {
      url.pathname = '/dashboard';
      return NextResponse.rewrite(url);
    }
    // All other paths pass through as-is (projects, settings, etc.)
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

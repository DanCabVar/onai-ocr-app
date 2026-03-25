import { NextRequest, NextResponse } from 'next/server';

// Routes that only belong on the landing domain (ocr.moti.cl)
const LANDING_ONLY_ROUTES = ['/', '/pricing', '/terms', '/privacy', '/help'];

// Routes that only belong on the app domain (app.ocr.moti.cl)
const APP_ONLY_ROUTES = [
  '/dashboard',
  '/documents',
  '/document-types',
  '/storage',
  '/settings',
  '/admin',
  '/profile',
];

// Shared routes (available on both): /login, /register, /api

function isLandingDomain(hostname: string): boolean {
  // Match ocr.moti.cl or localhost for dev
  return hostname === 'ocr.moti.cl' || hostname.startsWith('ocr.moti.cl:');
}

function isAppDomain(hostname: string): boolean {
  return hostname === 'app.ocr.moti.cl' || hostname.startsWith('app.ocr.moti.cl:');
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = request.headers.get('host') || '';

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.ocr.moti.cl';
  const landingUrl = process.env.NEXT_PUBLIC_LANDING_URL || 'https://ocr.moti.cl';

  // Skip API routes and static files
  if (pathname.startsWith('/api') || pathname.startsWith('/_next') || pathname.startsWith('/favicon')) {
    return NextResponse.next();
  }

  // On landing domain, block app-only routes → redirect to app domain
  if (isLandingDomain(hostname)) {
    const isAppRoute = APP_ONLY_ROUTES.some(
      (route) => pathname === route || pathname.startsWith(route + '/')
    );
    if (isAppRoute) {
      return NextResponse.redirect(`${appUrl}${pathname}`);
    }
  }

  // On app domain, block landing-only routes → redirect to landing or dashboard
  if (isAppDomain(hostname)) {
    // Root on app domain → go to dashboard
    if (pathname === '/') {
      return NextResponse.redirect(`${appUrl}/dashboard`);
    }

    const isLandingRoute = LANDING_ONLY_ROUTES.some(
      (route) => route !== '/' && (pathname === route || pathname.startsWith(route + '/'))
    );
    if (isLandingRoute) {
      return NextResponse.redirect(`${landingUrl}${pathname}`);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

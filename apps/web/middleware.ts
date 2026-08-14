import { NextResponse, type NextRequest } from 'next/server';

// Inlined (not imported from lib/api-server) to keep the middleware free of
// server-only modules like next/headers.
const SESSION_COOKIE_NAME = 'arqueia_session';
const LOGIN_PATH = '/login';

export function middleware(request: NextRequest): NextResponse {
  const hasSession = request.cookies.has(SESSION_COOKIE_NAME);
  const { pathname, search } = request.nextUrl;
  const isLoginRoute = pathname === LOGIN_PATH;

  if (!hasSession && !isLoginRoute) {
    const url = request.nextUrl.clone();
    url.pathname = LOGIN_PATH;
    url.search = '';
    url.searchParams.set('next', `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  if (hasSession && isLoginRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Gate every page except API routes (they guard themselves), Next internals,
  // and static PWA assets.
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|icons|brand|manifest.webmanifest|sw.js).*)',
  ],
};

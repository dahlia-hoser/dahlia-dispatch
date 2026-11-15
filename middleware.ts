// Two locks:
// 1. The whole site, while it's a beta: the browser asks for a password (SITE_PASSWORD). Any user name works.
// 2. The owner's tools under /admin: a sign-in page (ADMIN_PASSWORD). Beta testers never see these.
import { NextResponse, type NextRequest } from 'next/server';
import { ADMIN_COOKIE, isAdminCookie } from './lib/admin-auth';

export async function middleware(req: NextRequest) {
  const password = process.env.SITE_PASSWORD;
  if (password) {
    const header = req.headers.get('authorization') ?? '';
    let ok = false;
    if (header.startsWith('Basic ')) {
      try {
        const [, given] = atob(header.slice(6)).split(/:(.*)/s);
        ok = given === password;
      } catch {}
    }
    if (!ok) {
      return new NextResponse('Password needed.', {
        status: 401,
        headers: { 'WWW-Authenticate': 'Basic realm="Dahlia Dispatch beta", charset="UTF-8"', 'X-Robots-Tag': 'noindex, nofollow' },
      });
    }
  }

  const path = req.nextUrl.pathname;
  if (path.startsWith('/admin') && path !== '/admin/login') {
    if (!(await isAdminCookie(req.cookies.get(ADMIN_COOKIE)?.value))) {
      const url = req.nextUrl.clone();
      url.pathname = '/admin/login';
      url.search = `?next=${encodeURIComponent(path)}`;
      return NextResponse.redirect(url);
    }
  }
  return NextResponse.next();
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };

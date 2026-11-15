// Password for the whole site while it's a private test.
// The browser asks for a user name and password: any user name works, the password is SITE_PASSWORD.
import { NextResponse, type NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const password = process.env.SITE_PASSWORD;
  if (!password) return NextResponse.next(); // no password set (e.g. on your own computer)
  const header = req.headers.get('authorization') ?? '';
  if (header.startsWith('Basic ')) {
    try {
      const [, given] = atob(header.slice(6)).split(/:(.*)/s);
      if (given === password) return NextResponse.next();
    } catch {}
  }
  return new NextResponse('Password needed.', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Dahlia Dispatch beta", charset="UTF-8"', 'X-Robots-Tag': 'noindex, nofollow' },
  });
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };

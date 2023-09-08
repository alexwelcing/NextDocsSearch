import { NextRequest, NextResponse } from 'next/server';

function getCookieValue(cookieHeader: string | null, name: string): string | null {
    if (!cookieHeader) return null;
    const matches = cookieHeader.match(`(^|;)\\s*${name}\\s*=\\s*([^;]+)`);
    return matches ? matches.pop()! : null;
  }

export function onRequest(req: NextRequest): NextResponse | void {
  // Get the cookies from the header
  const cookiesHeader = req.headers.get('Cookie');
  const variantCookie = getCookieValue(cookiesHeader, 'ab-test-variant');

  if (variantCookie) {
    // If the cookie exists, route based on its value
    if (variantCookie === 'A') {
      return NextResponse.rewrite('/');
    } else if (variantCookie === 'B') {
      return NextResponse.rewrite('/chat');
    }
  } else {
    // If the cookie doesn't exist, assign a variant randomly and set the cookie
    if (Math.random() < 0.5) {
      // Assign to group A and set a cookie
      const response = NextResponse.rewrite('/');
      response.headers.set('Set-Cookie', 'ab-test-variant=A; Path=/; Max-Age=2592000'); // Max-Age set to 30 days
      return response;
    } else {
      // Assign to group B and set a cookie
      const response = NextResponse.rewrite('/chat');
      response.headers.set('Set-Cookie', 'ab-test-variant=B; Path=/; Max-Age=2592000'); // Max-Age set to 30 days
      return response;
    }
  }
}

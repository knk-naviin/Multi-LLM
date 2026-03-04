import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const TOKEN_COOKIE = "swastik_token";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/settings")) {
    const token = request.cookies.get(TOKEN_COOKIE)?.value;

    if (!token) {
      const url = request.nextUrl.clone();
      url.pathname = "/chat";
      url.searchParams.set("authRequired", "1");
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/settings/:path*"],
};

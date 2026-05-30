import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const uid = request.cookies.get("uid")?.value;
  console.log(uid);

  if (request.nextUrl.pathname === "/login") {
    if (!uid) return;
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  if (!uid) return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: [
    "/login/:path*",
    "/messages/:path*",
    "/resources/:path*",
    "/settings/:path*",
    "/dashboard/:path*",
    "/appointments/:path*",
  ],
};

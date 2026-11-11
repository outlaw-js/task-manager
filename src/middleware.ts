import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

const PUBLIC_PAGES = ["/login", "/register"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const userId = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  const isPublicPage = PUBLIC_PAGES.includes(pathname);

  if (pathname.startsWith("/api/")) {
    if (pathname.startsWith("/api/auth/") || userId) return NextResponse.next();
    return NextResponse.json({ error: "ابتدا وارد شوید" }, { status: 401 });
  }

  if (!userId && !isPublicPage) {
    const url = new URL("/login", req.url);
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if (userId && isPublicPage) return NextResponse.redirect(new URL("/", req.url));
  return NextResponse.next();
}

export const config = {
  // Static assets, the PWA manifest and the service worker must load without a session.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|.*\\.(?:png|svg|ico|woff2?)$).*)"],
};

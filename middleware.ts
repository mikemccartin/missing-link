import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { detectAICrawler, logCrawlerVisit } from "./lib/redis";

export async function middleware(request: NextRequest) {
  const userAgent = request.headers.get("user-agent") || "";
  const path = request.nextUrl.pathname;

  // Check if this is an AI crawler
  const crawler = detectAICrawler(userAgent);

  if (crawler) {
    // Log the visit asynchronously (don't block the response)
    logCrawlerVisit(crawler.name, crawler.org, path).catch((err) => {
      console.error("Failed to log crawler visit:", err);
    });
  }

  return NextResponse.next();
}

// Run middleware on all pages (not static assets)
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};

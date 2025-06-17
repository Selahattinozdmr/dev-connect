import { NextRequest, NextResponse } from "next/server";

/**
 * Simple edge-compatible logger for middleware
 * Avoids using Node.js modules that aren't available in Edge Runtime
 */
const edgeLogger = {
  log: (
    level: string,
    message: string,
    data?: Record<string, unknown>
  ): void => {
    console.log(
      JSON.stringify({
        level,
        message,
        ...data,
        timestamp: new Date().toISOString(),
        service: "dev-connect-edge",
      })
    );
  },
  http: (message: string, data?: Record<string, unknown>): void => {
    edgeLogger.log("http", message, data);
  },
};

/**
 * Combined middleware that handles logging for API requests
 * Edge Runtime compatible version
 *
 * @param request - The incoming Next.js request
 * @returns The response after middleware processing
 */
export function middleware(request: NextRequest): NextResponse {
  // Only handle logging for API routes
  if (request.nextUrl.pathname.startsWith("/api")) {
    const startTime = performance.now();
    const requestId = crypto.randomUUID();

    // Log the incoming request with edge-compatible logger
    edgeLogger.http(`Incoming ${request.method} request`, {
      requestId,
      url: request.url,
      path: request.nextUrl.pathname,
      query: Object.fromEntries(request.nextUrl.searchParams),
      headers: {
        userAgent: request.headers.get("user-agent"),
        contentType: request.headers.get("content-type"),
      },
    });

    // Create the response
    const response = NextResponse.next();

    // Add request ID and start time to response headers for correlation
    response.headers.set("X-Request-Id", requestId);
    response.headers.set("X-Request-Start-Time", startTime.toString());

    // Log request completion (approximation, as we can't log after processing)
    const duration = performance.now() - startTime;
    edgeLogger.http(`Request processed in middleware`, {
      requestId,
      path: request.nextUrl.pathname,
      duration: `${duration.toFixed(2)}ms`,
    });

    return response;
  }

  // For non-API routes, just continue the request
  return NextResponse.next();
}

/**
 * Configure which paths the middleware should run on
 */
export const config = {
  matcher: ["/api/:path*"],
};

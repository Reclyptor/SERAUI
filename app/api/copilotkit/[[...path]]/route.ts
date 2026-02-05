import { NextRequest, NextResponse } from "next/server";

const SERA_API_URL = process.env.SERA_API_URL ?? "http://localhost:3001";

async function proxyRequest(request: NextRequest, method: string) {
  // Get the path segments after /api/copilotkit/
  const url = new URL(request.url);
  const pathSegments = url.pathname.replace(/^\/api\/copilotkit\/?/, "");
  const targetUrl = `${SERA_API_URL}/copilotkit/${pathSegments}${url.search}`;

  // Forward cookies for session-based auth - backend validates against Authentik
  const headers = new Headers();
  const cookies = request.headers.get("cookie");
  if (cookies) {
    headers.set("Cookie", cookies);
  }
  
  // Copy content-type if present
  const contentType = request.headers.get("content-type");
  if (contentType) {
    headers.set("Content-Type", contentType);
  }

  // Copy accept header if present
  const accept = request.headers.get("accept");
  if (accept) {
    headers.set("Accept", accept);
  }

  const fetchOptions: RequestInit = {
    method,
    headers,
  };

  // Forward body for POST/PUT/PATCH
  if (method !== "GET" && method !== "HEAD") {
    // For streaming requests, we need to pass the body as-is
    fetchOptions.body = request.body;
    // @ts-expect-error - duplex is required for streaming but not in types
    fetchOptions.duplex = "half";
  }

  try {
    const response = await fetch(targetUrl, fetchOptions);

    // For streaming responses, return as-is
    if (response.headers.get("content-type")?.includes("text/event-stream")) {
      return new Response(response.body, {
        status: response.status,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    }

    // For JSON responses
    const data = await response.text();
    return new Response(data, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("content-type") ?? "application/json",
      },
    });
  } catch (error) {
    console.error("[CopilotKit Proxy] Error:", error);
    return NextResponse.json(
      { error: "Proxy error", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 502 }
    );
  }
}

export async function GET(request: NextRequest) {
  return proxyRequest(request, "GET");
}

export async function POST(request: NextRequest) {
  return proxyRequest(request, "POST");
}

export async function PUT(request: NextRequest) {
  return proxyRequest(request, "PUT");
}

export async function PATCH(request: NextRequest) {
  return proxyRequest(request, "PATCH");
}

export async function DELETE(request: NextRequest) {
  return proxyRequest(request, "DELETE");
}

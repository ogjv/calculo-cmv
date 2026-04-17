const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;

const allowedPathPrefixes = ["/auth/v1", "/rest/v1", "/storage/v1", "/realtime/v1"];
const forwardedRequestHeaders = new Set([
  "accept",
  "apikey",
  "authorization",
  "content-type",
  "prefer",
  "range",
  "x-client-info"
]);
const forwardedResponseHeaders = new Set(["cache-control", "content-range", "content-type", "location", "range-unit"]);

const corsHeaders = (origin) => ({
  "access-control-allow-origin": origin || "*",
  "access-control-allow-headers": "authorization, apikey, content-type, prefer, range, x-client-info",
  "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "access-control-max-age": "86400"
});

const isTextResponse = (contentType) =>
  !contentType ||
  contentType.includes("application/json") ||
  contentType.includes("text/") ||
  contentType.includes("application/xml") ||
  contentType.includes("application/x-www-form-urlencoded");

export const handler = async (event) => {
  const origin = event.headers.origin || event.headers.Origin;

  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: corsHeaders(origin),
      body: ""
    };
  }

  if (!SUPABASE_URL) {
    return {
      statusCode: 500,
      headers: { ...corsHeaders(origin), "content-type": "application/json" },
      body: JSON.stringify({ message: "Supabase URL is not configured." })
    };
  }

  const target = event.queryStringParameters?.target || "";
  if (!allowedPathPrefixes.some((prefix) => target.startsWith(prefix))) {
    return {
      statusCode: 400,
      headers: { ...corsHeaders(origin), "content-type": "application/json" },
      body: JSON.stringify({ message: "Invalid Supabase proxy target." })
    };
  }

  const requestHeaders = {};
  for (const [headerName, headerValue] of Object.entries(event.headers)) {
    const normalizedHeaderName = headerName.toLowerCase();
    if (headerValue && forwardedRequestHeaders.has(normalizedHeaderName)) {
      requestHeaders[normalizedHeaderName] = headerValue;
    }
  }

  const upstream = await fetch(`${SUPABASE_URL}${target}`, {
    method: event.httpMethod,
    headers: requestHeaders,
    body: event.body
      ? event.isBase64Encoded
        ? Buffer.from(event.body, "base64")
        : event.body
      : undefined
  });

  const responseHeaders = { ...corsHeaders(origin) };
  upstream.headers.forEach((value, key) => {
    if (forwardedResponseHeaders.has(key.toLowerCase())) {
      responseHeaders[key] = value;
    }
  });

  const contentType = upstream.headers.get("content-type") || "";
  const responseBuffer = Buffer.from(await upstream.arrayBuffer());
  const shouldReturnText = isTextResponse(contentType);

  return {
    statusCode: upstream.status,
    headers: responseHeaders,
    body: shouldReturnText ? responseBuffer.toString("utf8") : responseBuffer.toString("base64"),
    isBase64Encoded: !shouldReturnText
  };
};

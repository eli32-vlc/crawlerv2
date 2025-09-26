// /api/proxy.js
export const config = { runtime: "edge" };

const DEFAULT_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36";

function validateUrl(url) {
  try {
    const u = new URL(url);
    if (!["http:", "https:"].includes(u.protocol)) return false;
    // OPTIONAL: restrict hostnames:
    // const ALLOWED = ["example.com", "api.example.org"];
    // if (ALLOWED.length && !ALLOWED.includes(u.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

export default async function handler(req) {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Use POST with JSON { url: string }" }), {
      status: 405,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  let url;
  try {
    const body = await req.json();
    url = body?.url;
  } catch {
    return new Response(JSON.stringify({ error: "Bad JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  if (!validateUrl(url)) {
    return new Response(JSON.stringify({ error: "Invalid URL" }), {
      status: 400,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  // 15s timeout using AbortController
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  const browserHeaders = {
    "User-Agent": DEFAULT_UA,
    // Avoid setting some hop-by-hop headers (Connection, Transfer-Encoding, etc.)
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
  };

  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      method: "GET",
      headers: browserHeaders,
      redirect: "follow",
    });

    // Copy content-type (or default)
    const contentType = resp.headers.get("content-type") ?? "application/octet-stream";
    const headers = new Headers();
    headers.set("Content-Type", contentType);
    headers.set("x-proxy-source", "vercel-edge-proxy");
    headers.set("Access-Control-Allow-Origin", "*");
    // If you want the client to see other headers, you can forward selective ones here.

    // Stream body through
    return new Response(resp.body, {
      status: resp.status,
      headers,
    });
  } catch (err) {
    const message = err.name === "AbortError" ? "Request timed out" : `Failed to fetch target: ${err.message || err}`;
    return new Response(JSON.stringify({ error: message }), {
      status: 502,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

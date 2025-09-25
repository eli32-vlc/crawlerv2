export default async function fetch(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const targetUrl = searchParams.get("url");
  if (!targetUrl) {
    return new Response(
      JSON.stringify({ error: "Missing 'url' query parameter." }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  }

  // Basic validation to prevent SSRF
  try {
    const parsed = new URL(targetUrl);
    if (!/^https?:$/.test(parsed.protocol)) {
      throw new Error("Only http(s) protocols are supported.");
    }
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid URL provided." }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  }

  const browserHeaders = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept":
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    // Don't set Accept-Encoding when using fetch in some runtimes (they do compression handling)
  };

  try {
    const resp = await fetch(targetUrl, {
      method: "GET",
      headers: browserHeaders,
    });

    // Copy response headers and add CORS
    const proxiedHeaders = new Headers(resp.headers);
    proxiedHeaders.set("Access-Control-Allow-Origin", "*");
    // Only override Content-Type if not present to preserve original content type
    if (!proxiedHeaders.has("Content-Type")) {
      proxiedHeaders.set("Content-Type", "text/html; charset=UTF-8");
    }

    return new Response(resp.body, {
      status: resp.status,
      headers: proxiedHeaders,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(
      JSON.stringify({ error: "Failed to fetch target: " + msg }),
      {
        status: 502,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  }
}

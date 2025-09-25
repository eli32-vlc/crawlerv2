export default async function handler(reqOrEvent: Request | { request?: Request; url?: string } | undefined): Promise<Response> {
  // Diagnostic logging to help identify what the runtime passes
  try {
    console.log("handler called with type:", typeof reqOrEvent, "keys:", reqOrEvent && Object.keys(reqOrEvent as any));
  } catch (_) {}

  // Normalize to a Request object or extract a URL string
  let req: Request | undefined;
  let urlStr: string | undefined;

  if (reqOrEvent instanceof Request) {
    req = reqOrEvent;
    urlStr = req.url;
  } else if (reqOrEvent && typeof (reqOrEvent as any).request === "object" && (reqOrEvent as any).request instanceof Request) {
    req = (reqOrEvent as any).request;
    urlStr = req.url;
  } else if (reqOrEvent && typeof (reqOrEvent as any).url === "string") {
    urlStr = (reqOrEvent as any).url;
  }

  if (!urlStr) {
    // If there was no URL available, return 400 with helpful debug
    const details = {
      error: "No URL available to construct new URL().",
      receivedType: typeof reqOrEvent,
      sampleKeys: reqOrEvent ? Object.keys(reqOrEvent as any) : [],
    };
    return new Response(JSON.stringify(details), {
      status: 400,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  // Now safe to construct a URL
  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch (e) {
    return new Response(JSON.stringify({ error: "Invalid URL provided.", detail: String(e) }), {
      status: 400,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  // Example flow: treat query param 'url' on incoming request (if we have a Request)
  // or proxy the parsed URL directly.
  try {
    // If a Request object exists, prefer query param ?url=... so old behaviour works:
    if (req) {
      const sp = new URL(req.url).searchParams;
      const targetUrl = sp.get("url") ?? parsed.href;
      // Basic validation
      const t = new URL(targetUrl);
      if (!/^https?:$/.test(t.protocol)) throw new Error("Only http(s) protocols are supported.");

      // Fetch target
      const browserHeaders = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      };

      const resp = await fetch(targetUrl, { method: "GET", headers: browserHeaders });

      const proxiedHeaders = new Headers(resp.headers);
      proxiedHeaders.set("Access-Control-Allow-Origin", "*");
      if (!proxiedHeaders.has("Content-Type")) proxiedHeaders.set("Content-Type", "text/html; charset=UTF-8");

      return new Response(resp.body, { status: resp.status, headers: proxiedHeaders });
    } else {
      // No Request object, just return the parsed URL as confirmation (adapt to your needs)
      return new Response(JSON.stringify({ ok: true, url: parsed.href }), {
        status: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: "Failed: " + msg }), {
      status: 502,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
}

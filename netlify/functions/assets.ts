import { Handler } from "@netlify/functions";

export const handler: Handler = async (event) => {
  try {
    const path = event.path;
    console.log("[Assets Proxy] Request Path:", path);

    // Matches /api/assets/bucket-name/file-path or /.netlify/functions/assets/bucket-name/file-path
    const match = path.match(/\/(?:api\/assets|\.netlify\/functions\/assets)\/([^\/]+)\/(.+)/);
    if (!match) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Invalid assets path format" }),
      };
    }

    const bucket = match[1];
    const filePath = match[2];

    const supUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    if (!supUrl) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Database/Supabase configuration is missing in Environment." }),
      };
    }

    // Sanitizing base Supabase URL to prevent double slashes
    const cleanSupUrl = supUrl.replace(/\/$/, "");

    // Safely decode and re-encode each file path segment to support spaces, Korean, and special characters
    const safeFilePath = filePath.split('/')
      .map(seg => encodeURIComponent(decodeURIComponent(seg)))
      .join('/');

    const queryParams = event.queryStringParameters || {};

    // Image resizing: when width/height are requested, serve through Supabase's
    // image transformation endpoint so lists can fetch right-sized thumbnails
    // instead of full-resolution originals.
    const width = parseInt(String(queryParams.width || ""), 10);
    const height = parseInt(String(queryParams.height || ""), 10);
    const quality = parseInt(String(queryParams.quality || ""), 10);
    const resize = String(queryParams.resize || "");

    if ((Number.isFinite(width) && width > 0) || (Number.isFinite(height) && height > 0)) {
      const transformParams = new URLSearchParams();
      if (Number.isFinite(width) && width > 0) transformParams.set("width", String(Math.min(width, 2560)));
      if (Number.isFinite(height) && height > 0) transformParams.set("height", String(Math.min(height, 2560)));
      transformParams.set("quality", String(Number.isFinite(quality) ? Math.min(100, Math.max(20, quality)) : 75));
      if (["cover", "contain", "fill"].includes(resize)) transformParams.set("resize", resize);

      const renderUrl = `${cleanSupUrl}/storage/v1/render/image/public/${bucket}/${safeFilePath}?${transformParams.toString()}`;
      return {
        statusCode: 302,
        headers: { "Location": renderUrl, "Cache-Control": "no-cache" },
        body: "",
      };
    }

    // Preserve query parameters (e.g. cache busting)
    let queryStr = "";
    if (Object.keys(queryParams).length > 0) {
      const sp = new URLSearchParams();
      for (const [key, val] of Object.entries(queryParams)) {
        if (val !== undefined && val !== null) {
          sp.append(key, val);
        }
      }
      const qs = sp.toString();
      if (qs) queryStr = `?${qs}`;
    }

    const targetUrl = `${cleanSupUrl}/storage/v1/object/public/${bucket}/${safeFilePath}${queryStr}`;
    console.log("[Assets Proxy] Redirecting to:", targetUrl);

    return {
      statusCode: 302,
      headers: {
        "Location": targetUrl,
        "Cache-Control": "no-cache",
      },
      body: "",
    };
  } catch (error: any) {
    console.error("[Assets Proxy] Serverless Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || "Internal assets gateway failure" }),
    };
  }
};

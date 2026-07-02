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

    // Preserve query parameters (e.g. cache busting or resizing options)
    const queryParams = event.queryStringParameters;
    let queryStr = "";
    if (queryParams && Object.keys(queryParams).length > 0) {
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

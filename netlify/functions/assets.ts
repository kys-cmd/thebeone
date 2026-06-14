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

    const targetUrl = `${supUrl}/storage/v1/object/public/${bucket}/${filePath}`;
    console.log("[Assets Proxy] Redirecting to:", targetUrl);

    const response = await fetch(targetUrl);
    if (!response.ok) {
      return {
        statusCode: response.status,
        body: "Asset not found in storage",
      };
    }

    const contentType = response.headers.get("content-type") || "application/octet-stream";
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
      body: buffer.toString("base64"),
      isBase64Encoded: true,
    };
  } catch (error: any) {
    console.error("[Assets Proxy] Serverless Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || "Internal assets gateway failure" }),
    };
  }
};

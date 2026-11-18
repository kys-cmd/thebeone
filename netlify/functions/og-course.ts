import { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import {
  fetchCourseOgMeta,
  getRequestOrigin,
  injectOgTagsIntoHtml,
} from "../../src/server/courseOgHelper";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  "";

const supabaseClient =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })
    : null;

let cachedIndexHtml: { html: string; fetchedAt: number } | null = null;
const INDEX_CACHE_TTL_MS = 60 * 1000;

async function loadIndexHtml(origin: string): Promise<string> {
  const now = Date.now();
  if (cachedIndexHtml && now - cachedIndexHtml.fetchedAt < INDEX_CACHE_TTL_MS) {
    return cachedIndexHtml.html;
  }

  const res = await fetch(`${origin.replace(/\/$/, "")}/index.html`, {
    headers: { Accept: "text/html" },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch base index.html (${res.status})`);
  }
  const html = await res.text();
  cachedIndexHtml = { html, fetchedAt: now };
  return html;
}

export const handler: Handler = async (event) => {
  const origin = getRequestOrigin(event.headers || {});
  const queryId = String(event.queryStringParameters?.id || "").trim();
  const pathMatch = String(event.path || "").match(/\/course\/([^/]+)/);
  const courseId = decodeURIComponent(queryId || pathMatch?.[1] || "").trim();
  const requestPath = courseId ? `/course/${courseId}` : event.path || "/";

  try {
    const baseHtml = await loadIndexHtml(origin);
    if (!courseId || !supabaseClient) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
        body: baseHtml,
      };
    }

    const ogMeta = await fetchCourseOgMeta({
      supabaseAdmin: supabaseClient,
      courseId,
      origin,
      requestPath,
      supabaseUrl,
    });

    const finalHtml = ogMeta ? injectOgTagsIntoHtml(baseHtml, ogMeta) : baseHtml;

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      },
      body: finalHtml,
    };
  } catch (err: any) {
    console.error("[og-course] Error serving course OG metadata:", err?.message || err);
    return {
      statusCode: 302,
      headers: {
        Location: `${origin}/index.html`,
      },
      body: "",
    };
  }
};

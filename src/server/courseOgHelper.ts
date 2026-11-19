import { SupabaseClient } from "@supabase/supabase-js";

export interface ResolvedCourseOgMeta {
  title: string;
  description: string;
  imageUrl: string | null;
  url: string;
  siteName: string;
  categoryLabel?: string;
}

const SITE_NAME = "비원아카데미: Beone";
const DEFAULT_DESCRIPTION = "정규강의, 특강, 그리고 강력한 커뮤니티가 결합된 비원아카데미입니다.";

export function escapeHtmlText(value: string): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getCategoryLabel(category?: string | null): string {
  switch (category) {
    case "regular":
      return "정규강의";
    case "special_online":
      return "온라인 특강";
    case "special_offline":
      return "오프라인 특강";
    case "special":
      return "특강";
    case "beone_exclusive_online":
      return "온라인 전용";
    case "beone_exclusive_offline":
      return "오프라인 전용";
    case "beone_exclusive":
      return "비원 전용";
    case "live":
      return "라이브";
    default:
      return "강의";
  }
}

function encodeStoragePath(filePath: string): string {
  return filePath
    .split("/")
    .map((seg) => {
      try {
        return encodeURIComponent(decodeURIComponent(seg));
      } catch {
        return encodeURIComponent(seg);
      }
    })
    .join("/");
}

/**
 * Resolve any stored course image path (/api/assets/..., relative path, external HTTPS URL)
 * into a crawler-safe absolute HTTPS URL.
 * Skips data:/blob: URIs because blog/SNS crawlers cannot fetch inline URIs as og:image.
 */
export function resolvePublicOgImageUrl(
  rawUrl: string | null | undefined,
  options: { origin: string; supabaseUrl?: string | null }
): string | null {
  const trimmed = String(rawUrl || "").trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("data:") || trimmed.startsWith("blob:")) return null;

  const cleanOrigin = String(options.origin || "").replace(/\/$/, "");
  const cleanSupUrl = String(options.supabaseUrl || "").trim().replace(/\/$/, "");

  // Handle /api/assets/:bucket/:filePath (or full URL containing /api/assets/)
  const assetsMatch = trimmed.match(/^(?:https?:\/\/[^/]+)?\/api\/assets\/([^/]+)\/([^?#]+)(?:\?[^#]*)?/i);
  if (assetsMatch) {
    const bucket = assetsMatch[1];
    const filePath = assetsMatch[2];
    if (cleanSupUrl) {
      return `${cleanSupUrl}/storage/v1/object/public/${bucket}/${encodeStoragePath(filePath)}`;
    }
    if (cleanOrigin) {
      return `${cleanOrigin}/api/assets/${bucket}/${encodeStoragePath(filePath)}`;
    }
    return null;
  }

  if (trimmed.startsWith("//")) {
    return `https:${trimmed}`;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith("/") && cleanOrigin) {
    return `${cleanOrigin}${trimmed}`;
  }

  return null;
}

export function extractCourseBestImageCandidate(
  course: any,
  options: { origin: string; supabaseUrl?: string | null }
): string | null {
  if (!course || typeof course !== "object") return null;

  const candidates: Array<string | null | undefined> = [
    course.thumbnail,
    course.hero_image,
  ];

  // Fallback to first image block inside layout.blocks if thumbnail/hero_image is absent or unusable
  try {
    const layoutObj =
      typeof course.layout === "string" ? JSON.parse(course.layout) : course.layout;
    const blocks = Array.isArray(layoutObj?.blocks) ? layoutObj.blocks : [];
    for (const block of blocks) {
      if (block?.type === "image" && typeof block?.content === "string") {
        candidates.push(block.content);
      }
    }
  } catch {
    // ignore malformed layout json
  }

  for (const candidate of candidates) {
    const resolved = resolvePublicOgImageUrl(candidate, options);
    if (resolved) return resolved;
  }

  return null;
}

export async function fetchCourseOgMeta(params: {
  supabaseAdmin: SupabaseClient | null;
  courseId: string;
  origin: string;
  requestPath: string;
  supabaseUrl?: string | null;
}): Promise<ResolvedCourseOgMeta | null> {
  const { supabaseAdmin, courseId, origin, requestPath, supabaseUrl } = params;
  if (!supabaseAdmin || !courseId) return null;

  const cleanOrigin = origin.replace(/\/$/, "");
  const cleanPath = requestPath.startsWith("/") ? requestPath : `/${requestPath}`;
  const canonicalUrl = `${cleanOrigin}${cleanPath}`;

  try {
    const { data: course, error } = await supabaseAdmin
      .from("courses")
      .select("id, title, description, thumbnail, hero_image, category, instructor, layout, is_deleted")
      .eq("id", courseId)
      .maybeSingle();

    if (error || !course || course.is_deleted) {
      return null;
    }

    const catLabel = getCategoryLabel(course.category);
    const instructorText = course.instructor ? `${course.instructor} 강사` : "";
    const title = course.title ? `${course.title} | ${SITE_NAME}` : SITE_NAME;

    const rawDesc = String(course.description || "").replace(/\s+/g, " ").trim();
    const fallbackDesc = [catLabel, instructorText, DEFAULT_DESCRIPTION]
      .filter(Boolean)
      .join(" · ");
    const description = (rawDesc || fallbackDesc).slice(0, 200);

    const supUrl =
      supabaseUrl ||
      process.env.SUPABASE_URL ||
      process.env.VITE_SUPABASE_URL ||
      "";

    const imageUrl = extractCourseBestImageCandidate(course, {
      origin: cleanOrigin,
      supabaseUrl: supUrl,
    });

    return {
      title,
      description,
      imageUrl,
      url: canonicalUrl,
      siteName: SITE_NAME,
      categoryLabel: catLabel,
    };
  } catch (err) {
    console.warn("[courseOgHelper] Failed fetching course OG meta:", err);
    return null;
  }
}

export function injectOgTagsIntoHtml(
  htmlTemplate: string,
  meta: ResolvedCourseOgMeta
): string {
  const safeTitle = escapeHtmlText(meta.title);
  const safeDesc = escapeHtmlText(meta.description);
  const safeSiteName = escapeHtmlText(meta.siteName);
  const safeUrl = escapeHtmlText(meta.url);
  const safeImage = meta.imageUrl ? escapeHtmlText(meta.imageUrl) : "";

  let html = htmlTemplate;

  // Keep browser <title> fixed to site name while og:title carries course title for link previews
  if (/<title[^>]*>[\s\S]*?<\/title>/i.test(html)) {
    html = html.replace(/<title[^>]*>[\s\S]*?<\/title>/i, `<title>${safeSiteName}</title>`);
  }

  // Strip existing description / og:* / twitter:* / canonical tags to avoid duplicates
  html = html
    .replace(/<meta[^>]*name=["']description["'][^>]*>\s*/gi, "")
    .replace(/<meta[^>]*property=["']og:[^"']+["'][^>]*>\s*/gi, "")
    .replace(/<meta[^>]*name=["']twitter:[^"']+["'][^>]*>\s*/gi, "")
    .replace(/<link[^>]*rel=["']canonical["'][^>]*>\s*/gi, "");

  const ogTags = [
    `    <meta name="description" content="${safeDesc}" />`,
    `    <link rel="canonical" href="${safeUrl}" />`,
    `    <meta property="og:type" content="website" />`,
    `    <meta property="og:site_name" content="${safeSiteName}" />`,
    `    <meta property="og:title" content="${safeTitle}" />`,
    `    <meta property="og:description" content="${safeDesc}" />`,
    `    <meta property="og:url" content="${safeUrl}" />`,
  ];

  if (safeImage) {
    ogTags.push(`    <meta property="og:image" content="${safeImage}" />`);
    if (safeImage.startsWith("https://")) {
      ogTags.push(`    <meta property="og:image:secure_url" content="${safeImage}" />`);
    }
    ogTags.push(`    <meta property="og:image:alt" content="${safeTitle}" />`);
  }

  ogTags.push(
    `    <meta name="twitter:card" content="${safeImage ? "summary_large_image" : "summary"}" />`,
    `    <meta name="twitter:title" content="${safeTitle}" />`,
    `    <meta name="twitter:description" content="${safeDesc}" />`
  );

  if (safeImage) {
    ogTags.push(`    <meta name="twitter:image" content="${safeImage}" />`);
  }

  const injectedBlock = `${ogTags.join("\n")}\n  </head>`;
  return html.replace(/<\/head>/i, injectedBlock);
}

export function getRequestOrigin(headers: Record<string, any>, fallbackHost?: string): string {
  const xfProto = String(headers["x-forwarded-proto"] || "").split(",")[0].trim();
  const xfHost = String(headers["x-forwarded-host"] || headers["host"] || fallbackHost || "").split(",")[0].trim();
  const proto = xfProto || (xfHost.includes("localhost") || xfHost.startsWith("127.0.0.1") ? "http" : "https");
  if (!xfHost) return process.env.APP_URL || "";
  return `${proto}://${xfHost}`;
}

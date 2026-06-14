import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Replaces any Supabase storage URL with the local relative proxy URL
 * to simplify all URLs and mask/hide any references to Supabase.
 */
export function cleanUrl(url: string | undefined | null): string {
  if (!url) return '';
  // Format: https://[project-id].supabase.co/storage/v1/object/public/[bucket]/[path]
  // Target format: /api/assets/[bucket]/[path]
  const pattern = /https:\/\/[a-zA-Z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\/([a-zA-Z0-9-_]+)\//;
  return url.replace(pattern, '/api/assets/$1/');
}

/**
 * Replaces all occurrences of Supabase storage CDN URLs in HTML content
 * with the local relative proxy URL, ensuring images embedded in posts or notices
 * have their "supabase" keyword completely hidden.
 */
export function cleanHtmlContent(html: string | undefined | null): string {
  if (!html) return '';
  const regex = /https:\/\/[a-zA-Z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\/([a-zA-Z0-9-_]+)\//g;
  return html.replace(regex, '/api/assets/$1/');
}

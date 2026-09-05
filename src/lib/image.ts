/**
 * 커뮤니티 게시글 이미지 최적화 헬퍼.
 *
 * 업로드된 이미지는 `/api/assets/<bucket>/<path>` 형태의 프록시 주소로 저장된다.
 * 이 주소에 width/height/quality 쿼리를 붙이면 서버(server.ts)가 Supabase의
 * 이미지 변환 엔드포인트로 리다이렉트해 리사이즈된 결과를 돌려준다.
 *
 * 외부 URL이나 data: URL 처럼 변환할 수 없는 주소는 그대로 사용한다.
 */

const ASSET_PREFIX = '/api/assets/';

export interface ImageTransformOptions {
  width?: number;
  height?: number;
  /** 1-100. 기본 75 */
  quality?: number;
  resize?: 'cover' | 'contain' | 'fill';
}

/** 목록/썸네일에서 자주 쓰는 폭 프리셋 */
export const IMAGE_WIDTHS = {
  thumb: 160,
  card: 400,
  grid: 640,
  full: 1280,
} as const;

/** 프록시를 통해 서빙되는(=변환 가능한) 이미지인지 판별 */
export function isTransformableAsset(url?: string | null): boolean {
  if (!url) return false;
  if (url.startsWith('data:') || url.startsWith('blob:')) return false;
  return url.startsWith(ASSET_PREFIX);
}

/**
 * 이미지 주소에 리사이즈 파라미터를 붙여 반환한다.
 * 변환이 불가능한 주소는 원본을 그대로 돌려준다.
 */
export function getOptimizedImageUrl(url?: string | null, options: ImageTransformOptions = {}): string {
  if (!url) return '';
  if (!isTransformableAsset(url)) return url;

  const { width, height, quality = 75, resize = 'cover' } = options;
  if (!width && !height) return url;

  const params = new URLSearchParams();
  if (width) params.set('width', String(Math.round(width)));
  if (height) params.set('height', String(Math.round(height)));
  params.set('quality', String(Math.min(100, Math.max(20, Math.round(quality)))));
  params.set('resize', resize);

  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}${params.toString()}`;
}

/**
 * 고해상도(레티나) 디스플레이까지 커버하는 srcSet 문자열을 만든다.
 * 변환할 수 없는 주소면 undefined를 반환해 <img>가 src만 쓰도록 한다.
 */
export function buildImageSrcSet(
  url?: string | null,
  widths: number[] = [],
  options: Omit<ImageTransformOptions, 'width'> = {}
): string | undefined {
  if (!isTransformableAsset(url) || widths.length === 0) return undefined;

  const unique = [...new Set(widths.map(w => Math.round(w)))].sort((a, b) => a - b);
  return unique
    .map(w => `${getOptimizedImageUrl(url, { ...options, width: w })} ${w}w`)
    .join(', ');
}

/** 이미지 URL 여부를 확장자로 추정 */
export function looksLikeImageUrl(url?: string | null): boolean {
  if (!url) return false;
  if (url.startsWith('data:image/')) return true;
  return /\.(jpe?g|png|gif|webp|avif|bmp|svg)(\?|#|$)/i.test(url);
}

/** 동영상 URL 여부를 확장자로 추정 */
export function looksLikeVideoUrl(url?: string | null): boolean {
  if (!url) return false;
  if (url.startsWith('data:video/')) return true;
  return /\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/i.test(url);
}

/** 주소에서 사람이 읽을 수 있는 파일명을 추출 */
export function getFileNameFromUrl(url?: string | null, fallback = '첨부파일'): string {
  if (!url) return fallback;
  try {
    const raw = url.split('?')[0].split('#')[0].split('/').pop() || fallback;
    return decodeURIComponent(raw);
  } catch {
    return fallback;
  }
}

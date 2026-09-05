import { Post } from '@/types';
import { getFileNameFromUrl, looksLikeImageUrl, looksLikeVideoUrl } from '@/lib/image';

/**
 * 커뮤니티 게시글의 "블록" 모델.
 *
 * 게시글 본문은 하나의 긴 HTML 덩어리가 아니라 순서를 가진 블록 배열로 다룬다.
 * 에디터는 저장 시 content_json.blocks 에 블록 배열을 기록하고,
 * 뷰어는 블록 단위로 렌더링해 스레드 카드 안에서 각 요소가 독립적으로 보이게 한다.
 *
 * 예전 방식(단일 html + image_urls + file_urls)으로 저장된 글도
 * buildPostBlocks() 가 블록 배열로 변환해 주므로 그대로 표시된다.
 */

export type PostBlock =
  | { type: 'richtext'; html: string }
  | { type: 'image'; url: string; alt?: string }
  | { type: 'video'; url: string; name?: string }
  | { type: 'file'; url: string; name?: string; size?: number }
  | { type: 'link'; url: string; title?: string; description?: string; image?: string }
  | { type: 'poll'; question: string; options: string[] }
  | { type: 'attendance'; title: string }
  | { type: 'todo'; title: string; items: string[] };

export interface PostMedia {
  type: 'image' | 'video' | 'file';
  url: string;
  name?: string;
  size?: number;
}

const MEDIA_TAGS = new Set(['IMG', 'VIDEO', 'FIGURE']);

/** 문자열/객체 어느 쪽으로 저장돼 있든 content_json 을 객체로 되돌린다. */
export function parseContentJson(raw: any): any {
  if (!raw) return null;
  if (typeof raw !== 'string') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** TEXT[] 컬럼이 문자열/배열/JSON 문자열 등으로 들어와도 배열로 정규화한다. */
export function parseUrlList(raw: any): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter((u): u is string => typeof u === 'string' && !!u);
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
    } catch {
      /* JSON이 아니면 콤마 구분 문자열로 취급 */
    }
    return raw.split(',').map(u => u.trim()).filter(Boolean);
  }
  return [];
}

/** 위젯 설정(투표/출석/할 일)을 블록으로 변환 */
function widgetToBlock(widget: any): PostBlock | null {
  if (!widget || !widget.type) return null;
  const data = widget.data || {};

  if (widget.type === 'poll') {
    const options = Array.isArray(data.options) ? data.options.filter(Boolean) : [];
    if (options.length === 0) return null;
    return { type: 'poll', question: data.question || '투표', options };
  }
  if (widget.type === 'attendance') {
    return { type: 'attendance', title: data.title || '출석체크' };
  }
  if (widget.type === 'todo') {
    const items = Array.isArray(data.items) ? data.items.filter(Boolean) : [];
    if (items.length === 0) return null;
    return { type: 'todo', title: data.title || '할 일', items };
  }
  return null;
}

/**
 * 에디터 HTML을 최상위 노드 기준으로 훑어 미디어를 독립 블록으로 분리한다.
 * 연속된 일반 문단/제목/목록은 하나의 richtext 블록으로 묶는다.
 */
export function splitHtmlIntoBlocks(html?: string | null): PostBlock[] {
  if (!html || !html.trim()) return [];

  // SSR/테스트 등 DOM이 없는 환경에서는 통짜 블록 하나로 처리
  if (typeof window === 'undefined' || typeof window.DOMParser === 'undefined') {
    return [{ type: 'richtext', html }];
  }

  let body: HTMLElement;
  try {
    body = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html').body;
  } catch {
    return [{ type: 'richtext', html }];
  }

  const blocks: PostBlock[] = [];
  let buffer: string[] = [];

  const flush = () => {
    const merged = buffer.join('').trim();
    buffer = [];
    // 태그만 있고 실제 내용이 없는 빈 문단은 버린다.
    if (merged && merged.replace(/<[^>]*>/g, '').trim().length > 0) {
      blocks.push({ type: 'richtext', html: merged });
    }
  };

  /** 요소가 이미지/비디오 하나만 담고 있는 래퍼인지 확인 */
  const extractSoleMedia = (el: Element): Element | null => {
    if (MEDIA_TAGS.has(el.tagName)) return el.tagName === 'FIGURE' ? el.querySelector('img, video') : el;
    if (el.textContent && el.textContent.trim().length > 0) return null;
    const media = el.querySelectorAll('img, video');
    return media.length === 1 ? media[0] : null;
  };

  Array.from(body.childNodes).forEach(node => {
    if (node.nodeType !== Node.ELEMENT_NODE) {
      const text = node.textContent || '';
      if (text.trim()) buffer.push(`<p>${text}</p>`);
      return;
    }

    const el = node as Element;
    const media = extractSoleMedia(el);

    if (media && media.tagName === 'IMG') {
      const url = media.getAttribute('src');
      if (url) {
        flush();
        blocks.push({ type: 'image', url, alt: media.getAttribute('alt') || undefined });
        return;
      }
    }

    if (media && media.tagName === 'VIDEO') {
      const url = media.getAttribute('src') || media.querySelector('source')?.getAttribute('src');
      if (url) {
        flush();
        blocks.push({ type: 'video', url });
        return;
      }
    }

    buffer.push(el.outerHTML);
  });

  flush();
  return blocks;
}

/** 에디터 상태(본문 HTML + 첨부 + 링크 + 위젯)를 저장용 블록 배열로 만든다. */
export function buildBlocksFromEditorState(params: {
  html: string;
  media: PostMedia[];
  link?: { url: string; title?: string; description?: string; image?: string } | null;
  widget?: { type: string; data: any } | null;
}): PostBlock[] {
  const { html, media, link, widget } = params;

  const blocks = splitHtmlIntoBlocks(html);

  // 본문에 인라인으로 들어가지 않은 첨부만 별도 블록으로 덧붙인다.
  const inlineUrls = new Set(
    blocks
      .filter((b): b is Extract<PostBlock, { type: 'image' | 'video' }> => b.type === 'image' || b.type === 'video')
      .map(b => b.url)
  );

  media.forEach(item => {
    if (item.type !== 'file' && inlineUrls.has(item.url)) return;
    if (item.type === 'image') blocks.push({ type: 'image', url: item.url, alt: item.name });
    else if (item.type === 'video') blocks.push({ type: 'video', url: item.url, name: item.name });
    else blocks.push({ type: 'file', url: item.url, name: item.name, size: item.size });
  });

  if (link?.url) {
    blocks.push({
      type: 'link',
      url: link.url,
      title: link.title,
      description: link.description,
      image: link.image,
    });
  }

  const widgetBlock = widgetToBlock(widget);
  if (widgetBlock) blocks.push(widgetBlock);

  return blocks;
}

/**
 * 게시글을 화면에 그릴 블록 배열로 변환한다.
 * 새로 저장된 글은 content_json.blocks 를 그대로 쓰고,
 * 예전 글은 html/첨부/위젯 필드를 조합해 블록을 만들어 낸다.
 */
export function buildPostBlocks(post: Post): PostBlock[] {
  const content = parseContentJson(post.content_json);

  if (content && Array.isArray(content.blocks) && content.blocks.length > 0) {
    return content.blocks as PostBlock[];
  }

  const html = content?.html || post.content || '';
  const blocks = splitHtmlIntoBlocks(html);

  const seen = new Set(
    blocks
      .filter((b): b is Extract<PostBlock, { type: 'image' | 'video' }> => b.type === 'image' || b.type === 'video')
      .map(b => b.url)
  );

  const legacyMedia: PostMedia[] = Array.isArray(content?.media) ? content.media : [];
  legacyMedia.forEach(m => {
    if (!m?.url || seen.has(m.url)) return;
    seen.add(m.url);
    if (m.type === 'image') blocks.push({ type: 'image', url: m.url, alt: m.name });
    else if (m.type === 'video') blocks.push({ type: 'video', url: m.url, name: m.name });
    else blocks.push({ type: 'file', url: m.url, name: m.name, size: m.size });
  });

  parseUrlList(post.image_urls).forEach(url => {
    if (seen.has(url)) return;
    seen.add(url);
    blocks.push({ type: 'image', url });
  });

  parseUrlList(post.file_urls).forEach(url => {
    if (seen.has(url)) return;
    seen.add(url);
    if (looksLikeImageUrl(url)) blocks.push({ type: 'image', url });
    else if (looksLikeVideoUrl(url)) blocks.push({ type: 'video', url, name: getFileNameFromUrl(url) });
    else blocks.push({ type: 'file', url, name: getFileNameFromUrl(url) });
  });

  if (content?.link?.url) {
    blocks.push({
      type: 'link',
      url: content.link.url,
      title: content.link.title,
      description: content.link.description,
      image: content.link.image,
    });
  }

  const widgetBlock = widgetToBlock(content?.widget);
  if (widgetBlock) blocks.push(widgetBlock);

  return blocks;
}

/** 목록 미리보기용 대표 이미지 (첫 번째 이미지 블록) */
export function getPostCoverImage(post: Post): string | null {
  const fromColumn = parseUrlList(post.image_urls)[0];
  if (fromColumn) return fromColumn;

  const imageBlock = buildPostBlocks(post).find(b => b.type === 'image');
  return imageBlock && imageBlock.type === 'image' ? imageBlock.url : null;
}

/** 게시글 안의 모든 이미지 URL (목록 배지에서 개수 표시용) */
export function getPostImageUrls(post: Post): string[] {
  const fromColumn = parseUrlList(post.image_urls);
  if (fromColumn.length > 0) return fromColumn;
  return buildPostBlocks(post)
    .filter((b): b is Extract<PostBlock, { type: 'image' }> => b.type === 'image')
    .map(b => b.url);
}

/** HTML 태그를 제거한 순수 텍스트 미리보기 */
export function getPostPlainText(post: Post): string {
  const content = parseContentJson(post.content_json);
  const html = content?.html || post.content || '';
  if (typeof html !== 'string') return '';
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|h[1-6]|li)>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 댓글 허용 여부. 값이 없으면(예전 글) 허용으로 본다. */
export function isCommentingAllowed(post: Post): boolean {
  if (post.allow_comments === false) return false;
  const content = parseContentJson(post.content_json);
  if (content && content.allow_comments === false) return false;
  return true;
}

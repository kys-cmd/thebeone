interface VimeoInfo {
  id: string;
  h?: string;
}

/**
 * Vimeo 주소에서 비디오 ID와 보안 해시(?h=...)를 추출합니다.
 */
export const extractVimeoInfo = (input: string): VimeoInfo | null => {
  if (!input) return null;
  
  let cleanInput = input.trim();
  
  // 1. HTML 엔티티 디코딩 (&amp; -> &)
  cleanInput = cleanInput.replace(/&amp;/g, '&');
  
  // 2. iframe 소스 코드인 경우 src 필드 추출 (싱글/더블 따옴표 매칭, 대소문자 무시)
  const srcMatch = cleanInput.match(/src=["']([^"']+)["']/i);
  if (srcMatch) {
    cleanInput = srcMatch[1];
  }
  
  // 혹시라도 복사 과정에서 남아있을 수 있는 따옴표와 괄호 제거
  cleanInput = cleanInput.replace(/["']/g, '');

  // DB에 직접 기입된 ID?h=hash 또는 ID/hash 형태 고속 직접 매칭 패턴 추가
  const directMatch = cleanInput.match(/^([0-9]+)[?&]h=([a-z0-9]+)/i);
  if (directMatch) {
    return { id: directMatch[1], h: directMatch[2] };
  }

  const slashMatch = cleanInput.match(/^([0-9]+)\/([a-z0-9]+)(?:\?|$)/i);
  if (slashMatch) {
    return { id: slashMatch[1], h: slashMatch[2] };
  }

  // 3. 다양한 패턴 시도
  
  // 패턴 A: player.vimeo.com/video/12345/abcdef 나 vimeo.com/12345/abcdef 형태 (보안 해시 포함된 경로)
  // vimeo.com/manage/videos/12345/abcdef 도 매칭 가능
  const pathHashMatch = cleanInput.match(/(?:vimeo\.com|player\.vimeo\.com)\/(?:video\/|manage\/videos\/)?([0-9]+)\/([a-z0-9]+)/i);
  if (pathHashMatch) {
    return { id: pathHashMatch[1], h: pathHashMatch[2] };
  }

  // 패턴 B: URL 형태 또는 쿼리 파라미터 체크 (?h=abcdef)
  // vimeo.com/12345 이나 vimeo.com/manage/videos/12345 등 숫자 추출
  const idMatch = cleanInput.match(/(?:vimeo\.com|player\.vimeo\.com)\/(?:video\/|manage\/videos\/)?([0-9]+)/i);
  
  let vId = "";
  if (idMatch) {
    vId = idMatch[1];
  } else {
    // 숫자로만 되어있거나 12345?h=abcdef 또는 12345/abcdef 형태인 경우
    const rawIdMatch = cleanInput.match(/^([0-9]+)/);
    if (rawIdMatch) {
      vId = rawIdMatch[1];
    }
  }

  if (vId) {
    // 슬래시 문자열 분할 체크 (예: 12345/abcdef 형식 처리)
    if (!cleanInput.includes('http') && cleanInput.includes('/')) {
      const parts = cleanInput.split('/');
      // parts[0]이 id고 parts[1]이 h인 경우 처리
      if (parts.length >= 2 && parts[0] === vId) {
        // 혹시 물음표 질의가 묻어있다면 제거
        const hashPart = parts[1].split('?')[0];
        return { id: vId, h: hashPart };
      }
    }

    // URL 또는 쿼리 스트링에서 h 파라미터 찾기
    try {
      const url = cleanInput.includes('http') ? new URL(cleanInput) : new URL(cleanInput, 'https://vimeo.com');
      const h = url.searchParams.get('h');
      if (h) return { id: vId, h };
    } catch (e) {
      // URL 파싱 실패 시 정규식 시도
      const hMatch = cleanInput.match(/[?&]h=([a-z0-9]+)/i);
      if (hMatch) return { id: vId, h: hMatch[1] };
    }
    
    // 만약에 URL이 아니고 그냥 12345?h=abcdef 형식인 경우
    const hMatchSelf = cleanInput.match(/[?&]h=([a-z0-9]+)/i);
    if (hMatchSelf) return { id: vId, h: hMatchSelf[1] };

    return { id: vId };
  }

  // 완벽한 매칭이 안되면 그냥 가공된 입력을 ID로 가정
  // (입력 자체가 ID인 경우 대응)
  return { id: cleanInput };
};

/**
 * 구버전 호환용 (ID?h=hash 형태의 문자열 반환)
 */
export const extractVimeoId = (input: string): string => {
  const info = extractVimeoInfo(input);
  if (!info) return "";
  return info.h ? `${info.id}?h=${info.h}` : info.id;
};

/**
 * 비메오 임베드 URL을 파라미터와 함께 생성합니다.
 */
export const getVimeoEmbedUrl = (input: string, params: Record<string, any> = {}): string => {
  const info = extractVimeoInfo(input);
  if (!info) return "";

  const baseUrl = `https://player.vimeo.com/video/${info.id}`;
  const searchParams = new URLSearchParams();
  
  if (info.h) searchParams.set('h', info.h);
  
  // DNT (Do Not Track)를 기본 활성화하여 쿠키 및 트랙커 제한 브라우저(Incognito, Safari)에서도 플레이어가 정상 표시되도록 처리
  searchParams.set('dnt', '1');
  
  Object.entries(params).forEach(([key, value]) => {
    searchParams.set(key, String(value));
  });

  const queryString = searchParams.toString();
  return queryString ? `${baseUrl}?${queryString}` : baseUrl;
};

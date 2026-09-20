/**
 * Safe JSON parser for HTTP Responses.
 * Prevents "Unexpected token '<', '<!DOCTYPE '... is not valid JSON" errors
 * that occur when an API route returns HTML (e.g. 404, 502, or Vite SPA fallback).
 */
export async function safeResponseJson<T = any>(
  response: Response,
  fallbackValue?: T
): Promise<T> {
  const contentType = response.headers.get('content-type') || '';
  
  // If explicitly not JSON (e.g. text/html)
  if (!contentType.includes('application/json')) {
    const text = await response.text();
    const isHtml = text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html') || text.includes('<html>');
    const preview = text.substring(0, 100).replace(/\s+/g, ' ').trim();
    
    console.warn(
      `[safeResponseJson] Expected JSON but received ${contentType || 'non-JSON'} (status: ${response.status} ${response.statusText}):`,
      preview
    );

    if (fallbackValue !== undefined) {
      return fallbackValue;
    }

    if (isHtml) {
      throw new Error(
        `서버 통신 오류 (HTTP ${response.status}): API 엔드포인트 대신 웹페이지(HTML)가 반환되었습니다.`
      );
    }

    throw new Error(`올바르지 않은 서버 응답 형식 (HTTP ${response.status}): ${preview}`);
  }

  // Content-type contains application/json, but body could still be malformed or empty
  const rawText = await response.text();
  if (!rawText || !rawText.trim()) {
    if (fallbackValue !== undefined) return fallbackValue;
    return {} as T;
  }

  try {
    return JSON.parse(rawText) as T;
  } catch (err: any) {
    console.error('[safeResponseJson] JSON parsing failed for raw body:', rawText.substring(0, 120));
    if (fallbackValue !== undefined) return fallbackValue;
    throw new Error(`서버 응답 파싱 실패 (HTTP ${response.status}): ${err.message}`);
  }
}

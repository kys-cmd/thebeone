import React, { useEffect, useState } from 'react';
import { cmsService } from '../services/cmsService';

export default function LifeCoaching() {
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchContent = async () => {
      try {
        const data = await cmsService.getSupportContent('life_coaching');
        if (data && data.length > 0 && data[0].content) {
          setHtmlContent(data[0].content);
        } else {
          setHtmlContent(''); // Will show default coming soon
        }
      } catch (err) {
        console.error('Failed to load life coaching content:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchContent();
  }, []);

  return (
    <div className="min-h-[calc(100vh-200px)] bg-white">
      {loading ? (
        <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      ) : htmlContent && htmlContent.replace(/<[^>]*>?/gm, '').trim() !== '' ? (
        <div dangerouslySetInnerHTML={{ __html: htmlContent }} className="container mx-auto px-4 py-8" />
      ) : (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] px-4">
          <h1 className="text-4xl font-black text-gray-900 mb-4">라이프코칭</h1>
          <p className="text-xl text-gray-500 font-bold mb-8 text-center max-w-lg">
            라이프코칭 페이지는 현재 준비중입니다.<br />
            더 나은 서비스로 찾아뵙겠습니다.
          </p>
        </div>
      )}
    </div>
  );
}

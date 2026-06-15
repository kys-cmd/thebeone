import React from 'react';
import { CourseBlock } from '@/types';
import { getVimeoEmbedUrl } from '@/lib/vimeo';

interface DynamicCourseRendererProps {
  blocks: CourseBlock[];
}

export default function DynamicCourseRenderer({ blocks }: DynamicCourseRendererProps) {
  if (!blocks || blocks.length === 0) {
    return (
      <div className="py-20 text-center text-gray-500">
        등록된 강의 상세 내용이 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-12 w-full">
      {blocks.map((block) => (
        <div key={block.id} className="w-full">
          {block.type === 'heading' && (
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 mb-4 px-4 md:px-0">
              {block.content}
            </h2>
          )}

          {block.type === 'text' && (
            <div className="prose prose-lg max-w-none text-gray-700 leading-relaxed whitespace-pre-wrap px-4 md:px-0">
              {block.content}
            </div>
          )}

          {block.type === 'video' && block.content && (
            <div className="aspect-video w-full md:rounded-2xl rounded-none overflow-hidden shadow-xl bg-black">
              <iframe
                src={getVimeoEmbedUrl(block.content)}
                className="w-full h-full animate-fade-in"
                allow="autoplay; fullscreen; picture-in-picture; encrypted-media; gyroscope; accelerometer; clipboard-write; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
                title={block.metadata?.title || 'Course Video'}
              />
            </div>
          )}

          {block.type === 'image' && block.content && (
            <div className="space-y-2">
              <img
                src={block.content}
                alt={block.metadata?.caption || 'Course Image'}
                className="w-full md:rounded-2xl rounded-none shadow-lg object-cover"
                referrerPolicy="no-referrer"
              />
              {block.metadata?.caption && (
                <p className="text-center text-sm text-gray-500 italic px-4 md:px-0">
                  {block.metadata.caption}
                </p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

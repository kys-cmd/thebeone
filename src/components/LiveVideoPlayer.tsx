import React, { useRef, useEffect, useMemo } from 'react';
import DOMPurify from 'dompurify';

interface LiveVideoPlayerProps {
  embedCode: string;
}

const LIVE_EMBED_SANITIZE_OPTIONS = {
  ADD_TAGS: ['iframe', 'video', 'source'],
  ADD_ATTR: [
    'src', 'allow', 'allowfullscreen', 'frameborder', 'scrolling',
    'width', 'height', 'style', 'class', 'title', 'referrerpolicy',
    'controls', 'autoplay', 'muted', 'playsinline'
  ]
};

export const LiveVideoPlayer: React.FC<LiveVideoPlayerProps> = React.memo(({ embedCode }) => {
  const sanitizedEmbed = useMemo(
    () => DOMPurify.sanitize(embedCode || '', LIVE_EMBED_SANITIZE_OPTIONS),
    [embedCode]
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const prevEmbedRef = useRef<string>(sanitizedEmbed);

  useEffect(() => {
    if (!containerRef.current) return;
    if (prevEmbedRef.current !== sanitizedEmbed) {
      prevEmbedRef.current = sanitizedEmbed;
      containerRef.current.innerHTML = sanitizedEmbed;
    }
  }, [sanitizedEmbed]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full [&>div]:w-full [&>div]:h-full [&>div]:!p-0 [&_iframe]:w-full [&_iframe]:h-full [&_iframe]:absolute [&_iframe]:inset-0"
      dangerouslySetInnerHTML={{ __html: sanitizedEmbed }}
    />
  );
});

LiveVideoPlayer.displayName = 'LiveVideoPlayer';


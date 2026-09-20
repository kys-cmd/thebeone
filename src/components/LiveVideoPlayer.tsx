import React, { useRef, useEffect } from 'react';

interface LiveVideoPlayerProps {
  embedCode: string;
}

/**
 * LiveVideoPlayer
 *
 * Prevents video playback interruption and iframe re-mounting:
 * 1. Safely renders the embed HTML without causing React unmount/remount churn.
 * 2. Only updates innerHTML when embedCode actually changes, preserving iframe playback.
 * 3. Initial render directly injects HTML so there is no flicker or blank state.
 */
export const LiveVideoPlayer: React.FC<LiveVideoPlayerProps> = React.memo(({ embedCode }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const prevEmbedRef = useRef<string>(embedCode);

  useEffect(() => {
    if (!containerRef.current) return;
    if (prevEmbedRef.current !== embedCode) {
      prevEmbedRef.current = embedCode;
      containerRef.current.innerHTML = embedCode;
    }
  }, [embedCode]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full [&>div]:w-full [&>div]:h-full [&>div]:!p-0 [&_iframe]:w-full [&_iframe]:h-full [&_iframe]:absolute [&_iframe]:inset-0"
      dangerouslySetInnerHTML={{ __html: embedCode }}
    />
  );
});

LiveVideoPlayer.displayName = 'LiveVideoPlayer';

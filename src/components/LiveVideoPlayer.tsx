import React, { useRef, useEffect } from 'react';

interface LiveVideoPlayerProps {
  embedCode: string;
}

/**
 * LiveVideoPlayer
 * 
 * Prevents video playback interruption and iframe re-mounting:
 * 1. Only updates innerHTML if the embed code string actually changed.
 * 2. Uses React.memo so parent state changes (chat message received, scrolling, etc.)
 *    do not re-render or reload the iframe.
 */
export const LiveVideoPlayer: React.FC<LiveVideoPlayerProps> = React.memo(({ embedCode }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const prevEmbedRef = useRef<string>('');

  useEffect(() => {
    if (!containerRef.current) return;

    // Only touch the DOM if the actual embed code has changed!
    if (prevEmbedRef.current !== embedCode) {
      prevEmbedRef.current = embedCode;
      containerRef.current.innerHTML = embedCode;
    }
  }, [embedCode]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full [&>div]:w-full [&>div]:h-full [&>div]:!p-0 [&_iframe]:w-full [&_iframe]:h-full [&_iframe]:absolute [&_iframe]:inset-0"
    />
  );
});

LiveVideoPlayer.displayName = 'LiveVideoPlayer';

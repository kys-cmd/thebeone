import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { buildImageSrcSet, getOptimizedImageUrl } from '@/lib/image';

/**
 * 이미지 변환(Supabase image transformation)은 플랜에 따라 사용할 수 없는 경우가 있다.
 * 한 번이라도 변환 요청이 실패하면 이후에는 모든 이미지를 원본으로 바로 요청해
 * 실패 요청이 반복되지 않게 한다.
 */
let transformationSupported = true;

interface OptimizedImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src' | 'srcSet'> {
  src?: string | null;
  /** 화면에 실제로 그려지는 대략적인 CSS 폭(px). 리사이즈 기준값이 된다. */
  displayWidth: number;
  /** <img sizes> 속성. 반응형 그리드에서 정확한 후보를 고르게 해준다. */
  sizes?: string;
  /** 로딩 중에 보여줄 스켈레톤 사용 여부 */
  showSkeleton?: boolean;
  /** 이미지를 감싸는 요소의 className */
  wrapperClassName?: string;
}

/**
 * 커뮤니티 목록/본문에서 쓰는 최적화 이미지.
 *
 * - 표시 크기에 맞춰 리사이즈된 이미지를 요청하고 1x/2x srcSet을 제공한다.
 * - lazy loading + async decoding으로 목록 스크롤 부담을 줄인다.
 * - 변환 엔드포인트가 실패하면 원본 주소로 한 번 더 시도한다.
 */
export function OptimizedImage({
  src,
  displayWidth,
  sizes,
  showSkeleton = true,
  wrapperClassName,
  className,
  alt = '',
  loading = 'lazy',
  ...rest
}: OptimizedImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [useOriginal, setUseOriginal] = useState(!transformationSupported);

  if (!src) return null;

  const skipTransform = useOriginal || !transformationSupported;
  const optimizedSrc = skipTransform ? src : getOptimizedImageUrl(src, { width: displayWidth });
  const srcSet = skipTransform
    ? undefined
    : buildImageSrcSet(src, [displayWidth, displayWidth * 2]);

  return (
    <div className={cn('relative w-full h-full overflow-hidden', wrapperClassName)}>
      {showSkeleton && !isLoaded && (
        <div className="absolute inset-0 bg-slate-100 animate-pulse" aria-hidden="true" />
      )}
      <img
        src={optimizedSrc}
        srcSet={srcSet}
        sizes={sizes}
        alt={alt}
        loading={loading}
        decoding="async"
        referrerPolicy="no-referrer"
        onLoad={() => setIsLoaded(true)}
        onError={() => {
          // 이미지 변환이 지원되지 않는 환경이면 원본으로 폴백한다.
          if (!skipTransform) {
            transformationSupported = false;
            setUseOriginal(true);
          } else {
            setIsLoaded(true);
          }
        }}
        className={cn(
          'w-full h-full transition-opacity duration-300',
          isLoaded ? 'opacity-100' : 'opacity-0',
          className
        )}
        {...rest}
      />
    </div>
  );
}

import React, { useRef, useState, useEffect, useCallback } from 'react';
import gsap from 'gsap';
import styles from './Output.module.css';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SEGMENTS_BASE = `${SUPABASE_URL}/storage/v1/object/public/segments`;
const segmentUrlCache = new Set();
const segmentInFlight = new Map();

function loadSegment(url) {
  if (segmentUrlCache.has(url)) return Promise.resolve(url);
  if (segmentInFlight.has(url)) return segmentInFlight.get(url);

  const promise = new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      segmentUrlCache.add(url);
      segmentInFlight.delete(url);
      resolve(url);
    };
    img.onerror = () => {
      segmentInFlight.delete(url);
      resolve(null);
    };
    img.src = url;
  });

  segmentInFlight.set(url, promise);
  return promise;
}

const StyleCarousel = React.memo(function StyleCarousel({
  styleId,
  similarity,
  onClick,
  isActive = true,
  shouldLoadSegments = true,
}) {
  const containerRef = useRef(null);
  const stripRef = useRef(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [loadedSegmentsState, setLoadedSegmentsState] = useState({ styleId: null, segments: {} });
  const dragStartX = useRef(0);
  const dragStartY = useRef(0);
  const dragStartTime = useRef(0);
  const isPointerDown = useRef(false);
  const isDragging = useRef(false);
  const suppressClick = useRef(false);
  const currentOffset = useRef(0);

  // Load segment images lazily from Supabase Storage
  // Segments 2–6 are lazy-loaded; segment 1 (rep) is local in /images/rep/
  useEffect(() => {
    if (!shouldLoadSegments) return;

    let cancelled = false;

    const urls = Array.from({ length: 5 }, (_, i) =>
      `${SEGMENTS_BASE}/${styleId}/${i + 2}.webp`
    );

    urls.forEach((url, index) => {
      loadSegment(url).then((resolvedUrl) => {
        if (cancelled) return;
        if (!resolvedUrl) return;

        setLoadedSegmentsState((prev) => ({
          styleId,
          segments: {
            ...(prev.styleId === styleId ? prev.segments : {}),
            [index]: resolvedUrl,
          },
        }));
      });
    });

    return () => {
      cancelled = true;
    };
  }, [styleId, shouldLoadSegments]);

  const loadedSegments = shouldLoadSegments && loadedSegmentsState.styleId === styleId
    ? loadedSegmentsState.segments
    : {};

  const getCarouselWidth = useCallback(() => {
    return containerRef.current?.clientWidth || 200;
  }, []);

  const goToSlide = useCallback((index) => {
    const clamped = Math.max(0, Math.min(5, index));
    setCurrentSlide(clamped);
    const width = getCarouselWidth();
    const targetOffset = -clamped * width;
    gsap.to(stripRef.current, {
      x: targetOffset,
      duration: 0.35,
      ease: 'power3.out',
      onStart: () => {
        if (stripRef.current) {
          stripRef.current.classList.add('animating');
        }
      },
      onComplete: () => {
        currentOffset.current = targetOffset;
        if (stripRef.current) {
          stripRef.current.classList.remove('animating');
        }
      },
    });
  }, [getCarouselWidth]);

  const snapBack = useCallback(() => {
    gsap.to(stripRef.current, {
      x: currentOffset.current,
      duration: 0.25,
      ease: 'power2.out',
      onComplete: () => {
        if (stripRef.current) {
          stripRef.current.classList.remove('animating');
        }
      },
    });
  }, []);

  // Pointer events for swipe
  const handlePointerDown = (e) => {
    if (e.button != null && e.button !== 0) return;

    dragStartX.current = e.clientX;
    dragStartY.current = e.clientY;
    dragStartTime.current = Date.now();
    isPointerDown.current = true;
    isDragging.current = false;
    suppressClick.current = false;
  };

  const handlePointerMove = (e) => {
    if (!isPointerDown.current) return;

    const deltaX = e.clientX - dragStartX.current;
    const deltaY = e.clientY - dragStartY.current;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    // Keep vertical scrolling fluid and avoid stealing taps.
    if (absY > absX + 6) {
      if (isDragging.current) {
        isDragging.current = false;
        snapBack();
      }
      return;
    }

    if (absX < 6) return;

    isDragging.current = true;
    suppressClick.current = true;

    gsap.set(stripRef.current, { x: currentOffset.current + deltaX });
  };

  const handlePointerUp = (e) => {
    if (!isPointerDown.current) return;

    isPointerDown.current = false;

    const delta = e.clientX - dragStartX.current;
    const elapsed = Math.max(1, Date.now() - dragStartTime.current);
    const velocity = Math.abs(delta) / elapsed;

    if (!isDragging.current) {
      suppressClick.current = false;
      return;
    }

    isDragging.current = false;

    const distanceThreshold = 20;
    const velocityThreshold = 0.3;
    const shouldSwipe = Math.abs(delta) > distanceThreshold
      || velocity > velocityThreshold;
    const totalSlides = slides.length;

    if (shouldSwipe) {
      const nextSlide = delta < 0
        ? Math.min(currentSlide + 1, totalSlides - 1)
        : Math.max(currentSlide - 1, 0);
      goToSlide(nextSlide);
    } else {
      snapBack();
    }
  };

  const handlePointerCancel = () => {
    if (!isPointerDown.current && !isDragging.current) return;

    isPointerDown.current = false;
    isDragging.current = false;
    suppressClick.current = true;
    snapBack();
  };

  const handleClick = () => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }

    onClick?.(styleId);
  };

  // Build slide sources: rep (segment 1 / local) + 5 segments from Supabase Storage
  const slides = [
    `/images/rep/${styleId}.webp`,
    ...Array.from({ length: 5 }, (_, i) => loadedSegments[i] || null),
  ];

  return (
    <div
      ref={containerRef}
      className={styles.carouselContainer}
      onPointerDown={isActive ? handlePointerDown : undefined}
      onPointerMove={isActive ? handlePointerMove : undefined}
      onPointerUp={isActive ? handlePointerUp : undefined}
      onPointerCancel={isActive ? handlePointerCancel : undefined}
      onClick={isActive ? handleClick : undefined}
    >
      {similarity != null && (
        <span className={styles.similarityBadge}>
          {Math.round(similarity * 100)}%
        </span>
      )}

      <div ref={stripRef} className={styles.strip}>
        {slides.map((src, i) =>
          src ? (
            <img key={i} src={src} alt="" draggable={false} />
          ) : (
            <div key={i} className={styles.shimmer} />
          )
        )}
      </div>

      {currentSlide > 0 && (
        <button
          className={`${styles.carouselArrow} ${styles.arrowLeft}`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); goToSlide(currentSlide - 1); }}
          type="button"
        >
          <span className={styles.carouselArrowIcon}>←</span>
        </button>
      )}
      {currentSlide < 5 && (
        <button
          className={`${styles.carouselArrow} ${styles.arrowRight}`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); goToSlide(currentSlide + 1); }}
          type="button"
        >
          <span className={styles.carouselArrowIcon}>→</span>
        </button>
      )}

      <div className={styles.dots}>
        {slides.map((_, i) => (
          <div
            key={i}
            className={`${styles.dot} ${i === currentSlide ? styles.active : ''}`}
          />
        ))}
      </div>
    </div>
  );
});

export default StyleCarousel;

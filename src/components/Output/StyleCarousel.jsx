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
  shouldLoadSegments = true,
}) {
  const containerRef = useRef(null);
  const stripRef = useRef(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [loadedSegmentsState, setLoadedSegmentsState] = useState({ styleId: null, segments: {} });
  const pendingSegmentsRef = useRef({});
  const flushTimerRef = useRef(null);
  const dragStartX = useRef(0);
  const dragStartY = useRef(0);
  const dragStartTime = useRef(0);
  const isDragging = useRef(false);
  const didDrag = useRef(false);
  const currentOffset = useRef(0);

  // Load segment images lazily from Supabase Storage
  // Segments 2–6 are lazy-loaded; segment 1 (rep) is local in /images/rep/
  useEffect(() => {
    if (!shouldLoadSegments) return;

    let cancelled = false;

    const flushSegments = () => {
      const pending = pendingSegmentsRef.current;
      if (!pending || Object.keys(pending).length === 0) return;

      setLoadedSegmentsState((prev) => ({
        styleId,
        segments: {
          ...(prev.styleId === styleId ? prev.segments : {}),
          ...pending,
        },
      }));

      pendingSegmentsRef.current = {};
    };

    const urls = Array.from({ length: 5 }, (_, i) =>
      `${SEGMENTS_BASE}/${styleId}/${i + 2}.webp`
    );

    urls.forEach((url, index) => {
      loadSegment(url).then((resolvedUrl) => {
        if (cancelled) return;
        if (!resolvedUrl) return;

        pendingSegmentsRef.current[index] = resolvedUrl;

        if (flushTimerRef.current !== null) {
          clearTimeout(flushTimerRef.current);
        }

        flushTimerRef.current = setTimeout(() => {
          flushTimerRef.current = null;
          if (cancelled) return;
          flushSegments();
        }, 16);
      });
    });

    return () => {
      cancelled = true;

      if (flushTimerRef.current !== null) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }

      pendingSegmentsRef.current = {};
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
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    dragStartX.current = e.pageX;
    dragStartY.current = e.pageY;
    dragStartTime.current = Date.now();
    isDragging.current = true;
    didDrag.current = false;
    if (e.pointerType === 'mouse') {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    }
  };

  const handlePointerMove = (e) => {
    if (!isDragging.current) return;
    const deltaX = e.pageX - dragStartX.current;
    const deltaY = e.pageY - (dragStartY.current || e.pageY);

    // If vertical movement dominates, cancel drag
    if (Math.abs(deltaY) > Math.abs(deltaX) + 5) {
      isDragging.current = false;
      snapBack();
      return;
    }

    gsap.set(stripRef.current, { x: currentOffset.current + deltaX });
  };

  const handlePointerUp = (e) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    if (e.pointerType === 'mouse') {
      e.currentTarget.releasePointerCapture?.(e.pointerId);
    }
    const delta = e.pageX - dragStartX.current;
    const elapsed = Date.now() - dragStartTime.current;
    const velocity = Math.abs(delta) / elapsed;

    const distanceThreshold = 20;
    const velocityThreshold = 0.3;
    const shouldSwipe = Math.abs(delta) > distanceThreshold
      || velocity > velocityThreshold;
    const totalSlides = slides.length;

    if (shouldSwipe) {
      didDrag.current = true;
      const nextSlide = delta < 0
        ? Math.min(currentSlide + 1, totalSlides - 1)
        : Math.max(currentSlide - 1, 0);
      goToSlide(nextSlide);
    } else {
      snapBack();
    }
  };

  const handlePointerCancel = (e) => {
    if (e.pointerType === 'mouse') {
      e.currentTarget.releasePointerCapture?.(e.pointerId);
    }
    isDragging.current = false;
    snapBack();
  };

  const handleClick = () => {
    if (didDrag.current) {
      didDrag.current = false;
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
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onClick={handleClick}
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

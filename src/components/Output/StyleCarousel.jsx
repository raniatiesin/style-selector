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
  const isDragging = useRef(false);
  const currentOffset = useRef(0);

  // Load segment images lazily from Supabase Storage
  // Segments 2–6 are lazy-loaded; segment 1 (rep) is local in /images/rep/
  useEffect(() => {
    if (!shouldLoadSegments) return;

    let cancelled = false;

    const urls = Array.from({ length: 5 }, (_, i) =>
      `${SEGMENTS_BASE}/${styleId}/${i + 2}.webp`
    );

    Promise.all(urls.map(url => loadSegment(url))).then(results => {
      if (cancelled) return;
      const next = {};
      results.forEach((url, i) => {
        if (url) next[i] = url;
      });
      setLoadedSegmentsState({ styleId, segments: next });
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
    currentOffset.current = -clamped * width;
    stripRef.current?.classList.add('animating');
    gsap.to(stripRef.current, {
      x: currentOffset.current,
      duration: 0.3,
      ease: 'power2.out',
      onComplete: () => stripRef.current?.classList.remove('animating'),
    });
  }, [getCarouselWidth]);

  const snapBack = useCallback(() => {
    stripRef.current?.classList.add('animating');
    gsap.to(stripRef.current, {
      x: currentOffset.current,
      duration: 0.2,
      ease: 'power2.out',
      onComplete: () => stripRef.current?.classList.remove('animating'),
    });
  }, []);

  // Pointer events for swipe
  const handlePointerDown = (e) => {
    dragStartX.current = e.pageX;
    isDragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!isDragging.current) return;
    const delta = e.pageX - dragStartX.current;
    gsap.set(stripRef.current, { x: currentOffset.current + delta });
  };

  const handlePointerUp = (e) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    const delta = e.pageX - dragStartX.current;
    const threshold = Math.min(80, Math.max(36, window.innerWidth * 0.1));

    if (Math.abs(delta) < 5) {
      // This was a click, not a drag
      onClick?.(styleId);
      return;
    }

    if (delta < -threshold) goToSlide(currentSlide + 1);
    else if (delta > threshold) goToSlide(currentSlide - 1);
    else snapBack();
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
          ←
        </button>
      )}
      {currentSlide < 5 && (
        <button
          className={`${styles.carouselArrow} ${styles.arrowRight}`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); goToSlide(currentSlide + 1); }}
          type="button"
        >
          →
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

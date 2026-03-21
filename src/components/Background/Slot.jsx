import React, { useRef, useEffect, memo } from 'react';
import gsap from 'gsap';
import styles from './Background.module.css';

/**
 * Slot — single permanent DOM node in the background mosaic.
 * Never unmounts. Only imageId changes trigger re-render (custom memo).
 */
const Slot = memo(function Slot({ slot, isOutputVisible = false }) {
  const slotRef = useRef(null);
  const imgRef = useRef(null);
  const timelineRef = useRef(null);
  const creepRef = useRef(null);
  const isTextSlot = typeof slot.text === 'string' && slot.text.length > 0;
  const isMobileViewport = typeof window !== 'undefined'
    && window.matchMedia('(max-width: 767px)').matches;
  const boundedX = isMobileViewport ? Math.max(4, Math.min(96, slot.x)) : slot.x;
  const boundedY = isMobileViewport ? Math.max(4, Math.min(96, slot.y)) : slot.y;
  const slotWidth = isMobileViewport
    ? (slot.customWidth ?? `clamp(42px, ${slot.width}vw, 128px)`)
    : (slot.customWidth ?? `${slot.width}vw`);
  const slotAspectRatio = isTextSlot ? undefined : slot.aspectRatio;

  // Drift animation + ambient vertical creep — mounted once, killed on unmount
  useEffect(() => {
    const el = slotRef.current;
    if (!el) return;

    // Center the slot ON its x,y coordinate.
    // CSS `left`/`top` positions the top-left corner; xPercent/yPercent shifts by -50%
    // so the slot is centered at its coordinate. This makes left/right edges symmetric —
    // both peek equally from the viewport edges instead of left being fully visible.
    gsap.set(el, { xPercent: -50, yPercent: -50 });

    // Primary oscillating drift — no rotation
    const tl = gsap.timeline({ repeat: -1, yoyo: true });
    tl.to(el, {
      x: slot.driftX * (Math.random() > 0.5 ? 1 : -1),
      y: slot.driftY * (Math.random() > 0.5 ? 1 : -1),
      duration: slot.driftDuration,
      ease: 'sine.inOut',
      delay: slot.driftPhase * slot.driftDuration,
    });
    timelineRef.current = tl;

    // Ambient vertical creep — slow persistent up/down
    // Even slot numbers drift up, odd drift down
    const slotNum = parseInt(slot.id.replace(/\D/g, ''), 10) || 0;
    const direction = slotNum % 2 === 0 ? -1 : 1;
    const creepDistance = 15 + Math.random() * 20; // 15–35px
    const creepDuration = 40 + Math.random() * 25; // 40–65s

    const creep = gsap.to(el, {
      y: `+=${direction * creepDistance}`,
      duration: creepDuration,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
      delay: Math.random() * 10,
    });
    creepRef.current = creep;

    const shouldAnimate = (Boolean(slot.imageId) || isTextSlot) && !isOutputVisible;
    tl.paused(!shouldAnimate);
    creep.paused(!shouldAnimate);

    return () => {
      tl.kill();
      creep.kill();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Pause background motion for slots without active images.
  useEffect(() => {
    const shouldAnimate = (Boolean(slot.imageId) || isTextSlot) && !isOutputVisible;
    if (timelineRef.current) timelineRef.current.paused(!shouldAnimate);
    if (creepRef.current) creepRef.current.paused(!shouldAnimate);
  }, [slot.imageId, isOutputVisible, isTextSlot]);

  // Image crossfade — only when imageId changes
  useEffect(() => {
    if (isTextSlot) return;

    const imgEl = imgRef.current;
    if (!imgEl) return;

    // Slot deactivated — fade out and clear
    if (!slot.imageId) {
      gsap.to(imgEl, { opacity: 0, duration: 0.18, ease: 'power2.in' });
      return;
    }

    const newSrc = `/images/rep/${slot.imageId}.webp`;

    // Pre-load before swap
    const loader = new Image();
    loader.onload = () => {
      gsap.timeline()
        .to(imgEl, { opacity: 0, duration: 0.18, ease: 'power2.in' })
        .call(() => { imgEl.src = newSrc; })
        .to(imgEl, { opacity: slot.opacity, duration: 0.24, ease: 'power2.out' });
    };
    loader.src = newSrc;
  }, [slot.imageId, slot.opacity, isTextSlot]);

  return (
    <div
      ref={slotRef}
      className={styles.slot}
      style={{
        left: `${boundedX}%`,
        top: `${boundedY}%`,
        width: slotWidth,
        aspectRatio: slotAspectRatio,
        opacity: slot.opacity,
        borderRadius: `${slot.borderRadius}px`,
        zIndex: isTextSlot ? 2 : 0,
        background: isTextSlot ? 'rgba(10, 10, 10, 0.62)' : 'transparent',
        backdropFilter: isTextSlot ? 'blur(24px)' : 'none',
        WebkitBackdropFilter: isTextSlot ? 'blur(24px)' : 'none',
        border: isTextSlot ? '1px solid rgba(255, 255, 255, 0.10)' : 'none',
        boxShadow: isTextSlot ? '0 8px 32px rgba(0, 0, 0, 0.45)' : 'none',
      }}
    >
      {isTextSlot ? (
        <div className={styles.textCardContent}>
          <p className={styles.textCardText}>{slot.text}</p>
        </div>
      ) : (
        <img
          ref={imgRef}
          alt=""
          draggable={false}
          loading="eager"
          decoding="async"
          style={{ opacity: 0 }}
        />
      )}
    </div>
  );
}, (prev, next) => prev.slot.imageId === next.slot.imageId && prev.isOutputVisible === next.isOutputVisible);

export default Slot;

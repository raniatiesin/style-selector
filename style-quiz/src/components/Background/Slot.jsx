import React, { useRef, useEffect, memo } from 'react';
import gsap from 'gsap';
import styles from './Background.module.css';

/**
 * Slot — single permanent DOM node in the background mosaic.
 * Never unmounts. Only imageId changes trigger re-render (custom memo).
 */
const Slot = memo(function Slot({ slot }) {
  const slotRef = useRef(null);
  const imgRef = useRef(null);
  const timelineRef = useRef(null);
  const creepRef = useRef(null);

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

    return () => {
      tl.kill();
      creep.kill();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Image crossfade — only when imageId changes
  useEffect(() => {
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
  }, [slot.imageId, slot.opacity]);

  return (
    <div
      ref={slotRef}
      className={styles.slot}
      style={{
        left: `${slot.x}%`,
        top: `${slot.y}%`,
        width: `${slot.width}vw`,
        aspectRatio: slot.aspectRatio,
        opacity: slot.opacity,
        borderRadius: `${slot.borderRadius}px`,
      }}
    >
      <img
        ref={imgRef}
        alt=""
        draggable={false}
        loading="eager"
        decoding="async"
        style={{ opacity: 0 }}
      />
    </div>
  );
}, (prev, next) => prev.slot.imageId === next.slot.imageId);

export default Slot;

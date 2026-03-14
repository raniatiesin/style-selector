import React, { useRef, useEffect, useMemo, memo } from 'react';
import { DESKTOP_SLOTS, MOBILE_SLOTS } from '../../config/generateSlots';
import Slot from './Slot';
import styles from './Background.module.css';

function areImageIdsEqual(prevIds, nextIds) {
  if (prevIds === nextIds) return true;
  if (!Array.isArray(prevIds) || !Array.isArray(nextIds)) return false;
  if (prevIds.length !== nextIds.length) return false;
  for (let i = 0; i < prevIds.length; i++) {
    if (prevIds[i] !== nextIds[i]) return false;
  }
  return true;
}

function areBackgroundPropsEqual(prevProps, nextProps) {
  if (prevProps.blurred !== nextProps.blurred) return false;
  return areImageIdsEqual(prevProps.imageIds, nextProps.imageIds);
}

/** Choose slot set based on viewport width */
function useDeviceSlots() {
  // Evaluated once at mount — no resize listener needed
  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;
  return isDesktop ? DESKTOP_SLOTS : MOBILE_SLOTS;
}

/**
 * Adaptive slot assignment — proportional dispersion + coordinate stretch.
 *
 * Step 1 — Proportional split: each layer gets N × (layerSize/total) slots,
 * so images are always spread across all layers regardless of count.
 *
 * Step 2 — Coordinate stretch: measure how far the active slot set reaches
 * from screen center vs. how far the full slot set reaches. Scale all active
 * positions outward from center by that ratio so they always fill the full
 * visual space, whether there are 3 images or 84.
 *
 * n=3  → 3 images scattered across the full screen, plenty of breathing room
 * n=20 → sparse galaxy filling the viewport
 * n=84 → stretch factor = 1.0, identical to the perfect full-fill layout
 */
function computeAssignment(slots, imageIds) {
  if (!imageIds || imageIds.length === 0) {
    return slots.map(s => ({ ...s, imageId: null }));
  }

  const n = imageIds.length;
  const isMobileSlots = slots === MOBILE_SLOTS;

  const layer1Slots = slots.filter(s => s.layer === 1);
  const layer2Slots = slots.filter(s => s.layer === 2);
  const layer3Slots = slots.filter(s => s.layer === 3);

  // Step 1 — L2-biased targets.
  // L1 (center) is hidden behind the quiz card. L3 (corners) bleeds off-screen.
  // L2 (middle ring) is the most visible zone — give it 65% of N.
  // L3 gets 10%, L1 gets whatever remains to reach N.
  // At n=84 the layer caps kick in and all 84 slots fill exactly as designed.
  const l2Ratio = isMobileSlots ? 0.55 : 0.65;
  const l3Ratio = isMobileSlots ? 0.22 : 0.10;
  const l2Target = Math.min(layer2Slots.length, Math.round(n * l2Ratio));
  let l3Base = Math.round(n * l3Ratio);
  if (isMobileSlots && n >= 9) l3Base = Math.max(3, l3Base);
  const l3Target = Math.min(layer3Slots.length, l3Base);
  const l1Target = Math.min(layer1Slots.length, n - l2Target - l3Target);

  const activeIds = new Set();
  const strideSelect = (layerSlots, take) => {
    if (take <= 0) return;
    const stride = layerSlots.length / take;
    for (let i = 0; i < take; i++) {
      activeIds.add(layerSlots[Math.floor(i * stride)].id);
    }
  };
  strideSelect(layer3Slots, l3Target);
  strideSelect(layer2Slots, l2Target);
  strideSelect(layer1Slots, l1Target);

  // Step 2 — Coordinate stretch
  // Average radius from center (50,50) for all slots vs. only active slots.
  // Stretching active positions by fullRadius/activeRadius fills the same
  // visual area as the full set, keeping the layout from collapsing inward.
  const radius = s => Math.sqrt((s.x - 50) ** 2 + (s.y - 50) ** 2);
  const avg = arr => arr.reduce((sum, s) => sum + radius(s), 0) / arr.length;

  const activeSlots = slots.filter(s => activeIds.has(s.id));
  const fullRadius = avg(slots);
  const activeRadius = avg(activeSlots);
  // Only stretch when active set is smaller; cap at 1.5× to avoid blowing off-screen
  const maxStretch = isMobileSlots && n <= 15 ? 1.7 : 1.5;
  const stretch = activeRadius > 0 ? Math.min(maxStretch, fullRadius / activeRadius) : 1;

  let imgIdx = 0;
  return slots.map(s => {
    if (!activeIds.has(s.id)) return { ...s, imageId: null };

    const sx = stretch === 1 ? s.x : 50 + (s.x - 50) * stretch;
    const sy = stretch === 1 ? s.y : 50 + (s.y - 50) * stretch;

    return { ...s, x: sx, y: sy, imageId: imageIds[imgIdx++] ?? null };
  });
}

/**
 * Background — 60 permanent slots with drift, parallax, and staggered image swap.
 * Wrapped in React.memo, entirely prop-driven.
 */
const Background = memo(function Background({ imageIds, blurred }) {
  const canvasRef = useRef(null);
  const layer1Ref = useRef(null);
  const layer2Ref = useRef(null);
  const layer3Ref = useRef(null);

  const slots = useDeviceSlots();
  const isDesktop = slots === DESKTOP_SLOTS;

  const assignedSlots = useMemo(
    () => computeAssignment(slots, imageIds),
    [imageIds, slots]
  );

  // Split assigned slots by layer for rendering
  const layer1Assigned = useMemo(() => assignedSlots.filter(s => s.layer === 1), [assignedSlots]);
  const layer2Assigned = useMemo(() => assignedSlots.filter(s => s.layer === 2), [assignedSlots]);
  const layer3Assigned = useMemo(() => assignedSlots.filter(s => s.layer === 3), [assignedSlots]);

  // Parallax input:
  // - Desktop: mousemove
  // - Mobile (coarse pointer, no reduced-motion): device tilt
  // Both feed the same target/current values and single RAF loop.
  useEffect(() => {
    const supportsOrientation = typeof window !== 'undefined' && 'DeviceOrientationEvent' in window;
    const canUseTilt =
      !isDesktop &&
      supportsOrientation &&
      window.matchMedia('(pointer: coarse)').matches &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let targetX = 0, targetY = 0;
    let currentX = 0, currentY = 0;
    let pendingTilt = null;
    let rafId = 0;
    let running = false;
    let lastInputTs = 0;
    let orientationAttached = false;
    let firstTouchHandler = null;

    const applyParallax = (x, y) => {
      if (layer1Ref.current) {
        layer1Ref.current.style.transform =
          `translate(${x * 7}px, ${y * 5}px)`;
      }
      if (layer2Ref.current) {
        layer2Ref.current.style.transform =
          `translate(${x * 17}px, ${y * 13}px)`;
      }
      if (layer3Ref.current) {
        layer3Ref.current.style.transform =
          `translate(${x * 29}px, ${y * 22}px)`;
      }
    };

    const startTick = () => {
      if (running) return;
      running = true;
      rafId = requestAnimationFrame(tick);
    };

    const onMouseMove = (e) => {
      targetX = (e.clientX / window.innerWidth - 0.5) * 2;
      targetY = (e.clientY / window.innerHeight - 0.5) * 2;
      lastInputTs = performance.now();
      startTick();
    };

    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

    const onDeviceOrientation = (event) => {
      const gamma = typeof event.gamma === 'number' ? event.gamma : 0;
      const beta = typeof event.beta === 'number' ? event.beta : 0;
      pendingTilt = {
        x: clamp(gamma / 30, -1, 1),
        y: clamp(beta / 45, -1, 1),
      };
      lastInputTs = performance.now();
      startTick();
    };

    const attachOrientation = () => {
      if (orientationAttached) return;
      window.addEventListener('deviceorientation', onDeviceOrientation, { passive: true });
      orientationAttached = true;
    };

    const tick = () => {
      if (pendingTilt) {
        targetX = pendingTilt.x;
        targetY = pendingTilt.y;
        pendingTilt = null;
      }

      currentX += (targetX - currentX) * 0.055;
      currentY += (targetY - currentY) * 0.055;
      applyParallax(currentX, currentY);

      const settling =
        Math.abs(targetX - currentX) > 0.002 ||
        Math.abs(targetY - currentY) > 0.002;
      const recentlyMoved = performance.now() - lastInputTs < 260;

      if (settling || recentlyMoved) {
        rafId = requestAnimationFrame(tick);
      } else {
        running = false;
        rafId = 0;
      }
    };

    if (isDesktop) {
      window.addEventListener('mousemove', onMouseMove, { passive: true });
    } else if (canUseTilt) {
      const needsPermission =
        typeof window.DeviceOrientationEvent.requestPermission === 'function';

      if (needsPermission) {
        firstTouchHandler = () => {
          window.DeviceOrientationEvent.requestPermission()
            .then(permission => {
              if (permission === 'granted') attachOrientation();
            })
            .catch(() => {
              // Silent no-op on denied/blocked permission.
            });
        };
        window.addEventListener('touchstart', firstTouchHandler, { passive: true, once: true });
      } else {
        attachOrientation();
      }
    }

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      if (firstTouchHandler) {
        window.removeEventListener('touchstart', firstTouchHandler);
      }
      if (orientationAttached) {
        window.removeEventListener('deviceorientation', onDeviceOrientation);
      }
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [isDesktop]);

  return (
    <div
      ref={canvasRef}
      className={`${styles.canvas} ${blurred ? styles.blurred : ''}`}
    >
      <div ref={layer1Ref} className={styles.layer}>
        {layer1Assigned.map(slot => (
          <Slot key={slot.id} slot={slot} />
        ))}
      </div>
      <div ref={layer2Ref} className={styles.layer}>
        {layer2Assigned.map(slot => (
          <Slot key={slot.id} slot={slot} />
        ))}
      </div>
      <div ref={layer3Ref} className={styles.layer}>
        {layer3Assigned.map(slot => (
          <Slot key={slot.id} slot={slot} />
        ))}
      </div>
      {(!imageIds || imageIds.length === 0) && (
        <p className={styles.emptyHint}>Coming soon — keep exploring</p>
      )}
    </div>
  );
}, areBackgroundPropsEqual);

export default Background;

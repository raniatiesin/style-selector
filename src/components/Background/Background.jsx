import React, { useRef, useEffect, useMemo, useState, memo, forwardRef } from 'react';
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
  if (prevProps.isOutputVisible !== nextProps.isOutputVisible) return false;
  if (prevProps.rapidSwapActive !== nextProps.rapidSwapActive) return false;
  if (prevProps.showCard1 !== nextProps.showCard1) return false;
  if (prevProps.showCard2 !== nextProps.showCard2) return false;
  if (prevProps.showCard3 !== nextProps.showCard3) return false;
  return areImageIdsEqual(prevProps.imageIds, nextProps.imageIds);
}

function pickNearestSlot(slots, targetX, targetY, usedIds) {
  let best = null;
  let bestDist = Infinity;
  for (const slot of slots) {
    if (usedIds.has(slot.id)) continue;
    const dx = slot.x - targetX;
    const dy = slot.y - targetY;
    const dist = dx * dx + dy * dy;
    if (dist < bestDist) {
      bestDist = dist;
      best = slot;
    }
  }
  if (best) usedIds.add(best.id);
  return best;
}

function buildTextCards(slots, isDesktop) {
  const layer2Slots = slots.filter(s => s.layer === 2);
  if (layer2Slots.length === 0) return [];

  const safeLayer2Slots = layer2Slots.filter(s => s.x >= 30 && s.x <= 70 && s.y >= 20 && s.y <= 82);
  const anchorPool = safeLayer2Slots.length >= 3 ? safeLayer2Slots : layer2Slots;

  const used = new Set();
  const firstAnchor = isDesktop
    ? pickNearestSlot(anchorPool, 50, 44, used)
    : pickNearestSlot(anchorPool, 50, 40, used);
  const secondAnchor = isDesktop
    ? pickNearestSlot(anchorPool, 50, 66, used)
    : pickNearestSlot(anchorPool, 50, 70, used);
  const thirdAnchor = isDesktop
    ? pickNearestSlot(anchorPool, 68, 30, used)
    : pickNearestSlot(anchorPool, 68, 28, used);

  return [
    firstAnchor && {
      ...firstAnchor,
      id: 'text-card-1',
      sourceId: firstAnchor.id,
      imageId: null,
      width: isDesktop ? 24 : 54,
      aspectRatio: isDesktop ? '1.42/1' : '1.28/1',
      opacity: 1,
      borderRadius: 16,
      cardVariant: 'quiz-mini',
      text: 'Every answer shapes how your video looks.',
    },
    secondAnchor && {
      ...secondAnchor,
      id: 'text-card-2',
      sourceId: secondAnchor.id,
      imageId: null,
      width: isDesktop ? 24 : 54,
      aspectRatio: isDesktop ? '1.42/1' : '1.28/1',
      opacity: 1,
      borderRadius: 16,
      cardVariant: 'quiz-mini',
      text: "The more specific you are, the less it looks like everyone else's.",
    },
    thirdAnchor && {
      ...thirdAnchor,
      id: 'text-card-3',
      sourceId: thirdAnchor.id,
      imageId: null,
      width: isDesktop ? 18 : 42,
      aspectRatio: isDesktop ? '2.1/1' : '1.9/1',
      opacity: 1,
      borderRadius: 16,
      cardVariant: 'quiz-mini',
      text: 'Good Luck!',
    },
  ].filter(Boolean);
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
const Background = memo(forwardRef(function Background({ imageIds, blurred, isOutputVisible, rapidSwapActive = false, showCard1 = false, showCard2 = false, showCard3 = false }, canvasRef) {
  const layer1Ref = useRef(null);
  const layer2Ref = useRef(null);
  const layer3Ref = useRef(null);
  const settleTimerRef = useRef(null);
  const [animatedImageIds, setAnimatedImageIds] = useState(imageIds);

  const slots = useDeviceSlots();
  const isDesktop = slots === DESKTOP_SLOTS;

  useEffect(() => {
    if (settleTimerRef.current !== null) {
      clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }

    if (rapidSwapActive) return;
    setAnimatedImageIds(imageIds);
  }, [imageIds, rapidSwapActive]);

  useEffect(() => {
    return () => {
      if (settleTimerRef.current !== null) {
        clearTimeout(settleTimerRef.current);
        settleTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!rapidSwapActive || !Array.isArray(imageIds) || imageIds.length === 0) {
      return undefined;
    }

    const pool = imageIds;
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
    const pulseCountBase = reducedMotion ? 3 : (isDesktop ? 6 : 4);
    const intervalBase = reducedMotion ? 320 : (isDesktop ? 170 : 230);
    const recentWindow = reducedMotion ? 10 : 16;
    const startTs = performance.now();

    let rafId = 0;
    let lastPulseTs = 0;
    let lastFpsSampleTs = startTs;
    let frameCounter = 0;
    let fps = 60;
    const recent = [];

    const nextFromPool = (excludeSet) => {
      const maxAttempts = 10;
      for (let i = 0; i < maxAttempts; i++) {
        const candidate = pool[Math.floor(Math.random() * pool.length)];
        if (!candidate) continue;
        if (excludeSet.has(candidate)) continue;
        if (recent.includes(candidate)) continue;
        return candidate;
      }
      return pool[Math.floor(Math.random() * pool.length)] ?? null;
    };

    const pulse = () => {
      setAnimatedImageIds((prev) => {
        if (!Array.isArray(prev) || prev.length === 0) return prev;
        const next = [...prev];
        const indexes = Array.from({ length: next.length }, (_, i) => i);

        for (let i = indexes.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [indexes[i], indexes[j]] = [indexes[j], indexes[i]];
        }

        const chosen = new Set();
        const loadFactor = fps < 45 ? 0.55 : (fps < 54 ? 0.78 : 1);
        const swapCount = Math.max(2, Math.round(pulseCountBase * loadFactor));
        const count = Math.min(swapCount, indexes.length);

        for (let i = 0; i < count; i++) {
          const idx = indexes[i];
          const replacement = nextFromPool(chosen);
          if (!replacement) continue;
          next[idx] = replacement;
          chosen.add(replacement);
          recent.push(replacement);
        }

        if (recent.length > recentWindow) {
          recent.splice(0, recent.length - recentWindow);
        }

        return next;
      });
    };

    const tick = (now) => {
      frameCounter += 1;

      const elapsedSinceFpsSample = now - lastFpsSampleTs;
      if (elapsedSinceFpsSample >= 1000) {
        fps = Math.round((frameCounter * 1000) / elapsedSinceFpsSample);
        frameCounter = 0;
        lastFpsSampleTs = now;
      }

      const activeFor = now - startTs;
      let intervalMs = intervalBase;
      if (activeFor >= 4000) intervalMs = Math.round(intervalMs * 1.55);
      if (fps < 50) intervalMs = Math.round(intervalMs * 1.3);
      if (fps < 42) intervalMs = Math.round(intervalMs * 1.7);

      // Skip ultra-fast searches to avoid loader flicker artifacts.
      const canPulse = activeFor >= 500;
      if (canPulse && (now - lastPulseTs >= intervalMs)) {
        lastPulseTs = now;
        pulse();
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (settleTimerRef.current !== null) {
        clearTimeout(settleTimerRef.current);
      }
      settleTimerRef.current = setTimeout(() => {
        setAnimatedImageIds(imageIds);
        settleTimerRef.current = null;
      }, 200);
    };
  }, [imageIds, isDesktop, rapidSwapActive]);

  const assignedSlots = useMemo(
    () => computeAssignment(slots, animatedImageIds),
    [animatedImageIds, slots]
  );

  // Split assigned slots by layer for rendering
  const layer1Assigned = useMemo(() => assignedSlots.filter(s => s.layer === 1), [assignedSlots]);
  const layer2Assigned = useMemo(() => assignedSlots.filter(s => s.layer === 2), [assignedSlots]);
  const layer3Assigned = useMemo(() => assignedSlots.filter(s => s.layer === 3), [assignedSlots]);
  const textCards = useMemo(() => buildTextCards(slots, isDesktop), [slots, isDesktop]);
  const activeTextCard = showCard1 ? textCards[0] : (showCard2 ? textCards[1] : (showCard3 ? textCards[2] : null));
  const replacedSlotId = activeTextCard?.sourceId ?? null;

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
          <Slot key={slot.id} slot={slot} isOutputVisible={isOutputVisible} />
        ))}
      </div>
      <div ref={layer2Ref} className={styles.layer}>
        {layer2Assigned.map(slot => {
          if (replacedSlotId && slot.id === replacedSlotId && activeTextCard) {
            return <Slot key={activeTextCard.id} slot={activeTextCard} isOutputVisible={isOutputVisible} />;
          }
          return <Slot key={slot.id} slot={slot} isOutputVisible={isOutputVisible} />;
        })}
      </div>
      <div ref={layer3Ref} className={styles.layer}>
        {layer3Assigned.map(slot => (
          <Slot key={slot.id} slot={slot} isOutputVisible={isOutputVisible} />
        ))}
      </div>
      {(!animatedImageIds || animatedImageIds.length === 0) && (
        <p className={styles.emptyHint}>Coming soon — keep exploring</p>
      )}
    </div>
  );
}), areBackgroundPropsEqual);

export default Background;

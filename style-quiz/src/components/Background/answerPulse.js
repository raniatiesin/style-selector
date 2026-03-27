import gsap from 'gsap';

/** Answer pulse — called on quiz answer click */
export function triggerAnswerPulse(canvasElement) {
  if (!canvasElement) return;
  gsap.timeline()
    .to(canvasElement, {
      scale: 1.012,
      duration: 0.16,
      ease: 'power2.out',
    })
    .to(canvasElement, {
      scale: 1.0,
      duration: 0.6,
      ease: 'elastic.out(1, 0.72)',
    });
}

export function initOwlPet(root = document) {
  const body = root.querySelector("#owlBody");
  if (!body || body.dataset.owlVisualReady === "true") return () => {};

  body.dataset.owlVisualReady = "true";
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  let rafId = 0;
  let destroyed = false;
  let currentX = 0;
  let currentY = 0;
  let targetX = 0;
  let targetY = 0;

  const applyLook = () => {
    body.style.setProperty("--owl-look-x", `${currentX.toFixed(2)}px`);
    body.style.setProperty("--owl-look-y", `${currentY.toFixed(2)}px`);
  };

  const resetLook = () => {
    targetX = 0;
    targetY = 0;
  };

  const updateTargetFromPointer = event => {
    if (reducedMotion.matches) {
      resetLook();
      return;
    }

    const bounds = body.getBoundingClientRect();
    const centerX = bounds.left + bounds.width / 2;
    const centerY = bounds.top + bounds.height / 2;

    const dx = event.clientX - centerX;
    const dy = event.clientY - centerY;
    const distance = Math.hypot(dx, dy);

    const activeRadius = Math.max(window.innerWidth, window.innerHeight) * 0.9;
    const proximity = clamp(1 - distance / activeRadius, 0, 1);
    const weight = 0.24 + proximity * 0.76;

    const nextX = clamp(
      (dx / Math.max(bounds.width * 0.38, 30)) * 4.3 * weight,
      -4.8,
      4.8
    );
    const nextY = clamp(
      (dy / Math.max(bounds.height * 0.34, 28)) * 3.5 * weight,
      -3.8,
      3.8
    );

    targetX = nextX;
    targetY = nextY;
  };

  const animate = () => {
    if (destroyed) return;

    currentX += (targetX - currentX) * 0.18;
    currentY += (targetY - currentY) * 0.18;

    applyLook();
    rafId = window.requestAnimationFrame(animate);
  };

  const onPointerMove = event => {
    updateTargetFromPointer(event);
  };

  const onLeavePage = () => {
    resetLook();
  };

  const onVisibilityChange = () => {
    if (document.hidden) resetLook();
  };

  const onMotionPreferenceChange = () => {
    resetLook();
  };

  applyLook();

  window.addEventListener("pointermove", onPointerMove, { passive: true });
  document.addEventListener("mouseleave", onLeavePage);
  window.addEventListener("blur", onLeavePage);
  document.addEventListener("visibilitychange", onVisibilityChange);
  reducedMotion.addEventListener?.("change", onMotionPreferenceChange);

  rafId = window.requestAnimationFrame(animate);

  return () => {
    destroyed = true;
    if (rafId) window.cancelAnimationFrame(rafId);
    window.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("mouseleave", onLeavePage);
    window.removeEventListener("blur", onLeavePage);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    reducedMotion.removeEventListener?.("change", onMotionPreferenceChange);
  };
}

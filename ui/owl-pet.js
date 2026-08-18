export function initOwlPet(root = document) {
  const body = root.querySelector("#owlBody");
  if (!body || body.dataset.owlVisualReady === "true") return () => {};

  body.dataset.owlVisualReady = "true";

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const state = {
    lookX: 0,
    lookY: 0,
    legLeftRot: -1.2,
    legRightRot: 1.2,
    legLeftLift: 0,
    legRightLift: 0
  };

  const target = {
    lookX: 0,
    lookY: 0,
    legLeftRot: -1.2,
    legRightRot: 1.2,
    legLeftLift: 0,
    legRightLift: 0
  };

  let rafId = 0;
  let destroyed = false;

  const apply = () => {
    body.style.setProperty("--owl-look-x", `${state.lookX.toFixed(2)}px`);
    body.style.setProperty("--owl-look-y", `${state.lookY.toFixed(2)}px`);
    body.style.setProperty("--owl-leg-left-rot", `${state.legLeftRot.toFixed(2)}deg`);
    body.style.setProperty("--owl-leg-right-rot", `${state.legRightRot.toFixed(2)}deg`);
    body.style.setProperty("--owl-leg-left-lift", `${state.legLeftLift.toFixed(2)}px`);
    body.style.setProperty("--owl-leg-right-lift", `${state.legRightLift.toFixed(2)}px`);
  };

  const resetTarget = () => {
    target.lookX = 0;
    target.lookY = 0;
    target.legLeftRot = -1.2;
    target.legRightRot = 1.2;
    target.legLeftLift = 0;
    target.legRightLift = 0;
  };

  const updateTargetFromPointer = event => {
    if (reducedMotion.matches) {
      resetTarget();
      return;
    }

    const bounds = body.getBoundingClientRect();
    const centerX = bounds.left + bounds.width / 2;
    const centerY = bounds.top + bounds.height / 2;

    const dx = event.clientX - centerX;
    const dy = event.clientY - centerY;
    const distance = Math.hypot(dx, dy);

    // Theo chuột toàn trang: khi ở xa vẫn nhìn nhẹ,
    // khi ở gần thì chuyển động rõ hơn.
    const activeRadius = Math.max(window.innerWidth, window.innerHeight) * 0.9;
    const proximity = clamp(1 - distance / activeRadius, 0, 1);
    const globalWeight = 0.28;
    const weight = globalWeight + proximity * 0.72;

    const lookRangeX = clamp((dx / Math.max(bounds.width * 0.32, 26)) * 5.7 * weight, -6.4, 6.4);
    const lookRangeY = clamp((dy / Math.max(bounds.height * 0.28, 24)) * 4.9 * weight, -4.8, 4.8);

    target.lookX = lookRangeX;
    target.lookY = lookRangeY;

    const stepSwing = clamp(dx / Math.max(bounds.width * 0.48, 54), -1, 1) * 4.4 * weight;
    const liftBase = proximity * 0.45;

    target.legLeftRot = clamp(-1.6 + stepSwing * 0.9, -7.4, 5.6);
    target.legRightRot = clamp(1.6 + stepSwing * 0.9, -5.6, 7.4);
    target.legLeftLift = clamp(Math.max(0, stepSwing) * 1.35 + liftBase, 0, 4.4);
    target.legRightLift = clamp(Math.max(0, -stepSwing) * 1.35 + liftBase, 0, 4.4);
  };

  const animate = now => {
    if (destroyed) return;

    const idleWave = reducedMotion.matches ? 0 : Math.sin(now / 260) * 0.45;
    const idleLift = reducedMotion.matches ? 0 : (Math.sin(now / 220) + 1) * 0.22;

    state.lookX += (target.lookX - state.lookX) * 0.18;
    state.lookY += (target.lookY - state.lookY) * 0.18;

    state.legLeftRot += ((target.legLeftRot + idleWave) - state.legLeftRot) * 0.16;
    state.legRightRot += ((target.legRightRot - idleWave) - state.legRightRot) * 0.16;

    state.legLeftLift += ((target.legLeftLift + Math.max(0, idleWave) + idleLift) - state.legLeftLift) * 0.16;
    state.legRightLift += ((target.legRightLift + Math.max(0, -idleWave) + idleLift) - state.legRightLift) * 0.16;

    apply();
    rafId = window.requestAnimationFrame(animate);
  };

  const onPointerMove = event => {
    updateTargetFromPointer(event);
  };

  const onLeavePage = () => {
    resetTarget();
  };

  const onVisibilityChange = () => {
    if (document.hidden) {
      resetTarget();
    }
  };

  const onMotionPreferenceChange = () => {
    if (reducedMotion.matches) {
      resetTarget();
    }
  };

  apply();
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

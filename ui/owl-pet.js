export function initOwlPet(root = document) {
  const body = root.querySelector("#owlBody");
  if (!body || body.dataset.owlVisualReady === "true") return () => {};

  body.dataset.owlVisualReady = "true";
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  let rafId = 0;
  let destroyed = false;

  // Mắt
  let currentX = 0;
  let currentY = 0;
  let targetX = 0;
  let targetY = 0;

  // Đầu: cố ý rất nhẹ để không tạo cảm giác "lắc cả con cú".
  let currentHeadRotate = 0;
  let currentHeadX = 0;
  let currentHeadY = 0;
  let targetHeadRotate = 0;
  let targetHeadX = 0;
  let targetHeadY = 0;

  const applyLook = () => {
    body.style.setProperty("--owl-look-x", `${currentX.toFixed(2)}px`);
    body.style.setProperty("--owl-look-y", `${currentY.toFixed(2)}px`);
    body.style.setProperty("--owl-head-rotate", `${currentHeadRotate.toFixed(2)}deg`);
    body.style.setProperty("--owl-head-x", `${currentHeadX.toFixed(2)}px`);
    body.style.setProperty("--owl-head-y", `${currentHeadY.toFixed(2)}px`);
  };

  const resetLook = (immediate = false) => {
    targetX = 0;
    targetY = 0;
    targetHeadRotate = 0;
    targetHeadX = 0;
    targetHeadY = 0;

    if (immediate) {
      currentX = 0;
      currentY = 0;
      currentHeadRotate = 0;
      currentHeadX = 0;
      currentHeadY = 0;
      applyLook();
    }
  };

  const updateTargetFromPointer = event => {
    if (reducedMotion.matches) {
      resetLook(true);
      return;
    }

    const bounds = body.getBoundingClientRect();
    const centerX = bounds.left + bounds.width / 2;
    const centerY = bounds.top + bounds.height / 2;

    const dx = event.clientX - centerX;
    const dy = event.clientY - centerY;
    const distance = Math.hypot(dx, dy);

    // Mắt luôn nhìn theo đúng hướng con trỏ, kể cả khi con trỏ ở xa.
    // Khoảng cách chỉ quyết định mức đạt tới biên, không làm mất hướng nhìn.
    const eyeReachX = Math.max(bounds.width * 1.05, 88);
    const eyeReachY = Math.max(bounds.height * 1.10, 92);

    const eyeDirX = clamp(dx / eyeReachX, -1, 1);
    const eyeDirY = clamp(dy / eyeReachY, -1, 1);

    // Thu nhỏ biên độ thêm để đồng tử không chạy sát mép mắt.
    targetX = eyeDirX * 3.35;
    targetY = eyeDirY * 2.55;

    // Đầu theo sau mắt, biên độ nhỏ hơn nhiều.
    const nx = clamp(dx / Math.max(bounds.width * 1.15, 105), -1, 1);
    const ny = clamp(dy / Math.max(bounds.height * 1.35, 120), -1, 1);

    // Đầu vẫn phản ứng nhẹ hơn mắt nhưng không mất hướng khi chuột ở xa.
    const headDistance = Math.max(bounds.width * 0.9, 90);
    const headWeight = 0.55 + clamp(distance / headDistance, 0, 1) * 0.45;

    targetHeadRotate = clamp(nx * 4.2 * headWeight, -4.2, 4.2);
    targetHeadX = clamp(nx * 1.6 * headWeight, -1.6, 1.6);
    targetHeadY = clamp(ny * 0.9 * headWeight, -0.9, 0.9);
  };

  const animate = () => {
    if (destroyed) return;

    // Mắt phản ứng nhanh hơn, đầu theo sau chậm hơn một chút.
    currentX += (targetX - currentX) * 0.28;
    currentY += (targetY - currentY) * 0.28;

    currentHeadRotate += (targetHeadRotate - currentHeadRotate) * 0.105;
    currentHeadX += (targetHeadX - currentHeadX) * 0.105;
    currentHeadY += (targetHeadY - currentHeadY) * 0.105;

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
    resetLook(true);
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

    resetLook(true);
    delete body.dataset.owlVisualReady;

    window.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("mouseleave", onLeavePage);
    window.removeEventListener("blur", onLeavePage);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    reducedMotion.removeEventListener?.("change", onMotionPreferenceChange);
  };
}

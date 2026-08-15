export function initOwlPet(root = document) {
  const body = root.querySelector("#owlBody");
  if (!body || body.dataset.owlVisualReady === "true") return () => {};

  body.dataset.owlVisualReady = "true";
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const resetLook = () => {
    body.style.setProperty("--owl-look-x", "0px");
    body.style.setProperty("--owl-look-y", "0px");
  };

  const followPointer = event => {
    if (reducedMotion.matches) return;
    const bounds = body.getBoundingClientRect();
    const x = Math.max(-1, Math.min(1, (event.clientX - bounds.left) / bounds.width * 2 - 1));
    const y = Math.max(-1, Math.min(1, (event.clientY - bounds.top) / bounds.height * 2 - 1));
    body.style.setProperty("--owl-look-x", `${(x * 1.8).toFixed(2)}px`);
    body.style.setProperty("--owl-look-y", `${(y * 1.4).toFixed(2)}px`);
  };

  body.addEventListener("pointermove", followPointer);
  body.addEventListener("pointerleave", resetLook);
  reducedMotion.addEventListener?.("change", resetLook);

  return () => {
    body.removeEventListener("pointermove", followPointer);
    body.removeEventListener("pointerleave", resetLook);
    reducedMotion.removeEventListener?.("change", resetLook);
  };
}

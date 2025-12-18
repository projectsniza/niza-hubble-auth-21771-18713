import html2canvas from "html2canvas";

export type CaptureOptions = {
  scale?: number;
  backgroundColor?: string;
};

/**
 * Captures an element to a canvas at a predictable size (ignores parent transforms).
 * Uses a cloned offscreen element so the capture is not affected by dialogs/scroll.
 */
export async function captureElementToCanvas(
  element: HTMLElement,
  options: CaptureOptions = {}
): Promise<HTMLCanvasElement> {
  const scale = options.scale ?? 2;
  const backgroundColor = options.backgroundColor ?? "#ffffff";

  const width = element.offsetWidth;
  const height = element.offsetHeight;

  const wrapper = document.createElement("div");
  wrapper.style.position = "fixed";
  wrapper.style.left = "-10000px";
  wrapper.style.top = "0";
  wrapper.style.width = `${width}px`;
  wrapper.style.height = `${height}px`;
  wrapper.style.background = backgroundColor;
  wrapper.style.overflow = "hidden";

  const clone = element.cloneNode(true) as HTMLElement;
  // Ensure clone isn't affected by any transforms
  clone.style.transform = "none";
  clone.style.width = `${width}px`;
  clone.style.height = `${height}px`;

  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);

  try {
    return await html2canvas(clone, {
      scale,
      backgroundColor,
      useCORS: true,
      allowTaint: true,
      logging: false,
      width,
      height,
    });
  } finally {
    wrapper.remove();
  }
}

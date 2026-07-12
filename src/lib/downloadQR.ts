/**
 * Downloads a QR code as a PNG. Prefers a <canvas> QR (QRCodeCanvas) inside
 * `container`; falls back to rasterizing a <svg> QR (QRCodeSVG). Always draws
 * onto a white canvas with a quiet-zone margin so the saved PNG is reliably
 * scannable — a QR with no surrounding white border can't be located by scanners.
 *
 * Usage:
 *   const wrapRef = useRef<HTMLDivElement>(null);
 *   <div ref={wrapRef}><QRCodeCanvas value={...} /></div>
 *   <button onClick={() => downloadQRPng(wrapRef.current, "MY-QR.png")}>Download</button>
 */
export function downloadQRPng(
  container: HTMLElement | null,
  filename: string,
  size = 512,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!container) return reject(new Error("QR container not found"));

    // Draws a QR source (canvas or image) onto a fresh white canvas with an ~8%
    // quiet-zone margin, then exports it as a PNG download. Nearest-neighbour
    // scaling keeps the module edges crisp instead of blurring them.
    const rasterizeAndDownload = (source: CanvasImageSource) => {
      const out = document.createElement("canvas");
      out.width = size;
      out.height = size;
      const ctx = out.getContext("2d");
      if (!ctx) return reject(new Error("Canvas not supported"));

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, size, size);

      const margin = Math.round(size * 0.08); // quiet zone so scanners lock on
      const inner = size - margin * 2;
      ctx.imageSmoothingEnabled = false; // crisp upscale, no blurred modules
      ctx.drawImage(source, margin, margin, inner, inner);

      const triggerDownload = (url: string, revoke: boolean) => {
        const a = document.createElement("a");
        a.href = url;
        a.download = filename.endsWith(".png") ? filename : `${filename}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        if (revoke) URL.revokeObjectURL(url);
        resolve();
      };

      // toBlob is preferred but flaky on older iOS Safari — fall back to a
      // data URL so the download still works there.
      try {
        out.toBlob((pngBlob) => {
          if (pngBlob) {
            triggerDownload(URL.createObjectURL(pngBlob), true);
          } else {
            triggerDownload(out.toDataURL("image/png"), false);
          }
        }, "image/png");
      } catch {
        triggerDownload(out.toDataURL("image/png"), false);
      }
    };

    // Preferred: a <canvas> QR (QRCodeCanvas) — draw it directly.
    const canvas = container.querySelector("canvas");
    if (canvas) {
      rasterizeAndDownload(canvas);
      return;
    }

    // Fallback: a <svg> QR (QRCodeSVG) — serialize its markup and load as an image.
    const svg = container.querySelector("svg");
    if (!svg) return reject(new Error("QR element not found"));

    const clone = svg.cloneNode(true) as SVGElement;
    if (!clone.getAttribute("xmlns")) clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const svgString = new XMLSerializer().serializeToString(clone);
    const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      rasterizeAndDownload(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load SVG"));
    };
    img.src = url;
  });
}

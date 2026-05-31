/**
 * Downloads a QR code as a PNG. Finds the QRCodeSVG svg inside `container`,
 * rasterizes it via canvas, and triggers a browser download.
 *
 * Usage:
 *   const wrapRef = useRef<HTMLDivElement>(null);
 *   <div ref={wrapRef}><QRCodeSVG value={...} /></div>
 *   <button onClick={() => downloadQRPng(wrapRef.current, "MY-QR.png")}>Download</button>
 */
export function downloadQRPng(
  container: HTMLElement | null,
  filename: string,
  size = 512
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!container) return reject(new Error("QR container not found"));
    const svg = container.querySelector("svg");
    if (!svg) return reject(new Error("QR SVG not found"));

    // Clone + ensure xmlns so the svg can be parsed standalone.
    const clone = svg.cloneNode(true) as SVGElement;
    if (!clone.getAttribute("xmlns")) clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const svgString = new XMLSerializer().serializeToString(clone);
    const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) { URL.revokeObjectURL(url); return reject(new Error("Canvas not supported")); }
      // White background — most scanners need contrast.
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);

      canvas.toBlob((pngBlob) => {
        URL.revokeObjectURL(url);
        if (!pngBlob) return reject(new Error("PNG encoding failed"));
        const pngUrl = URL.createObjectURL(pngBlob);
        const a = document.createElement("a");
        a.href = pngUrl;
        a.download = filename.endsWith(".png") ? filename : `${filename}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(pngUrl);
        resolve();
      }, "image/png");
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load SVG"));
    };
    img.src = url;
  });
}

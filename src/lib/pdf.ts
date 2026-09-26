// Célestime — export du fichier imprimable (300 DPI, format physique exact).
// Généré par le même moteur de rendu que la preview.

import { jsPDF } from "jspdf";
import { sizeById } from "./options";
import type { CreationConfig } from "./types";

export interface ExportRequest {
  dataUrl: string; // JPEG rendu à 300 DPI par le moteur de rendu
  wPx: number;
  hPx: number;
  config: CreationConfig;
}

export function pdfPageSize(config: CreationConfig): [number, number] {
  const s = sizeById(config.size);
  const pt = (cm: number) => (cm / 2.54) * 72;
  if (s.landscape) return [pt(s.w), pt(s.h)];
  return [pt(s.w), pt(s.h)];
}

export function exportPosterPdf(req: ExportRequest) {
  const [wPt, hPt] = pdfPageSize(req.config);
  const doc = new jsPDF({
    orientation: wPt > hPt ? "landscape" : "portrait",
    unit: "pt",
    format: [wPt, hPt],
    compress: true,
  });
  const name = req.config.name || "creation";
  doc.setProperties({
    title: `Célestime — ${name}`,
    author: "Célestime",
    subject: "Création Célestime personnalisée — papier satiné 250 g, impression 300 DPI",
    creator: "Moteur Célestime",
  });
  doc.addImage(req.dataUrl, "JPEG", 0, 0, wPt, hPt);
  const safe = name.replace(/[^\w-]+/g, "-").toLowerCase();
  doc.save(`celestime-${req.config.size}-${safe}.pdf`);
}

"use client";

import { StarMapCanvas, useSky } from "@/components/starmap-canvas";
import type { CreationConfig } from "@/lib/types";

export default function ProductPreview({ config }: { config: CreationConfig }) {
  const sky = useSky(config);
  return <StarMapCanvas config={config} sky={sky.sky} className="w-full" maxRenderPx={1100} />;
}

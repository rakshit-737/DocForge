import type { Metadata } from "next";
import { PdfClient } from "./pdf-client";

export const metadata: Metadata = { title: "DocForge — PDF bench" };

export default function PdfPage() {
  return <PdfClient />;
}

import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "DocForge",
  description:
    "Plain text in, beautifully typeset PDF and Word documents out — local-first, no account, yours forever.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // The day desk is the default the app boots into; the ThemeScript below
    // restores a saved night-shift preference before first paint.
    <html lang="en" data-light="">
      <head>
        <script
          // Inline so the desk never flashes the wrong shift on load.
          // biome-ignore lint/security/noDangerouslySetInnerHtml: static string, no interpolation
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem("docforge.ui.theme")==="dark")document.documentElement.removeAttribute("data-light")}catch(e){}`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

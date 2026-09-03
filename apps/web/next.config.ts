import type { NextConfig } from "next";

/* The hosted app's content-security policy (ledger #12, CSP slice). Every
   source is same-origin — the policy doubles as an enforced statement of the
   local-first commitment: the browser refuses any remote script, style, font,
   image or connection.

   Scheme allowances the studio actually needs:
   - script-src blob:   importGlobalScript() runs vendored bundles as Blob-URL
                        ES modules (the CSP-clean replacement for eval)
   - style-src blob: + connect-src blob:
                        PreviewController hands Paged.js the document CSS as a
                        Blob URL; the polisher fetches it
   - style-src 'unsafe-inline'
                        Paged.js and the engine inject <style> elements; React
                        writes inline style attributes
   - script-src 'unsafe-inline'
                        Next's bootstrap and the theme no-flash snippet are
                        inline scripts on prerendered pages, where a nonce
                        cannot exist (upgrade path: hash-based, ledger #12)
   - font-src/img-src data:
                        __FONT_DATA__ export preflight and pasted images inline
                        as data: URLs */
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' blob:",
  "style-src 'self' 'unsafe-inline' blob:",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' blob: data:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  // Workspace packages export TypeScript source (exports → ./src/index.ts);
  // Next transpiles them in-place so the studio always runs the live code.
  transpilePackages: [
    "@docforge/engine",
    "@docforge/export-docx",
    "@docforge/importers",
    "@docforge/mathml-omml",
    "@docforge/pdf-editor",
  ],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;

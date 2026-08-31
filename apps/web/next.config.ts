import type { NextConfig } from "next";

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
};

export default nextConfig;

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DocForge",
    short_name: "DocForge",
    description:
      "Plain text in, beautifully typeset PDF and Word documents out — local-first, no account required.",
    start_url: "/studio",
    display: "standalone",
    background_color: "#f4f2ec",
    theme_color: "#f4f2ec",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
    /* Installed, DocForge is a real handler for the files it understands
       (§8.5): double-click a .md or a .docforge.json and it opens here, as
       its own document, with the file kept open for saving in place. The
       fields are past MetadataRoute.Manifest's typing, which covers only the
       core spec — the cast is the narrowest way to say so. */
    ...({
      launch_handler: { client_mode: "focus-existing" },
      file_handlers: [
        {
          action: "/studio",
          accept: {
            "text/markdown": [".md", ".markdown"],
            "text/plain": [".txt"],
            "application/json": [".json", ".docforge.json"],
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
            "application/pdf": [".pdf"],
          },
        },
      ],
      /* Share to DocForge from another app: the text arrives as query
         parameters, which needs no service-worker interception and works the
         moment the app is installed. */
      share_target: {
        action: "/studio",
        method: "GET",
        params: { title: "title", text: "text", url: "url" },
      },
    } as Record<string, unknown>),
  };
}

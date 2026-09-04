/* What a document is called in the rack. The rest of the workspace is
   IndexedDB and is driven by the live probe. */
import { describe, expect, it } from "vitest";
import type { Settings } from "./settings";
import { docLabel } from "./workspace";

const settings = (title?: string) => ({ title }) as unknown as Settings;

describe("docLabel", () => {
  it("uses the document's own title when it has one", () => {
    expect(docLabel({ settings: settings("Lab Report 3"), source: "# Something else" })).toBe(
      "Lab Report 3",
    );
  });

  it("falls back to the opening heading — the name a writer recognises", () => {
    expect(docLabel({ settings: settings(""), source: "# Fracture Mechanics\n\nBody." })).toBe(
      "Fracture Mechanics",
    );
  });

  it("ignores the stored placeholder so the heading still wins", () => {
    expect(
      docLabel({ title: "Untitled document", settings: settings(""), source: "## Method\n" }),
    ).toBe("Method");
  });

  it("keeps a stored title that is not the placeholder", () => {
    expect(docLabel({ title: "From a project file", source: "# Heading" })).toBe(
      "From a project file",
    );
  });

  it("reads a heading anywhere in the document, closing hashes and all", () => {
    expect(docLabel({ source: "\n\n   ### Results ###\n" })).toBe("Results");
  });

  it("uses the first non-blank line when there is no heading", () => {
    expect(docLabel({ source: "\n\nJust a paragraph, no headings.\n" })).toBe(
      "Just a paragraph, no headings.",
    );
  });

  it("says Untitled document only when there is genuinely nothing", () => {
    expect(docLabel({ source: "   \n\n  " })).toBe("Untitled document");
    expect(docLabel({})).toBe("Untitled document");
  });

  it("trims a runaway heading rather than blowing out the rack", () => {
    expect(docLabel({ source: `# ${"x".repeat(200)}` }).length).toBe(80);
  });

  it("is not fooled by a hash that isn't a heading", () => {
    expect(docLabel({ source: "#nospace is not a heading\n" })).toBe("#nospace is not a heading");
  });
});

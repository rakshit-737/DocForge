/* The share-target road: what arrives on the URL, and what it becomes. The
   file-handling road needs a real launchQueue and is driven by the probe. */
import { afterEach, describe, expect, it, vi } from "vitest";
import { consumeSharedPayload, sharedToMarkdown } from "./launch-files";

/** Stand a window up with a query string, the way a share arrives. */
function withUrl(search: string) {
  const replaceState = vi.fn();
  vi.stubGlobal("window", {
    location: { search, pathname: "/studio" },
    history: { replaceState },
  });
  return { replaceState };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("consumeSharedPayload", () => {
  it("reads the three fields a share carries", () => {
    withUrl("?title=Notes&text=Some%20text&url=https%3A%2F%2Fexample.com");
    expect(consumeSharedPayload()).toEqual({
      title: "Notes",
      text: "Some text",
      url: "https://example.com",
    });
  });

  it("returns null for an ordinary visit", () => {
    withUrl("");
    expect(consumeSharedPayload()).toBe(null);
    withUrl("?zoom=120");
    expect(consumeSharedPayload()).toBe(null);
  });

  it("takes whatever subset was shared", () => {
    withUrl("?text=just%20this");
    expect(consumeSharedPayload()).toEqual({ title: "", text: "just this", url: "" });
  });

  it("scrubs the address bar so a reload doesn't paste it twice", () => {
    const { replaceState } = withUrl("?title=Once");
    consumeSharedPayload();
    expect(replaceState).toHaveBeenCalledWith(null, "", "/studio");
  });

  it("still returns the payload when history is unavailable", () => {
    vi.stubGlobal("window", {
      location: { search: "?title=Trapped", pathname: "/studio" },
      history: {
        replaceState() {
          throw new Error("no history here");
        },
      },
    });
    expect(consumeSharedPayload()?.title).toBe("Trapped");
  });
});

describe("sharedToMarkdown", () => {
  it("makes a heading of the title and keeps the text verbatim", () => {
    expect(sharedToMarkdown({ title: "A Title", text: "Body text.", url: "" })).toBe(
      "# A Title\n\nBody text.\n",
    );
  });

  it("writes a shared link as a link", () => {
    expect(sharedToMarkdown({ title: "", text: "", url: "https://example.com" })).toBe(
      "[https://example.com](https://example.com)\n",
    );
  });

  it("keeps all three in the order a reader would expect", () => {
    const md = sharedToMarkdown({ title: "T", text: "B", url: "https://x.test" });
    expect(md.indexOf("# T")).toBeLessThan(md.indexOf("B"));
    expect(md.indexOf("B")).toBeLessThan(md.indexOf("https://x.test"));
  });

  it("produces an empty document rather than stray blank lines", () => {
    expect(sharedToMarkdown({ title: "  ", text: "", url: " " })).toBe("\n");
  });
});

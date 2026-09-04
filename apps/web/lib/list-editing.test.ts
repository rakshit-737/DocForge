/* Smart lists: what counts as a list line, what the next marker is, and what
   Enter / Tab / Shift+Tab actually do to the document. The commands run
   against a real EditorState, so the transactions are the thing under test. */
import { EditorState } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { describe, expect, it } from "vitest";
import {
  continueList,
  indentListItem,
  nextMarker,
  outdentListItem,
  readMarker,
} from "./list-editing";

/* A command only ever reads `view.state` and calls `view.dispatch(spec)`, so
   the tests drive one directly rather than mounting an EditorView — no DOM
   needed, and the dispatched transaction is exactly what gets asserted. */
function stub(doc: string, anchor: number, head = anchor): EditorView {
  let state = EditorState.create({ doc, selection: { anchor, head } });
  return {
    get state() {
      return state;
    },
    dispatch(spec: Parameters<EditorState["update"]>[0]) {
      state = state.update(spec).state;
    },
  } as unknown as EditorView;
}

/** A view over `doc`, caret placed at `|` (which is stripped). */
function view(docWithCaret: string): EditorView {
  const at = docWithCaret.indexOf("|");
  const doc = docWithCaret.replace("|", "");
  return stub(doc, at < 0 ? doc.length : at);
}
const text = (v: EditorView) => v.state.doc.toString();

describe("readMarker", () => {
  it("reads every bullet shape", () => {
    expect(readMarker("- item")?.marker).toBe("- ");
    expect(readMarker("* item")?.marker).toBe("* ");
    expect(readMarker("+ item")?.marker).toBe("+ ");
  });

  it("reads ordered items and keeps the number", () => {
    const m = readMarker("3. item");
    expect(m?.marker).toBe("3. ");
    expect(m?.number).toBe(3);
    expect(readMarker("2) item")?.marker).toBe("2) ");
  });

  it("reads task boxes and quotes", () => {
    expect(readMarker("- [ ] todo")?.task).toBe(true);
    expect(readMarker("- [x] done")?.marker).toBe("- [ ] ");
    expect(readMarker("> quoted")?.marker).toBe("> ");
  });

  it("keeps the indentation and the content apart", () => {
    const m = readMarker("    - nested item");
    expect(m?.indent).toBe("    ");
    expect(m?.content).toBe("nested item");
  });

  it("is not fooled by ordinary prose or by a rule", () => {
    expect(readMarker("just text")).toBe(null);
    expect(readMarker("---")).toBe(null);
    expect(readMarker("-no space")).toBe(null);
  });
});

describe("nextMarker", () => {
  it("repeats a bullet and counts an ordered item on", () => {
    expect(nextMarker(readMarker("- a")!)).toBe("- ");
    expect(nextMarker(readMarker("3. a")!)).toBe("4. ");
    expect(nextMarker(readMarker("9) a")!)).toBe("10) ");
    expect(nextMarker(readMarker("- [x] a")!)).toBe("- [ ] ");
  });
});

describe("continueList (Enter)", () => {
  it("carries the bullet to the next line", () => {
    const v = view("- first|");
    expect(continueList(v)).toBe(true);
    expect(text(v)).toBe("- first\n- ");
  });

  it("counts an ordered list on", () => {
    const v = view("1. one\n2. two|");
    expect(continueList(v)).toBe(true);
    expect(text(v)).toBe("1. one\n2. two\n3. ");
  });

  it("keeps the indentation of a nested item", () => {
    const v = view("- top\n  - nested|");
    expect(continueList(v)).toBe(true);
    expect(text(v)).toBe("- top\n  - nested\n  - ");
  });

  it("gives a task item a fresh unticked box", () => {
    const v = view("- [x] done|");
    expect(continueList(v)).toBe(true);
    expect(text(v)).toBe("- [x] done\n- [ ] ");
  });

  it("ends the list when the item is empty", () => {
    const v = view("- first\n- |");
    expect(continueList(v)).toBe(true);
    expect(text(v)).toBe("- first\n");
  });

  it("steps a nested empty item out one level instead of ending the list", () => {
    const v = view("- top\n  - |");
    expect(continueList(v)).toBe(true);
    expect(text(v)).toBe("- top\n- ");
  });

  it("declines outside a list, so the editor's own Enter runs", () => {
    const v = view("just prose|");
    expect(continueList(v)).toBe(false);
    expect(text(v)).toBe("just prose");
  });

  it("declines mid-line — Enter there splits the text, it does not invent a marker", () => {
    const v = view("- first| item");
    expect(continueList(v)).toBe(false);
  });

  it("declines when a selection is open", () => {
    const v = stub("- one\n- two", 0, 8);
    expect(continueList(v)).toBe(false);
  });
});

describe("Tab / Shift+Tab", () => {
  it("nests an item under the one above it", () => {
    const v = view("- one\n- two|");
    expect(indentListItem(v)).toBe(true);
    expect(text(v)).toBe("- one\n  - two");
  });

  it("refuses to nest the first item of a list", () => {
    const v = view("- only|");
    expect(indentListItem(v)).toBe(false);
    expect(text(v)).toBe("- only");
  });

  it("un-nests, and stops at the left margin", () => {
    const v = view("- one\n  - two|");
    expect(outdentListItem(v)).toBe(true);
    expect(text(v)).toBe("- one\n- two");
    expect(outdentListItem(v)).toBe(false);
  });

  it("moves every item a selection touches", () => {
    const v = stub("- one\n- two\n- three", 6, 19); // items two and three
    expect(indentListItem(v)).toBe(true);
    expect(text(v)).toBe("- one\n  - two\n  - three");
  });

  it("declines outside a list, so indentWithTab still runs", () => {
    const v = view("just prose|");
    expect(indentListItem(v)).toBe(false);
    expect(outdentListItem(v)).toBe(false);
  });
});

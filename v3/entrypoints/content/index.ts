import { generate, resolveCandidate } from '@/src/engine/candidates';
import { describeBrief, describeElement } from '@/src/engine/describe';
import { isMessage, type Message } from '@/src/messaging';

// Inspector overlay: highlight the element under the cursor (like DevTools) and,
// on click, run the locator engine and report the result to the side panel.
export default defineContentScript({
  matches: ['<all_urls>'],
  allFrames: true,
  main() {
    let active = false;
    let box: HTMLDivElement | null = null;
    let label: HTMLDivElement | null = null;
    let current: Element | null = null;
    /** Last element under the cursor; the floor for walking back down. */
    let hovered: Element | null = null;

    const Z = '2147483647';

    function ensureOverlay() {
      if (box) return;
      box = document.createElement('div');
      Object.assign(box.style, {
        position: 'fixed',
        pointerEvents: 'none',
        zIndex: Z,
        background: 'rgba(56,139,253,0.25)',
        border: '1px solid rgba(56,139,253,0.9)',
        borderRadius: '2px',
        transition: 'all 40ms ease-out',
      } as CSSStyleDeclaration);
      label = document.createElement('div');
      label.dataset.pageModeller = 'label';
      Object.assign(label.style, {
        position: 'fixed',
        pointerEvents: 'none',
        zIndex: Z,
        font: '11px/1.4 ui-monospace, monospace',
        color: '#fff',
        background: '#1f6feb',
        padding: '1px 6px',
        borderRadius: '3px',
        whiteSpace: 'nowrap',
      } as CSSStyleDeclaration);
      document.documentElement.append(box, label);
    }

    function removeOverlay() {
      box?.remove();
      label?.remove();
      box = label = null;
      current = hovered = null;
    }

    /** How many ancestors the breadcrumb shows before eliding. */
    const CRUMB_DEPTH = 3;

    /**
     * The chain from a few ancestors down to the target, target emphasised.
     *
     * Two jobs: say where you are in the nesting, and make it obvious that
     * wrappers exist at all — before this there was no way to know a
     * same-sized parent was there until you accidentally hit it.
     *
     * Built as elements rather than innerHTML: the text comes from the page.
     */
    function renderBreadcrumb(el: Element) {
      const chain: Element[] = [];
      for (let cur: Element | null = el.parentElement; cur && cur !== document.documentElement; cur = cur.parentElement) {
        chain.unshift(cur);
      }
      const shown = chain.slice(-CRUMB_DEPTH);

      label!.replaceChildren();
      if (chain.length > shown.length) label!.appendChild(crumb('…', false));
      for (const ancestor of shown) {
        label!.appendChild(crumb(describeBrief(ancestor), false));
      }
      label!.appendChild(crumb(describeElement(el), true));
    }

    function crumb(text: string, isTarget: boolean): HTMLSpanElement {
      const span = document.createElement('span');
      span.textContent = text;
      Object.assign(span.style, {
        opacity: isTarget ? '1' : '0.55',
        fontWeight: isTarget ? '600' : '400',
      } as CSSStyleDeclaration);
      if (label!.childNodes.length > 0) {
        const sep = document.createElement('span');
        sep.textContent = ' › ';
        sep.style.opacity = '0.4';
        label!.appendChild(sep);
      }
      return span;
    }

    function highlight(el: Element) {
      ensureOverlay();
      const r = el.getBoundingClientRect();
      Object.assign(box!.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
      renderBreadcrumb(el);
      label!.style.left = `${r.left}px`;
      label!.style.top = `${Math.max(0, r.top - 18)}px`;
    }

    // ---- View Matched Elements (SPEC §8) ----
    //
    // Yellow fill, red outline, on every match. Boxes are position:fixed against
    // the viewport, so they go stale if the page scrolls — acceptable for a
    // 3s lifetime, and the same trade v2.5.1 made.
    let marks: HTMLDivElement[] = [];
    let markTimer: ReturnType<typeof setTimeout> | undefined;
    const HIGHLIGHT_MS = 3000;

    function clearMarks() {
      for (const m of marks) m.remove();
      marks = [];
      if (markTimer) clearTimeout(markTimer);
      markTimer = undefined;
    }

    function highlightAll(targets: Element[]) {
      clearMarks();
      if (targets.length === 0) return;

      // Scroll the FIRST match into view before measuring, or every box after
      // it would be positioned against the pre-scroll viewport.
      targets[0].scrollIntoView({ block: 'center', inline: 'nearest' });

      for (const t of targets) {
        const r = t.getBoundingClientRect();
        const mark = document.createElement('div');
        // Identifies our overlay to tests and to anyone inspecting the page.
        mark.dataset.pageModeller = 'highlight';
        Object.assign(mark.style, {
          position: 'fixed',
          pointerEvents: 'none',
          zIndex: Z,
          left: `${r.left}px`,
          top: `${r.top}px`,
          width: `${r.width}px`,
          height: `${r.height}px`,
          background: 'rgba(255, 235, 59, 0.45)',
          outline: '2px solid #d32f2f',
          outlineOffset: '-1px',
        } as CSSStyleDeclaration);
        document.documentElement.appendChild(mark);
        marks.push(mark);
      }
      markTimer = setTimeout(clearMarks, HIGHLIGHT_MS);
    }

    const onMove = (e: MouseEvent) => {
      if (!active) return;
      const el = e.target as Element | null;
      if (!el || el === hovered) return;
      // Moving the mouse abandons any arrow-key walk and starts again from
      // whatever is under the cursor.
      hovered = el;
      current = el;
      highlight(el);
    };

    /** Commit the current target. Shared by clicking and by Enter. */
    function pickCurrent() {
      if (!active || !current) return;
      const result = generate(current);
      // Both modes are one-shot (SPEC §4) — stop before reporting, so the
      // overlay is gone by the time the panel re-renders.
      stop({ notify: false });
      // Rejects when no panel is open; that's fine, drop it.
      browser.runtime.sendMessage({ type: 'ELEMENT_PICKED', result }).catch(() => {});
    }

    const onClick = (e: MouseEvent) => {
      if (!active) return;
      e.preventDefault();
      e.stopPropagation();
      // The CURRENT target, not e.target: the arrows may have walked away from
      // the element under the cursor, and that is the whole point of them.
      if (!current) current = e.target as Element;
      pickCurrent();
    };

    /** The child of `of` that contains `hovered`, for walking back down. */
    function childTowardsHovered(of: Element): Element | null {
      if (!hovered || of === hovered) return null;
      let cur: Element | null = hovered;
      while (cur && cur.parentElement && cur.parentElement !== of) cur = cur.parentElement;
      return cur?.parentElement === of ? cur : null;
    }

    /**
     * Walk the target up or down the DOM. The mouse alone cannot reliably hit a
     * nested element: a wrapper <div> and the <div role="button"> inside it
     * share a bounding box, so selecting the wrapper meant finding a sliver of
     * padding.
     */
    function moveTarget(direction: 'up' | 'down') {
      if (!active || !current) return;
      const next =
        direction === 'up'
          ? // Stop at <body>: <html> is never a useful target.
            current.parentElement && current.parentElement !== document.documentElement
            ? current.parentElement
            : null
          : childTowardsHovered(current);
      if (!next) return;
      current = next;
      highlight(next);
    }

    const onKey = (e: KeyboardEvent) => {
      if (!active) return;
      if (e.key === 'Escape') return stop();

      if (e.key === 'Enter') {
        // Hands are already on the arrows; Enter is the obvious commit.
        e.preventDefault();
        e.stopPropagation();
        return pickCurrent();
      }

      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;

      // Swallow the key even at the ends of the chain, so the page does not
      // scroll out from under a pick that is mid-flight.
      e.preventDefault();
      e.stopPropagation();
      moveTarget(e.key === 'ArrowUp' ? 'up' : 'down');
    };

    function start() {
      if (active) return;
      active = true;
      document.addEventListener('mousemove', onMove, true);
      document.addEventListener('click', onClick, true);
      document.addEventListener('keydown', onKey, true);
    }

    /**
     * `notify: false` when a pick is what stopped us — ELEMENT_PICKED already
     * tells the panel picking is over, and a second message would race it.
     */
    function stop({ notify = true }: { notify?: boolean } = {}) {
      if (!active) return;
      active = false;
      document.removeEventListener('mousemove', onMove, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKey, true);
      removeOverlay();
      if (notify) browser.runtime.sendMessage({ type: 'PICKING_STOPPED' }).catch(() => {});
    }

    browser.runtime.onMessage.addListener((msg: unknown) => {
      if (!isMessage(msg)) return;
      const m = msg as Message;
      if (m.type === 'START_PICKING') start();
      else if (m.type === 'STOP_PICKING') stop();
      else if (m.type === 'CLEAR_HIGHLIGHT') clearMarks();
      else if (m.type === 'MOVE_TARGET') moveTarget(m.direction);
      else if (m.type === 'PICK_TARGET') pickCurrent();
      else if (m.type === 'HIGHLIGHT') {
        // This script runs in every frame, but only the top one answers — a
        // sub-frame with no matches would otherwise report 0 over the top
        // frame's real count. Decided here rather than by the panel passing
        // frameId, so the send is shaped exactly like the ones that work on
        // both browsers. Cross-frame highlighting arrives with SPEC §16.
        if (window.top !== window) return;
        const targets = resolveCandidate(document, m.candidate);
        highlightAll(targets);
        // Answered as a message, not a reply — sendResponse is not portable.
        browser.runtime.sendMessage({ type: 'HIGHLIGHT_RESULT', count: targets.length }).catch(() => {});
      }
    });
  },
});

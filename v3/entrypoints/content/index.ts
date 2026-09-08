import { generate, resolveCandidate, safeRole } from '@/src/engine/candidates';
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
      current = null;
    }

    /**
     * What the tool will classify this element as (SPEC §11), not its raw role
     * attribute. `role="none"` and `presentation` remove an element from the
     * accessibility tree, so they say nothing useful about what you are picking
     * — fall back to the tag, as for anything with no computed role.
     */
    function overlayLabel(el: Element): string {
      const role = safeRole(el);
      return role && role !== 'none' && role !== 'presentation' ? role : el.tagName.toLowerCase();
    }

    function highlight(el: Element) {
      ensureOverlay();
      const r = el.getBoundingClientRect();
      Object.assign(box!.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
      label!.textContent = overlayLabel(el);
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
      if (!el || el === current) return;
      current = el;
      highlight(el);
    };

    const onClick = (e: MouseEvent) => {
      if (!active) return;
      e.preventDefault();
      e.stopPropagation();
      const el = e.target as Element;
      const result = generate(el);
      // Both modes are one-shot (SPEC §4) — stop before reporting, so the
      // overlay is gone by the time the panel re-renders.
      stop({ notify: false });
      // Rejects when no panel is open; that's fine, drop it.
      browser.runtime.sendMessage({ type: 'ELEMENT_PICKED', result }).catch(() => {});
    };

    const onKey = (e: KeyboardEvent) => {
      if (active && e.key === 'Escape') stop();
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

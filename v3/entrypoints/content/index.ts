import { framePathOf, generate, resolveCandidate } from '@/src/engine/candidates';
import { describeBrief, describeElement } from '@/src/engine/describe';
import { collectInteractive } from '@/src/engine/interactive';
import { isMessage, type Message, type PickMode } from '@/src/messaging';
import { frameSelector } from '@/src/locators/frames';
import type { FrameStep } from '@/src/engine/types';

// Inspector overlay: highlight the element under the cursor (like DevTools) and,
// on click, run the locator engine and report the result to the side panel.
export default defineContentScript({
  matches: ['<all_urls>'],
  allFrames: true,
  // A srcdoc iframe's URL is `about:srcdoc`, which `<all_urls>` does not match
  // — so nothing ran inside one and its contents could not be picked at all.
  // Two flags because the browsers spell it differently: Firefox has only
  // match_about_blank, Chrome supersedes it with match_origin_as_fallback,
  // which also covers data: and blob: frames. Both match on the frame's
  // *initiator* origin, so a sandboxed frame is reached too.
  matchAboutBlank: true,
  // Chrome only: Firefox does not know the key, and an unrecognised manifest
  // key is a warning on an AMO submission.
  matchOriginAsFallback: { chrome: true, firefox: undefined },
  main() {
    let active = false;
    /** 'add' takes the element itself; 'scan' takes its interactive children. */
    let mode: PickMode = 'add';
    let includeHidden = false;
    /** Shared by every frame in the tab for this picking session. */
    let nonce = '';
    let box: HTMLDivElement | null = null;
    let label: HTMLDivElement | null = null;
    let current: Element | null = null;
    /** Last element under the cursor; the floor for walking back down. */
    let hovered: Element | null = null;

    const Z = '2147483647';

    /** Identifies this frame to the background; see OVERLAY_SHOWN. */
    const frameToken = Math.random().toString(36).slice(2);

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
      // Only on creation, so this is one message per frame entered, not one
      // per mousemove.
      browser.runtime.sendMessage({ type: 'OVERLAY_SHOWN', token: frameToken }).catch(() => {});
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

    const hasBox = (el: Element) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 || r.height > 0;
    };

    /**
     * Where to draw a match, and whether it is really there.
     *
     * A hidden element has no box to outline, so with `modelHiddenElements` on
     * the eye reported "1 element matches" and drew nothing at all — a true
     * count that looked like a failure. Fall back to the nearest ancestor that
     * does have a box, which at least says *where* on the page the hidden thing
     * lives.
     */
    function markTarget(el: Element): { anchor: Element | null; hidden: boolean } {
      if (hasBox(el)) return { anchor: el, hidden: false };
      for (let cur = el.parentElement; cur; cur = cur.parentElement) {
        if (hasBox(cur)) return { anchor: cur, hidden: true };
      }
      return { anchor: null, hidden: true };
    }

    function drawMark(rect: DOMRect, hidden: boolean, caption?: string) {
      const mark = document.createElement('div');
      // Identifies our overlay to tests and to anyone inspecting the page.
      mark.dataset.pageModeller = 'highlight';
      if (hidden) mark.dataset.hidden = 'true';
      Object.assign(mark.style, {
        position: 'fixed',
        pointerEvents: 'none',
        zIndex: Z,
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        background: 'rgba(255, 235, 59, 0.45)',
        // Dashed, so a stand-in for something you cannot see does not look like
        // the thing itself.
        outline: hidden ? '2px dashed #d32f2f' : '2px solid #d32f2f',
        outlineOffset: '-1px',
      } as CSSStyleDeclaration);

      if (caption) {
        const tag = document.createElement('div');
        tag.textContent = caption;
        Object.assign(tag.style, {
          position: 'absolute',
          left: '0',
          top: '0',
          font: '11px/1.4 ui-monospace, monospace',
          color: '#fff',
          background: '#d32f2f',
          padding: '1px 6px',
          borderRadius: '0 0 3px 0',
          whiteSpace: 'nowrap',
        } as CSSStyleDeclaration);
        mark.appendChild(tag);
      }

      document.documentElement.appendChild(mark);
      marks.push(mark);
      return mark;
    }

    function highlightAll(targets: Element[]): { hidden: number } {
      clearMarks();
      if (targets.length === 0) return { hidden: 0 };

      const placed = targets.map((t) => ({ target: t, ...markTarget(t) }));

      // Scroll the FIRST match into view before measuring, or every box after
      // it would be positioned against the pre-scroll viewport. A hidden
      // element cannot be scrolled to, so scroll to its stand-in.
      placed.find((p) => p.anchor)?.anchor?.scrollIntoView({ block: 'center', inline: 'nearest' });

      let unplaceable = 0;
      for (const { anchor, hidden } of placed) {
        if (!anchor) {
          unplaceable++;
          continue;
        }
        drawMark(anchor.getBoundingClientRect(), hidden, hidden ? 'hidden element' : undefined);
      }

      // Nothing on the page to point at — say so rather than drawing nothing.
      if (unplaceable > 0) {
        const banner = drawMark(new DOMRect(16, 16, 260, 0), true);
        banner.style.height = 'auto';
        banner.style.padding = '8px 10px';
        banner.style.font = '12px/1.4 ui-monospace, monospace';
        banner.style.color = '#4a1010';
        banner.textContent = `${unplaceable} matched element${unplaceable === 1 ? '' : 's'} hidden, with no position on the page`;
      }

      markTimer = setTimeout(clearMarks, HIGHLIGHT_MS);
      return { hidden: placed.filter((p) => p.hidden).length };
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

    const isFrame = (el: Element) => el.localName === 'iframe' || el.localName === 'frame';

    /**
     * Marks the one message this script accepts from another frame. Isolated
     * worlds do not isolate postMessage, so a page could forge this — which is
     * why the handler also requires that a scan is genuinely in progress in
     * this frame. The worst a forgery can then do is what the user was already
     * doing.
     */
    const SCAN_FRAME = '__pageModellerScanFrame';

    window.addEventListener('message', (e: MessageEvent) => {
      const data = e.data as Record<string, unknown> | null;
      if (typeof data !== 'object' || data === null) return;
      // Authenticated by the nonce, not by `active`: a cascading scan reaches
      // frames after the background has already disarmed everyone, and a frame
      // that refused then would be a hole in the middle of the tree.
      if (!nonce || data[SCAN_FRAME] !== nonce) return;
      if (e.source !== window.parent) return;
      scanDocument();
    });

    /** Ask a nested frame to scan itself, and everything below it. */
    function delegateScan(frame: Element) {
      (frame as HTMLIFrameElement).contentWindow?.postMessage({ [SCAN_FRAME]: nonce }, '*');
    }

    /**
     * Everything interactive in THIS document, plus everything in the frames
     * below it. Choosing a frame means choosing its page, and a page includes
     * what it embeds (SPEC §16) — stopping one level down was the surprise.
     *
     * Each frame reports its own haul, so the model simply gains rows as they
     * arrive; nothing has to be collected back up the tree.
     */
    function scanDocument() {
      const root = document.body ?? document.documentElement;
      const results = collectInteractive(root, includeHidden).map(generate);
      const nested = Array.from(document.querySelectorAll('iframe, frame'));
      stop({ notify: false });
      if (results.length > 0) browser.runtime.sendMessage({ type: 'ELEMENTS_PICKED', results }).catch(() => {});
      for (const frame of nested) delegateScan(frame);
    }

    /** Commit the current target. Shared by clicking and by Enter. */
    function pickCurrent() {
      if (!active || !current) return;
      const target = current;
      // Both modes are one-shot (SPEC §4) — stop before reporting, so the
      // overlay is gone by the time the panel re-renders.
      stop({ notify: false });

      // Scanning a frame has to be done BY that frame. An <iframe> has no
      // descendants in this document — its content is a separate document —
      // so collectInteractive finds nothing and the scan silently returns
      // empty. Cross-origin it is worse than awkward: contentDocument throws.
      //
      // So the frame scans itself. It is already armed (START_PICKING reaches
      // every frame) and it knows its own frame path, which is exactly what
      // the elements need.
      if (mode === 'scan' && isFrame(target)) {
        delegateScan(target);
        return;
      }

      // Scanning a frame's own document means the same thing as scanning the
      // frame: everything in it, frames below included. A smaller container
      // inside it does not, which is the boundary rule (SPEC §16).
      if (mode === 'scan' && (target === document.body || target === document.documentElement)) {
        scanDocument();
        return;
      }

      // Scan takes the container's interactive descendants, never the container
      // itself: you are modelling what is inside the section you chose.
      const message =
        mode === 'scan'
          ? { type: 'ELEMENTS_PICKED', results: collectInteractive(target, includeHidden).map(generate) }
          : { type: 'ELEMENT_PICKED', result: generate(target) };

      // Rejects when no panel is open; that's fine, drop it.
      browser.runtime.sendMessage(message).catch(() => {});
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

    /**
     * The pointer left this document — into a child frame, into the parent, or
     * off the window. This script runs in every frame (`allFrames`), so each
     * one draws its own overlay and, without this, leaves it behind: hovering
     * through nested frames stacked a highlight and a breadcrumb in every frame
     * on the way. Only the document under the pointer should show one.
     *
     * A null `relatedTarget` is what distinguishes leaving the document from
     * moving between two elements inside it.
     */
    const onOut = (e: MouseEvent) => {
      if (active && !e.relatedTarget) removeOverlay();
    };

    function start() {
      if (active) return;
      active = true;
      document.addEventListener('mousemove', onMove, true);
      document.addEventListener('mouseout', onOut, true);
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
      document.removeEventListener('mouseout', onOut, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKey, true);
      removeOverlay();
      if (notify) browser.runtime.sendMessage({ type: 'PICKING_STOPPED' }).catch(() => {});
    }

    /**
     * Is this frame the one the element was picked in? Compared by selector
     * rather than by identity: the path in the model was built by this same
     * code, so the strings line up, including the `:root` marker that stands
     * for a cross-origin break.
     */
    function samePath(mine: FrameStep[], theirs: FrameStep[] | undefined): boolean {
      const other = theirs ?? [];
      if (mine.length !== other.length) return false;
      return mine.every((step, i) => frameSelector(step) === frameSelector(other[i]));
    }

    browser.runtime.onMessage.addListener((msg: unknown) => {
      if (!isMessage(msg)) return;
      const m = msg as Message;
      if (m.type === 'START_PICKING') {
        mode = m.mode;
        includeHidden = m.includeHidden;
        nonce = m.nonce;
        start();
      }
      // notify: false — STOP_PICKING only ever comes from the panel or from the
      // background disarming the other frames, and both already know.
      else if (m.type === 'STOP_PICKING') stop({ notify: false });
      else if (m.type === 'OVERLAY_OWNER') {
        // Some other frame is under the pointer now.
        if (m.token !== frameToken) removeOverlay();
      }
      else if (m.type === 'CLEAR_HIGHLIGHT') clearMarks();
      else if (m.type === 'MOVE_TARGET') moveTarget(m.direction);
      else if (m.type === 'PICK_TARGET') pickCurrent();
      else if (m.type === 'HIGHLIGHT') {
        // This script runs in every frame and every frame hears this, so
        // exactly one must answer or a sub-frame's 0 lands on top of the real
        // count. The one that answers is the frame the element was picked in:
        // each recomputes its own path and compares (SPEC §16).
        //
        // Decided here rather than by the panel passing a frameId, so the send
        // is shaped exactly like the ones that work on both browsers — a
        // DevTools panel on Firefox has no `browser.tabs` to target one with.
        // Every frame drops whatever it was showing, including the frames
        // that will not answer: the previous highlight may have been in one of
        // them, and clicking a second eye while the first was still up left
        // both elements marked. Cleared before the path check, or only the
        // answering frame would forget.
        clearMarks();
        if (!samePath(framePathOf(window), m.framePath)) return;
        const targets = resolveCandidate(document, m.candidate);
        const { hidden } = highlightAll(targets);
        // Answered as a message, not a reply — sendResponse is not portable.
        browser.runtime.sendMessage({ type: 'HIGHLIGHT_RESULT', count: targets.length, hidden }).catch(() => {});
      }
    });
  },
});

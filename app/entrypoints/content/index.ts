import { generate } from '@/src/engine/candidates';
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

    function highlight(el: Element) {
      ensureOverlay();
      const r = el.getBoundingClientRect();
      Object.assign(box!.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
      const role = (el as HTMLElement).getAttribute('role') ?? el.tagName.toLowerCase();
      label!.textContent = role;
      label!.style.left = `${r.left}px`;
      label!.style.top = `${Math.max(0, r.top - 18)}px`;
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
      browser.runtime.sendMessage({ type: 'ELEMENT_PICKED', result });
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

    function stop() {
      if (!active) return;
      active = false;
      document.removeEventListener('mousemove', onMove, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKey, true);
      removeOverlay();
      browser.runtime.sendMessage({ type: 'PICKING_STOPPED' });
    }

    browser.runtime.onMessage.addListener((msg: unknown) => {
      if (!isMessage(msg)) return;
      const m = msg as Message;
      if (m.type === 'START_PICKING') start();
      else if (m.type === 'STOP_PICKING') stop();
    });
  },
});

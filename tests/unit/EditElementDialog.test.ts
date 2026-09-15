// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { Quasar, QBtn, QTooltip, QDialog, QCard, QCardSection, QCardActions, QInput, QSelect, QToolbar, QToolbarTitle, ClosePopup } from 'quasar';
import EditElementDialog from '../../ui/EditElementDialog.vue';
import type { ModelElement } from '../../src/model';

const element: ModelElement = {
  id: 'el-0',
  name: 'SignIn',
  tag: 'button',
  role: 'button',
  accessibleName: 'Sign in',
  suggestedName: 'SignIn',
  selectedIndex: 0,
  preferredIndex: 0,
  candidates: [
    { candidate: { kind: 'role', role: 'button', name: 'Sign in', exact: true }, predictedCount: 1 },
    { candidate: { kind: 'css', value: 'button.submit' }, predictedCount: 1 },
  ],
};

function render(props: Partial<Parameters<typeof EditElementDialog>[0]> = {}) {
  return mount(EditElementDialog, {
    props: { element, frameworkId: 'playwright-ts', takenNames: [], ...props } as never,
    global: {
      plugins: [Quasar],
      // `v-close-popup` is a Quasar directive, and registering the components
      // does not register it. Without this every mount logs a resolve warning.
      directives: { ClosePopup },
      components: { QBtn, QTooltip, QDialog, QCard, QCardSection, QCardActions, QInput, QSelect, QToolbar, QToolbarTitle },
      stubs: { QTooltip: true },
    },
    attachTo: document.body,
  });
}

const vm = (w: ReturnType<typeof render>) => w.vm as unknown as Record<string, never>;

describe('EditElementDialog', () => {
  it('opens on the element\'s active locator', () => {
    const w = render();
    expect(vm(w).kind).toBe('role');
    expect(vm(w).values).toEqual({ role: 'button', name: 'Sign in' });
  });

  it('asks for two fields for role, one for css (SPEC §12)', async () => {
    const w = render();
    expect((vm(w).fields as unknown as { key: string }[]).map((f) => f.key)).toEqual(['role', 'name']);
    (w.vm as unknown as { kind: string }).kind = 'css';
    await w.vm.$nextTick();
    expect((vm(w).fields as unknown as { key: string }[]).map((f) => f.key)).toEqual(['value']);
  });

  it('prefills from a generated candidate of the chosen type', async () => {
    const w = render();
    (w.vm as unknown as { kind: string }).kind = 'css';
    await w.vm.$nextTick();
    expect(vm(w).values).toEqual({ value: 'button.submit' });
  });

  it('blanks the field when nothing was generated for that type (SPEC §7)', async () => {
    const w = render();
    (w.vm as unknown as { kind: string }).kind = 'testId';
    await w.vm.$nextTick();
    expect(vm(w).values).toEqual({ value: '' });
  });

  it('offers the full framework list, not just what was generated', () => {
    const w = render();
    const options = (vm(w).typeOptions as unknown as { value: string }[]).map((o) => o.value);
    expect(options).toContain('testId');
    expect(options).toContain('xpath');
    expect(options).not.toContain('linkText');
  });

  it('offers Selenium strategies when that is the framework', () => {
    const w = render({ frameworkId: 'selenium-java' } as never);
    const options = (vm(w).typeOptions as unknown as { value: string }[]).map((o) => o.value);
    expect(options).toContain('linkText');
  });

  describe('name validation', () => {
    const cases: Array<[string, string, string]> = [
      ['rejects empty', '  ', 'Name is required.'],
      ['rejects spaces', 'Sign In', 'Name cannot contain spaces.'],
      ['rejects a duplicate', 'About', 'Name must be unique.'],
      ['accepts a good name', 'SignInButton', ''],
    ];
    for (const [label, value, expected] of cases) {
      it(label, async () => {
        const w = render({ takenNames: ['About'] } as never);
        (w.vm as unknown as { name: string }).name = value;
        await w.vm.$nextTick();
        expect(vm(w).nameError).toBe(expected);
      });
    }
  });

  it('saves a hand-typed locator as an override', async () => {
    const w = render();
    (w.vm as unknown as { kind: string }).kind = 'css';
    await w.vm.$nextTick();
    (w.vm as unknown as { values: Record<string, string> }).values.value = 'button.pay';
    await w.vm.$nextTick();
    (w.vm as unknown as { save: () => void }).save();
    expect(w.emitted('save')![0][0]).toEqual({ name: 'SignIn', selectedIndex: 0, override: { kind: 'css', value: 'button.pay' } });
  });

  it('saves a locator matching a generated one as a selection, not an override', async () => {
    // Otherwise it would stop tracking the engine's own verification.
    const w = render();
    (w.vm as unknown as { kind: string }).kind = 'css';
    await w.vm.$nextTick();
    (w.vm as unknown as { save: () => void }).save();
    expect(w.emitted('save')![0][0]).toEqual({ name: 'SignIn', selectedIndex: 1, override: undefined });
  });

  it('keeps exact: true on a hand-edited text locator (SPEC §12)', async () => {
    const w = render();
    (w.vm as unknown as { kind: string }).kind = 'text';
    await w.vm.$nextTick();
    (w.vm as unknown as { values: Record<string, string> }).values.text = 'Sign in';
    await w.vm.$nextTick();
    (w.vm as unknown as { save: () => void }).save();
    expect((w.emitted('save')![0][0] as { override: { exact: boolean } }).override.exact).toBe(true);
  });

  describe('an incomplete locator is neither testable nor saveable', () => {
    it('blocks a blank required field', async () => {
      // Blank does not mean "match anything": an empty `label` matches every
      // control with no accessible name, which reported 8 matches for a field
      // the user had not filled in.
      const w = render();
      (w.vm as unknown as { kind: string }).kind = 'label';
      await w.vm.$nextTick();
      expect(vm(w).locatorComplete).toBe(false);
      (w.vm as unknown as { save: () => void }).save();
      expect(w.emitted('save')).toBeUndefined();
    });

    it('allows a blank accessible name, which getByRole permits', async () => {
      // getByRole('navigation') is a real locator.
      const w = render();
      (w.vm as unknown as { values: Record<string, string> }).values.name = '';
      await w.vm.$nextTick();
      expect(vm(w).locatorComplete).toBe(true);
    });

    it('blocks a blank role even though the name is optional', async () => {
      const w = render();
      (w.vm as unknown as { values: Record<string, string> }).values.role = '';
      await w.vm.$nextTick();
      expect(vm(w).locatorComplete).toBe(false);
    });

    it('treats whitespace as blank', async () => {
      const w = render();
      (w.vm as unknown as { kind: string }).kind = 'css';
      await w.vm.$nextTick();
      (w.vm as unknown as { values: Record<string, string> }).values.value = '   ';
      await w.vm.$nextTick();
      expect(vm(w).locatorComplete).toBe(false);
    });
  });

  it('refuses to save an invalid name', async () => {
    const w = render();
    (w.vm as unknown as { name: string }).name = '';
    await w.vm.$nextTick();
    (w.vm as unknown as { save: () => void }).save();
    expect(w.emitted('save')).toBeUndefined();
  });

  it('emits the in-progress locator for the eye, not the saved one', async () => {
    const w = render();
    (w.vm as unknown as { kind: string }).kind = 'css';
    await w.vm.$nextTick();
    (w.vm as unknown as { values: Record<string, string> }).values.value = 'button.draft';
    await w.vm.$nextTick();
    expect(vm(w).candidate).toEqual({ kind: 'css', value: 'button.draft' });
  });
});

describe('the shadow host chain (SPEC §19)', () => {
  const inShadow = (hosts: string[]): ModelElement =>
    ({
      ...element,
      shadowPath: hosts.map((value) => ({ host: { kind: 'css' as const, value } })),
    }) as ModelElement;

  /**
   * Mount and wait for the dialog to appear.
   *
   * QDialog renders through a portal, which lands in the document rather than
   * in the wrapper and not until a tick has passed — which is why every test
   * above reads the vm instead. These are about markup, so they have to wait
   * for it, and unmount afterwards or the next query finds the last one's
   * dialog still in the body.
   */
  async function open(el?: ModelElement) {
    const w = el ? render({ element: el }) : render();
    await w.vm.$nextTick();
    await new Promise((r) => setTimeout(r, 0));
    return {
      row: () => document.querySelector('[data-testid="edit-shadow"]'),
      inputs: () => document.querySelectorAll('.q-dialog input'),
      done: () => w.unmount(),
    };
  }

  it('is shown, because it is part of the generated locator', async () => {
    // Until this, the only way to discover that an element was inside a web
    // component was to open the code dialog: the table and this dialog both
    // showed the element's own locator and nothing else.
    const d = await open(inShadow(['clg-text-input[name="email"]']));
    expect(d.row()).not.toBeNull();
    expect(d.row()!.textContent).toContain('clg-text-input[name="email"]');
    d.done();
  });

  it('shows every host, outermost first', async () => {
    const d = await open(inShadow(['outer-panel', 'inner-field']));
    const text = d.row()!.textContent ?? '';
    expect(text.indexOf('outer-panel')).toBeLessThan(text.indexOf('inner-field'));
    d.done();
  });

  it('is read-only, like the frame chain', async () => {
    // A host is where the element IS, not how it is found within the
    // component, so editing it would be editing the page. The element's own
    // locator stays editable, which is the part a user can meaningfully change.
    const d = await open(inShadow(['clg-text-input']));
    expect(d.row()!.querySelectorAll('input')).toHaveLength(0);
    expect(d.inputs().length, 'the element locator is still editable').toBeGreaterThan(0);
    d.done();
  });

  it('is absent for an element in the light DOM', async () => {
    const d = await open();
    expect(d.row()).toBeNull();
    d.done();
  });
});

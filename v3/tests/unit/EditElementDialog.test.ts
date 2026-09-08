// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { Quasar, QBtn, QTooltip, QDialog, QCard, QCardSection, QCardActions, QInput, QSelect, QToolbar, QToolbarTitle } from 'quasar';
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

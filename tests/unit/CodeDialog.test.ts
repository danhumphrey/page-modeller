// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import { Quasar, QBtn, QBtnToggle, QDialog, QCard, QCardSection, QCardActions, QToolbar, QToolbarTitle, ClosePopup } from 'quasar';
import CodeDialog from '../../ui/CodeDialog.vue';
import { emptyModel, type ModelElement, type TabModel } from '../../src/model';
import { frameworks } from '../../src/frameworks';

function modelWith(frameworkId: string, ...elements: Array<Partial<ModelElement> & { name: string }>): TabModel {
  const m = emptyModel(frameworkId);
  m.elements = elements.map((el, i) => ({
    id: `el-${i}`,
    tag: 'input',
    role: 'textbox',
    accessibleName: el.name,
    suggestedName: el.name,
    selectedIndex: 0,
    preferredIndex: 0,
    candidates: [{ candidate: { kind: 'id', value: 'x' }, predictedCount: 1 }],
    ...el,
  })) as ModelElement[];
  return m;
}

// QDialog teleports its content, so it is not in the DOM until a tick has
// passed — and it stays there afterwards, so each test has to clear up or the
// next one reads the last one's dialog.
let wrapper: ReturnType<typeof mount> | undefined;

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  document.body.innerHTML = '';
});

async function render(model: TabModel, shape?: string, className?: string) {
  wrapper = mount(CodeDialog, {
    props: { model, shape, className },
    global: {
      plugins: [Quasar],
      // `v-close-popup` is a Quasar directive, and registering the components
      // does not register it. Without this every mount logs a resolve warning.
      directives: { ClosePopup },
      components: { QBtn, QBtnToggle, QDialog, QCard, QCardSection, QCardActions, QToolbar, QToolbarTitle },
    },
    attachTo: document.body,
  }) as ReturnType<typeof mount>;
  await nextTick();
  return wrapper;
}

const codeText = () => document.body.querySelector('[data-testid="code-output"]')?.textContent ?? '';

/** Click one of the shape toggle's buttons by its label. */
async function chooseShape(label: string) {
  const buttons = document.body.querySelectorAll('[data-testid="code-shape"] button');
  const button = [...buttons].find((b) => b.textContent?.trim() === label);
  if (!button) throw new Error(`no shape button labelled ${label}`);
  (button as HTMLElement).click();
  await nextTick();
}

describe('CodeDialog', () => {
  it('is titled with the framework, as v2.5.1 was', async () => {
    await render(modelWith('selenium-java', { name: 'Email' }));
    expect(document.body.textContent).toContain('Selenium WebDriver Java');
  });

  it('shows the generated code for the model', async () => {
    await render(modelWith('selenium-java', { name: 'Email' }));
    expect(codeText()).toContain('public WebElement getEmailElement() {');
    expect(codeText()).toContain('public void setEmail(String value) {');
  });

  it('generates for Playwright too', async () => {
    await render(modelWith('playwright-ts', { name: 'Email' }));
    expect(codeText()).toContain('readonly email: Locator;');
  });

  it('keeps the shape control out of the title row', async () => {
    // Three shapes plus Copy alongside the title truncated it to "Seleniu…" in
    // the sidebar, which has no width to share.
    await render(modelWith('selenium-java', { name: 'Email' }));
    const toggle = document.body.querySelector('[data-testid="code-shape"]');
    expect(toggle).not.toBeNull();
    expect(toggle!.closest('.dialog-header')).toBeNull();
  });

  it('offers no shape row when the framework has one shape', async () => {
    // No framework has one today; the row must still not appear if one does.
    await render(modelWith('selenium-java', { name: 'Email' }));
    expect(document.body.querySelectorAll('[data-testid="code-shape"]').length).toBe(1);
  });

  it('reopens on the shape last chosen', async () => {
    // Someone who works in locators-only should not pick it every time.
    await render(modelWith('selenium-java', { name: 'Email' }));
    await chooseShape('Locators only');
    expect(wrapper!.emitted('update:shape')?.at(-1)).toEqual(['locators']);

    // What the panel hands back next time.
    wrapper!.unmount();
    document.body.innerHTML = '';
    await render(modelWith('selenium-java', { name: 'Email' }), 'locators');
    expect(codeText()).toContain('private final By email');
  });

  it('falls back when the remembered shape is not on offer', async () => {
    // `methods` means nothing to Playwright, and a dialog opening on nothing
    // would be worse than one opening on its default.
    await render(modelWith('playwright-ts', { name: 'Email' }), 'methods');
    expect(codeText()).toContain('export class');
  });

  it('names the class from the URL, and lets you say otherwise', async () => {
    // `/checkout/step2` yields `Step2Page`, and the name only ever appears in
    // generated code — so correcting it afterwards means correcting it again
    // on every regeneration.
    const model = modelWith('playwright-ts', { name: 'Email' });
    model.url = 'https://example.com/account/login.html';
    await render(model);
    expect(codeText()).toContain('export class LoginPage {');

    // QDialog teleports, so a second mount would sit alongside the first.
    wrapper!.unmount();
    document.body.innerHTML = '';
    await render(model, undefined, 'CheckoutPage');
    expect(codeText()).toContain('export class CheckoutPage {');
    // The model is untouched: this is about the code being read, not the
    // elements captured.
    expect(model.className).toBeUndefined();
  });

  it('offers no name where no class is emitted', async () => {
    const model = modelWith('playwright-ts', { name: 'Email' });
    await render(model);
    expect(document.body.querySelector('[data-testid="code-class-name"]')).not.toBeNull();
    await chooseShape('Locators only');
    expect(document.body.querySelector('[data-testid="code-class-name"]')).toBeNull();
  });

  it('switches shape without touching the model', async () => {
    const model = modelWith('playwright-ts', { name: 'Email' });
    await render(model);
    await chooseShape('Locators only');
    expect(codeText()).toContain('const email = page.');
    expect(codeText()).not.toContain('export class');
    expect(model.elements).toHaveLength(1);
  });

  it('generates something for every framework in the selector', async () => {
    // An empty dialog looks broken, and a framework in the toolbar that
    // produces nothing is worse than one that is not offered.
    for (const f of frameworks) {
      await render(modelWith(f.id, { name: 'Email' }));
      expect(codeText(), f.label).not.toBe('');
      wrapper?.unmount();
      document.body.innerHTML = '';
    }
  });

  it('renders an empty model without failing', async () => {
    await render(emptyModel('selenium-java'));
    expect(codeText()).toBe('');
  });
});

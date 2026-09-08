// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import { Quasar, QBtn, QBtnToggle, QDialog, QCard, QCardSection, QCardActions, QToolbar, QToolbarTitle } from 'quasar';
import CodeDialog from '../../ui/CodeDialog.vue';
import { emptyModel, type ModelElement, type TabModel } from '../../src/model';

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

async function render(model: TabModel) {
  wrapper = mount(CodeDialog, {
    props: { model },
    global: {
      plugins: [Quasar],
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

  it('switches shape without touching the model', async () => {
    const model = modelWith('playwright-ts', { name: 'Email' });
    await render(model);
    await chooseShape('Locators only');
    expect(codeText()).toContain('const email = page.');
    expect(codeText()).not.toContain('export class');
    expect(model.elements).toHaveLength(1);
  });

  it('says which target is missing rather than showing nothing', async () => {
    // Not every target exists yet; an empty dialog would look broken.
    await render(modelWith('puppeteer', { name: 'Email' }));
    expect(codeText()).toContain('Puppeteer is not generated yet');
    expect(codeText()).toContain('Available so far:');
  });

  it('renders an empty model without failing', async () => {
    await render(emptyModel('selenium-java'));
    expect(codeText()).toBe('');
  });
});

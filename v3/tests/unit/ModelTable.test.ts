// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { Quasar, QBtn, QTooltip } from 'quasar';
import ModelTable, { type ModelRow } from '../../ui/ModelTable.vue';

const rows: ModelRow[] = [
  { id: 'a', name: 'SignIn', locator: "getByRole('button', { name: 'Sign in', exact: true })" },
  { id: 'b', name: 'About', locator: "getByRole('link', { name: 'About', exact: true })" },
];

function render(props: Partial<{ elements: ModelRow[]; clickToHighlight: boolean }> = {}) {
  return mount(ModelTable, {
    props: { elements: rows, clickToHighlight: false, ...props },
    // @quasar/vite-plugin auto-imports Quasar components when building; in a
    // test they have to be registered by hand or they render as unknown
    // elements and every query for a real <button> misses.
    global: { plugins: [Quasar], components: { QBtn, QTooltip }, stubs: { QTooltip: true } },
  });
}

describe('ModelTable', () => {
  it('renders a row per element', () => {
    expect(render().findAll('tbody tr')).toHaveLength(2);
  });

  it('shows the empty state when there is nothing modelled', () => {
    const w = render({ elements: [] });
    expect(w.find('[data-testid="empty-state"]').text()).toContain('Scan the page or start adding elements');
  });

  it('keeps each row on one line', () => {
    // Regression: `class="row"` collided with Quasar's flex grid utility and
    // stacked every cell onto its own line.
    const cells = render().findAll('tbody tr')[0].findAll('td');
    expect(cells).toHaveLength(3);
    expect(cells.some((c) => c.classes().includes('row'))).toBe(false);
  });

  it('does NOT highlight on row click by default (SPEC §6)', () => {
    const w = render({ clickToHighlight: false });
    w.findAll('tbody tr')[0].trigger('click');
    expect(w.emitted('highlight')).toBeUndefined();
  });

  it('highlights on row click when the setting is on', () => {
    const w = render({ clickToHighlight: true });
    w.findAll('tbody tr')[0].trigger('click');
    expect(w.emitted('highlight')).toEqual([['a']]);
  });

  it('always opens the editor on double-click', () => {
    const w = render({ clickToHighlight: false });
    w.findAll('tbody tr')[1].trigger('dblclick');
    expect(w.emitted('edit')).toEqual([['b']]);
  });

  it('emits from the row action buttons regardless of the setting', async () => {
    const w = render({ clickToHighlight: false });
    const buttons = w.findAll('tbody tr')[0].findAll('button');
    await buttons[0].trigger('click');
    await buttons[2].trigger('click');
    expect(w.emitted('highlight')).toEqual([['a']]);
    expect(w.emitted('remove')).toEqual([['a']]);
  });
});

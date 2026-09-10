import { describe, it, expect } from 'vitest';
import { ref } from 'vue';
import { activeCandidate, type ModelElement } from '../../src/model';

// Firefox serialises extension messages with the structured clone algorithm.
// Vue wraps reactive state in Proxies, and structured clone throws
// DataCloneError on a Proxy — while Chrome's message path tolerates it. So a
// message carrying model data failed on Firefox only, and looked like an
// unreachable tab.
describe('message payloads must survive structured clone', () => {
  const element: ModelElement = {
    id: 'el-0',
    name: 'Home',
    tag: 'a',
    role: 'link',
    accessibleName: 'Home',
    suggestedName: 'Home',
    selectedIndex: 0,
    candidates: [{ candidate: { kind: 'role', role: 'link', name: 'Home', exact: true }, predictedCount: 1 }],
    preferredIndex: 0,
  };

  it('a candidate read from reactive state is not cloneable', () => {
    const reactive = ref<ModelElement[]>([element]);
    const fromRef = activeCandidate(reactive.value[0]);
    expect(() => structuredClone(fromRef)).toThrow();
  });

  it('the JSON round-trip we send is cloneable and identical', () => {
    const reactive = ref<ModelElement[]>([element]);
    const payload = JSON.parse(JSON.stringify({ type: 'HIGHLIGHT', candidate: activeCandidate(reactive.value[0]) }));
    expect(() => structuredClone(payload)).not.toThrow();
    expect(payload.candidate).toEqual({ kind: 'role', role: 'link', name: 'Home', exact: true });
  });
});

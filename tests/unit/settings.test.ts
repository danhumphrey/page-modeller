import { describe, it, expect, vi, beforeEach } from 'vitest';

// Settings survive a browser that does not offer storage where it is asked for
// it. `loadSettings` was already guarded; `watchSettings` was not, and it is
// the one called from the top of the content script — so a throw there does
// not lose a setting, it takes the whole script with it and every page then
// reports "Page Modeller can't reach this page".

/** What `browser.storage` answers with; a test may replace it. */
let storage: Record<string, unknown>;

vi.mock('wxt/browser', () => ({
  browser: {
    get storage() {
      return storage;
    },
  },
}));

const fresh = async () => {
  vi.resetModules();
  return import('@/src/settings');
};

const working = () => ({
  sync: { get: () => Promise.resolve({}), set: () => Promise.resolve() },
  onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
});

beforeEach(() => {
  storage = working();
});

describe('watchSettings', () => {
  it('subscribes when storage.onChanged is there', async () => {
    const { watchSettings } = await fresh();

    const stop = watchSettings(() => {});

    const onChanged = (storage.onChanged as { addListener: ReturnType<typeof vi.fn> }).addListener;
    expect(onChanged).toHaveBeenCalledOnce();
    stop();
    expect((storage.onChanged as { removeListener: ReturnType<typeof vi.fn> }).removeListener).toHaveBeenCalledOnce();
  });

  it('reports only sync changes to this key', async () => {
    const { watchSettings, defaultSettings } = await fresh();
    const seen: unknown[] = [];
    watchSettings((s) => seen.push(s));
    const listener = (storage.onChanged as { addListener: ReturnType<typeof vi.fn> }).addListener.mock.calls[0]![0] as (
      changes: Record<string, { newValue?: unknown }>,
      area: string
    ) => void;

    listener({ options: { newValue: { testIdAttribute: 'data-qa' } } }, 'local');
    listener({ models: { newValue: {} } }, 'sync');
    expect(seen, 'the wrong area and the wrong key').toHaveLength(0);

    listener({ options: { newValue: { testIdAttribute: 'data-qa' } } }, 'sync');
    // Merged over the defaults, so a setting the stored object predates still
    // has a value.
    expect(seen).toEqual([{ ...defaultSettings, testIdAttribute: 'data-qa' }]);
  });

  it('does not throw where storage.onChanged does not exist', async () => {
    // A Firefox devtools document is granted `devtools.*`, `runtime.*` and
    // little else — the same shape as the `browser.tabs` gap the panel already
    // routes around, and just as invisible on Chrome.
    storage = { sync: working().sync };
    const { watchSettings } = await fresh();

    let stop: () => void = () => {};
    expect(() => (stop = watchSettings(() => {}))).not.toThrow();
    // And the unsubscribe it hands back is safe to call.
    expect(() => stop()).not.toThrow();
  });

  it('does not throw where storage itself is absent', async () => {
    storage = undefined as unknown as Record<string, unknown>;
    const { watchSettings } = await fresh();

    expect(() => watchSettings(() => {})()).not.toThrow();
  });
});

describe('loadSettings', () => {
  it('falls back to the defaults when sync storage refuses the read', async () => {
    storage = { sync: { get: () => Promise.reject(new Error('over quota')) } };
    const { loadSettings, defaultSettings } = await fresh();

    await expect(loadSettings()).resolves.toEqual(defaultSettings);
  });

  it('merges what is stored over the defaults', async () => {
    storage = { sync: { get: () => Promise.resolve({ options: { testIdAttribute: 'data-qa' } }) } };
    const { loadSettings, defaultSettings } = await fresh();

    await expect(loadSettings()).resolves.toEqual({ ...defaultSettings, testIdAttribute: 'data-qa' });
  });
});

describe('saveSettings', () => {
  it('rejects rather than swallowing a refused write', async () => {
    // The opposite choice to loadSettings, deliberately: a read that fails has
    // a sensible answer and a write that fails has none, so the caller has to
    // be able to say so.
    storage = { sync: { set: () => Promise.reject(new Error('QUOTA_BYTES_PER_ITEM')) } };
    const { saveSettings, defaultSettings } = await fresh();

    await expect(saveSettings(defaultSettings)).rejects.toThrow();
  });
});

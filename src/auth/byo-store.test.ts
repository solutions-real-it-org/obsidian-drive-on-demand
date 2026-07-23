import { describe, it, expect } from 'vitest';
import { ByoCredentialsStore } from './byo-store';
import type { PersistAdapter } from './token-store';

function ad() {
  const raw: Record<string, unknown> = {};
  const a: PersistAdapter = { async load() { return raw; }, async save(d) { Object.keys(raw).forEach((k) => delete raw[k]); Object.assign(raw, d); } };
  return { a, raw };
}

describe('ByoCredentialsStore', () => {
  it('get() renvoie null quand rien n est configuré', async () => {
    const store = new ByoCredentialsStore(ad().a);
    expect(await store.get()).toBeNull();
  });

  it('set() puis get() restitue les identifiants (secret dé-obfusqué)', async () => {
    const { a, raw } = ad();
    const store = new ByoCredentialsStore(a);
    await store.set({ clientId: '  cid  ', clientSecret: '  sec  ' });
    expect(await store.get()).toEqual({ clientId: 'cid', clientSecret: 'sec' });
    // le secret n'est pas en clair dans le blob persisté
    expect(raw.clientSecret).not.toBe('sec');
  });

  it('clear() supprime les identifiants → retour au mode broker', async () => {
    const store = new ByoCredentialsStore(ad().a);
    await store.set({ clientId: 'cid', clientSecret: 'sec' });
    await store.clear();
    expect(await store.get()).toBeNull();
  });

  it('get() renvoie null si client_id présent mais secret vide (config incomplète)', async () => {
    const { a } = ad();
    const store = new ByoCredentialsStore(a);
    await store.set({ clientId: 'cid', clientSecret: '' });
    expect(await store.get()).toBeNull();
  });
});

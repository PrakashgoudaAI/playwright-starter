import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SessionStore } from '../../examples/demo-app/session-store.ts';

test('simultaneous logins own separate task objects and identifiers', () => {
  const store = new SessionStore();
  const first = store.issue('editor');
  const second = store.issue('editor');
  assert.notEqual(first.token, second.token);
  assert.notEqual(first.session.tasks[0]!.id, second.session.tasks[0]!.id);
  first.session.tasks[0]!.done = true;
  assert.equal(second.session.tasks[0]!.done, false);
});

test('rotating a session invalidates its previous token', () => {
  const store = new SessionStore();
  const first = store.issue('editor');
  const rotated = store.issue('viewer', first.token);
  assert.equal(store.find(first.token), undefined);
  assert.equal(store.find(rotated.token)?.role, 'viewer');
});

test('revoking one session preserves another active session', () => {
  const store = new SessionStore();
  const first = store.issue('editor');
  const second = store.issue('viewer');
  store.revoke(first.token);
  assert.equal(store.find(first.token), undefined);
  assert.equal(store.find(second.token), second.session);
});

test('expiry is enforced at the exact deadline without sleeps', () => {
  let now = 1000;
  const store = new SessionStore(() => now, 100);
  const issued = store.issue('viewer');
  now = 1099;
  assert.equal(store.find(issued.token), issued.session);
  now = 1100;
  assert.equal(store.find(issued.token), undefined);
  now = 1000;
  assert.equal(store.find(issued.token), undefined, 'An expired token cannot become valid again.');
});

test('sweeping removes expired sessions and retains newer sessions', () => {
  let now = 0;
  const store = new SessionStore(() => now, 100);
  const old = store.issue('editor');
  now = 50;
  const fresh = store.issue('viewer');
  now = 100;
  assert.equal(store.purgeExpired(), 1);
  assert.equal(store.find(old.token), undefined);
  assert.equal(store.find(fresh.token), fresh.session);
  assert.equal(store.purgeExpired(), 0);
});

test('unknown tokens and invalid lifetime values fail safely', () => {
  const store = new SessionStore();
  assert.equal(store.find('unknown'), undefined);
  assert.equal(store.find(), undefined);
  assert.doesNotThrow(() => { store.revoke('unknown'); store.revoke(); });
  for (const lifetime of [0, -1, NaN, Infinity]) {
    assert.throws(() => new SessionStore(Date.now, lifetime), /lifetime/);
  }
});

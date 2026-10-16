import { randomUUID } from 'node:crypto';
import type { Role } from './accounts.ts';

export type Task = { id: string; title: string; priority: 'normal' | 'high'; done: boolean };
export type Session = { role: Role; expires: number; tasks: Task[] };

// Demo application state, not an automation-framework abstraction.
export class SessionStore {
  private readonly sessions = new Map<string, Session>();
  private readonly now: () => number;
  private readonly lifetimeMs: number;

  constructor(now: () => number = Date.now, lifetimeMs = 15 * 60_000) {
    if (!Number.isFinite(lifetimeMs) || lifetimeMs <= 0) throw new Error('Session lifetime must be positive.');
    this.now = now;
    this.lifetimeMs = lifetimeMs;
  }

  issue(role: Role, previousToken?: string): { token: string; session: Session } {
    this.revoke(previousToken);
    const token = randomUUID();
    const session: Session = {
      role,
      expires: this.now() + this.lifetimeMs,
      tasks: [{ id: randomUUID(), title: 'Review test plan', priority: 'normal', done: false }],
    };
    this.sessions.set(token, session);
    return { token, session };
  }

  find(token?: string): Session | undefined {
    if (!token) return undefined;
    const session = this.sessions.get(token);
    if (session && session.expires <= this.now()) {
      this.sessions.delete(token);
      return undefined;
    }
    return session;
  }

  revoke(token?: string): void {
    if (token) this.sessions.delete(token);
  }

  purgeExpired(): number {
    const now = this.now();
    let removed = 0;
    for (const [token, session] of this.sessions) {
      if (session.expires <= now) {
        this.sessions.delete(token);
        removed++;
      }
    }
    return removed;
  }
}

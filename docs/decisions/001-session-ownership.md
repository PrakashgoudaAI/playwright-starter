# Session ownership and expiry

Status: accepted for the local demo.

## Problem

Parallel tests must not alter another test's task data. Authentication tests must also distinguish a cookie existing from a session actually being valid on the server.

## Decision

Each successful login creates a new opaque token and an independent task list. The server looks up tasks only inside that authenticated session. A task ID from another session returns 404; knowing an ID does not grant access or reveal whether it exists elsewhere.

Signing in again with the current cookie invalidates that previous session. Logout invalidates only the presented session. Expiry is enforced on lookup at `expires <= now`, while a periodic sweep releases expired state that is never requested again.

The small session store belongs to the demo application. It is not an automation framework layer. An injected clock lets unit tests exercise exact expiry boundaries without waiting 15 minutes or changing global time.

## Alternatives and trade-offs

- A shared editor account with shared tasks would resemble many real applications more closely, but requires per-test data ownership and cleanup.
- A shared authentication file is convenient for read-only tests but does not solve shared mutable data.
- A database-backed session store supports persistence and multiple server instances, but adds lifecycle and infrastructure work that this milestone does not implement.

The chosen design loses data on logout, rotation, expiry, or server restart. It demonstrates isolated test state, not production account persistence or multi-tenant identity. These limits must remain visible in the README.

## Evidence

Node.js tests cover expiry, rotation, revocation, and independent state. API tests cover cookie rotation, retained access from another active session, and denied cross-session task reads and mutations. Browser tests exercise the user-facing sign-in boundary and role-specific controls.

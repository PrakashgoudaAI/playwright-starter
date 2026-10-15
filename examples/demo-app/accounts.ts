// Public demonstration accounts. Never connect these to a real identity provider.
export const accounts = {
  viewer: { email: 'viewer@example.test', password: 'demo-only-password' },
  editor: { email: 'editor@example.test', password: 'demo-only-password' },
} as const;

export type Role = keyof typeof accounts;

export function readEnvironment(env: NodeJS.ProcessEnv = process.env) {
  const raw = env.DEMO_PORT ?? '4173';
  if (!/^\d+$/.test(raw) || Number(raw) < 1024 || Number(raw) > 65535) {
    throw new Error('DEMO_PORT must be an integer from 1024 to 65535.');
  }
  const port = Number(raw);
  return { port, baseURL: `http://127.0.0.1:${port}` } as const;
}

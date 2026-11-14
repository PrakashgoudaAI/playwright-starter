function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid manifest object.");
  return value as Record<string, unknown>;
}
function ids(value: unknown): string[] {
  if (
    !Array.isArray(value) ||
    !value.length ||
    value.some((id) => typeof id !== "string" || !id) ||
    new Set(value).size !== value.length
  )
    throw new Error("Test IDs must be nonempty and unique.");
  return value as string[];
}
export function verifyShards(
  planValue: unknown,
  manifestValues: unknown[],
  expectedRun: string,
  expectedShards: number,
) {
  const plan = object(planValue);
  if (
    !expectedRun ||
    !Number.isInteger(expectedShards) ||
    expectedShards < 1 ||
    plan.schemaVersion !== 1 ||
    plan.runId !== expectedRun
  )
    throw new Error("Invalid expected plan identity.");
  const expected = ids(plan.testIds);
  if (manifestValues.length !== expectedShards)
    throw new Error("Missing or extra shard manifests.");
  const indexes = new Set<number>(),
    seen = new Set<string>();
  for (const value of manifestValues) {
    const shard = object(value);
    if (
      shard.schemaVersion !== 1 ||
      shard.runId !== expectedRun ||
      shard.total !== expectedShards ||
      !Number.isInteger(shard.index) ||
      typeof shard.index !== "number" ||
      shard.index < 1 ||
      shard.index > expectedShards ||
      indexes.has(shard.index)
    )
      throw new Error("Shard identity mismatch or duplicate index.");
    indexes.add(shard.index);
    if (shard.status !== "passed") throw new Error("A shard did not pass.");
    const planned = ids(shard.testIds);
    if (
      !Array.isArray(shard.results) ||
      shard.results.length !== planned.length
    )
      throw new Error("Incomplete shard results.");
    const actual = new Set<string>();
    for (const raw of shard.results) {
      const result = object(raw);
      if (
        typeof result.id !== "string" ||
        actual.has(result.id) ||
        !planned.includes(result.id) ||
        result.status !== "passed" ||
        result.attempts !== 1
      )
        throw new Error("Failed, skipped, repeated or unexpected test result.");
      actual.add(result.id);
    }
    for (const id of planned) {
      if (seen.has(id)) throw new Error("Test appeared in multiple shards.");
      seen.add(id);
    }
  }
  if (seen.size !== expected.length || expected.some((id) => !seen.has(id)))
    throw new Error("Shards do not cover the full planned suite.");
  return { runId: expectedRun, shards: expectedShards, tests: expected.length };
}

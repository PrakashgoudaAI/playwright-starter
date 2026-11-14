import { test } from "node:test";
import assert from "node:assert/strict";
import { verifyShards } from "../../src/support/shard-gate.ts";
const plan = { schemaVersion: 1, runId: "run-1", testIds: ["a", "b"] };
const shard = (index: number, id: string) => ({
  schemaVersion: 1,
  runId: "run-1",
  index,
  total: 2,
  status: "passed",
  testIds: [id],
  results: [{ id, status: "passed", attempts: 1 }],
});
await test("complete first-attempt results match the plan", () => {
  assert.deepEqual(
    verifyShards(plan, [shard(1, "a"), shard(2, "b")], "run-1", 2),
    { runId: "run-1", shards: 2, tests: 2 },
  );
});
await test("missing shard cannot become a green release", () => {
  assert.throws(
    () => verifyShards(plan, [shard(1, "a")], "run-1", 2),
    /Missing/,
  );
});
await test("duplicate indexes and wrong-run artifacts are rejected", () => {
  assert.throws(() =>
    verifyShards(plan, [shard(1, "a"), shard(1, "b")], "run-1", 2),
  );
  assert.throws(() =>
    verifyShards(
      plan,
      [shard(1, "a"), { ...shard(2, "b"), runId: "old-run" }],
      "run-1",
      2,
    ),
  );
});
await test("passing subsets cannot hide missing planned tests", () => {
  assert.throws(
    () =>
      verifyShards(
        { ...plan, testIds: ["a", "b", "c"] },
        [shard(1, "a"), shard(2, "b")],
        "run-1",
        2,
      ),
    /full planned/,
  );
});
await test("skips, retries, failed outcomes and absent results fail the gate", () => {
  for (const change of [
    { status: "skipped", attempts: 1 },
    { status: "passed", attempts: 2 },
    { status: "failed", attempts: 1 },
  ])
    assert.throws(() =>
      verifyShards(
        plan,
        [
          shard(1, "a"),
          { ...shard(2, "b"), results: [{ id: "b", ...change }] },
        ],
        "run-1",
        2,
      ),
    );
  assert.throws(() =>
    verifyShards(
      plan,
      [shard(1, "a"), { ...shard(2, "b"), results: [] }],
      "run-1",
      2,
    ),
  );
});
await test("duplicated IDs across shards cannot hide an omitted ID", () => {
  assert.throws(
    () => verifyShards(plan, [shard(1, "a"), shard(2, "a")], "run-1", 2),
    /multiple shards/,
  );
});

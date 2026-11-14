import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { verifyShards } from "../src/support/shard-gate.ts";
const directory = process.argv[2] ?? "quality-results";
const runId = process.env.QUALITY_RUN_ID;
if (!runId) throw new Error("QUALITY_RUN_ID is required.");
const plan: unknown = JSON.parse(
  await readFile(join(directory, "plan.json"), "utf8"),
);
const files = (await readdir(directory)).filter((n) =>
  /^shard-\d+\.json$/.test(n),
);
const manifests: unknown[] = await Promise.all(
  files.map(
    async (name) =>
      JSON.parse(await readFile(join(directory, name), "utf8")) as unknown,
  ),
);
console.log(
  JSON.stringify(
    verifyShards(
      plan,
      manifests,
      runId,
      Number(process.env.EXPECTED_SHARDS ?? 2),
    ),
  ),
);

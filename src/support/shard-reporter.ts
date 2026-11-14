import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type {
  Reporter,
  FullConfig,
  Suite,
  TestCase,
  TestResult,
  FullResult,
} from "@playwright/test/reporter";

function write(path: string, value: unknown) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n");
}
export default class ShardReporter implements Reporter {
  private plan: string[] = [];
  private shard: { current: number; total: number } | null = null;
  private results = new Map<
    string,
    { id: string; status: string; attempts: number }
  >();
  onBegin(config: FullConfig, suite: Suite) {
    this.plan = suite
      .allTests()
      .map((t) => t.id)
      .sort();
    this.shard = config.shard;
    if (process.env.PLAN_MANIFEST)
      write(process.env.PLAN_MANIFEST, {
        schemaVersion: 1,
        runId: process.env.QUALITY_RUN_ID,
        testIds: this.plan,
      });
  }
  onTestEnd(test: TestCase, result: TestResult) {
    const previous = this.results.get(test.id);
    this.results.set(test.id, {
      id: test.id,
      status: result.status,
      attempts: (previous?.attempts ?? 0) + 1,
    });
  }
  onEnd(result: FullResult) {
    if (!process.env.SHARD_MANIFEST) return;
    if (!this.shard || !process.env.QUALITY_RUN_ID)
      throw new Error("Shard identity is required.");
    write(process.env.SHARD_MANIFEST, {
      schemaVersion: 1,
      runId: process.env.QUALITY_RUN_ID,
      index: this.shard.current,
      total: this.shard.total,
      status: result.status,
      testIds: this.plan,
      results: [...this.results.values()],
    });
  }
}

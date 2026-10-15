import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';

export default async function cleanResults() {
  // Allure appends results; remove only this project's generated result folder.
  await rm(resolve(import.meta.dirname, '../../allure-results'), { recursive: true, force: true });
}

import { runUsageRegionChecks } from '../lib/usageRegions.checks.js';

const results = runUsageRegionChecks();
for (const result of results) {
  console.log(`${result.pass ? 'PASS' : 'FAIL'}  ${result.name}`);
  if (!result.pass) {
    console.log(`      expected ${JSON.stringify(result.expected)}`);
    console.log(`      actual   ${JSON.stringify(result.actual)}`);
  }
}
const failed = results.filter((result) => !result.pass).length;
console.log(`${results.length - failed}/${results.length} passed`);
process.exitCode = failed ? 1 : 0;

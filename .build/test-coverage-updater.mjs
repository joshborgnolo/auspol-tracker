import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const wrapper = path.resolve(".build/coverage-updater.sh");

function runCase(mergeRc) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "coverage-updater-test-"));
  try {
    fs.mkdirSync(path.join(dir, ".build"), { recursive: true });
    fs.mkdirSync(path.join(dir, "bin"), { recursive: true });
    fs.copyFileSync(wrapper, path.join(dir, ".build/coverage-updater.sh"));
    fs.writeFileSync(path.join(dir, ".build/check-coverage.mjs"), `
import fs from "node:fs";
fs.appendFileSync(process.env.CHECK_FILE, "ran\\n");
console.log('COVERAGE_STATUS {"missing":[{"date":"2026-11-19","house":"Newspoll"}]}');
console.log('  2026-11-19  Newspoll  missed');
process.exit(3);
`);
    fs.writeFileSync(path.join(dir, ".build/probe-writers-lock.sh"), "#!/bin/bash\necho 'PROBE_STATUS {\"ok\":true}'\nexit 0\n");
    fs.writeFileSync(path.join(dir, ".build/check-writer-heartbeat.mjs"), "console.log('HEARTBEAT_STATUS {\"ok\":true}');\n");
    fs.writeFileSync(path.join(dir, "bin/git"), `#!/bin/bash
case "$1" in
  diff|fetch) exit 0 ;;
  merge) exit "$MERGE_RC" ;;
  *) exit 0 ;;
esac
`);
    fs.writeFileSync(path.join(dir, "bin/osascript"), `#!/bin/bash
printf '%s\n' "$*" >> "$ALERT_FILE"
`);
    fs.chmodSync(path.join(dir, "bin/git"), 0o755);
    fs.chmodSync(path.join(dir, "bin/osascript"), 0o755);
    const alertFile = path.join(dir, "alerts");
    const checkFile = path.join(dir, "checks");
    const output = execFileSync("bash", [".build/coverage-updater.sh"], {
      cwd: dir,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${path.join(dir, "bin")}:${process.env.PATH}`,
        CI: "", MERGE_RC: String(mergeRc), ALERT_FILE: alertFile, CHECK_FILE: checkFile,
      },
    });
    return {
      output,
      alert: fs.existsSync(alertFile) ? fs.readFileSync(alertFile, "utf8") : "",
      checked: fs.existsSync(checkFile),
    };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const stale = runCase(1);
assert(!stale.checked, "a stale checkout must not compare its old poll file");
assert(!stale.alert.includes("missing poll"), `stale sync raised a poll alert:\n${stale.alert}`);
assert.match(stale.output, /coverage check inconclusive, no missing-poll alert/);

const current = runCase(0);
assert(current.checked, "a synced checkout runs the gap comparison");
assert.match(current.alert, /auspol tracker: missing poll/);
assert.match(current.alert, /1 wave\(s\) on Wikipedia not in polls\.json/);

console.log("coverage-updater: stale sync is silent; current-main gaps still notify");

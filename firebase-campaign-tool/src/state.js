const fs = require('fs');
const path = require('path');

function defaultStatePath() {
  return process.env.PUSH_STATE_FILE_PATH
    ? path.resolve(process.cwd(), process.env.PUSH_STATE_FILE_PATH)
    : path.resolve(process.cwd(), '.state/sent-push-events.json');
}

function loadState(statePath = defaultStatePath()) {
  let raw;
  try {
    raw = fs.readFileSync(statePath, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return {};
    throw new Error(`Could not read push state file at ${statePath}: ${err.message}`);
  }

  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `Push state file at ${statePath} is corrupted (invalid JSON) and can't be trusted for dedupe. ` +
        `Refusing to continue, since treating it as empty could resend notifications that already went out. ` +
        `Inspect or restore the file from backup, or delete it only if you accept that already-sent EventIds may be resent, then re-run.`
    );
  }
}

function saveState(state, statePath = defaultStatePath()) {
  const resolved = path.resolve(process.cwd(), statePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  // Write to a temp file and rename into place so a crash mid-write can never
  // leave sent-push-events.json truncated or invalid for the next run to read.
  const tmpPath = `${resolved}.tmp-${process.pid}`;
  fs.writeFileSync(tmpPath, JSON.stringify(state, null, 2));
  fs.renameSync(tmpPath, resolved);
}

module.exports = { loadState, saveState, defaultStatePath };

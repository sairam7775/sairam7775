const fs = require('fs');
const path = require('path');

function defaultStatePath() {
  return process.env.PUSH_STATE_FILE_PATH
    ? path.resolve(process.cwd(), process.env.PUSH_STATE_FILE_PATH)
    : path.resolve(process.cwd(), '.state/sent-push-events.json');
}

function loadState(statePath = defaultStatePath()) {
  try {
    return JSON.parse(fs.readFileSync(statePath, 'utf8'));
  } catch (err) {
    return {};
  }
}

function saveState(state, statePath = defaultStatePath()) {
  const resolved = path.resolve(process.cwd(), statePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, JSON.stringify(state, null, 2));
}

module.exports = { loadState, saveState, defaultStatePath };

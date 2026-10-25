/**
 * The rows that did not go out: errors, and rows skipped because a required
 * column was empty. Either one makes the run fail, so a scheduler sees it.
 */
function failures(results) {
  return results.filter((r) => r.status === 'error' || r.status === 'skipped');
}

module.exports = { failures };

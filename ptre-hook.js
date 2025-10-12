// ptre-hook.js (disabled)
// This hook previously instrumented path-to-regexp for debugging. It is
// intentionally disabled in production to avoid side effects.
module.exports = function noop() {
  return false;
};

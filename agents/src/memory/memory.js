// Player memory — the seam, not the storage.
//
// A teaching agent that remembers "you keep breaking pairs too early" across hands needs a place
// to keep that note. That place is a per-player record, which needs sign-in, which this project
// does not have yet (see docs/mvp-notes.md — accounts, DynamoDB and telemetry are all Phase 3+).
//
// So the interface goes in now and the storage does not. `createMemory()` returns an object with
// `load` / `save`; the default implementation keeps nothing (every hand is reviewed on its own).
// A later DynamoDB-backed implementation implements the same two methods and nothing upstream
// changes — reviewHand.js already calls through this, not a concrete store.

/**
 * @typedef {Object} Memory
 * @property {(playerId:string) => Promise<{ notes:string[] }>} load
 * @property {(playerId:string, summary:{ notes:string[] }) => Promise<void>} save
 */

/** No-op memory: reviews don't carry over between hands yet. */
export function createMemory() {
  return {
    async load() {
      return { notes: [] };
    },
    async save() {
      /* nothing persisted until there are accounts to persist against */
    },
  };
}

// Barrel for the pure Mahjong engine, so other packages can `import { ... } from '@kaki/game'`
// instead of reaching into individual files. The frontend app itself keeps using the relative
// paths it already has — nothing in src/game/ or src/components/ needs to change.
//
// Deliberately does NOT re-export engine.js: the React app owns the live game loop, and the
// agents package never runs it — it works from the structured `state.decisions` array the engine
// already produces, passed in as plain data.

export * from './tiles.js';
export * from './melds.js';
export * from './scoring.js';
export * from './advisor.js';
export * from './puzzles.js';

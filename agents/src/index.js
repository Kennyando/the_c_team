// Public surface of the agents package. One entry point today; strategy / coach agents land
// here later behind the same shape (deterministic context in, validated result out, deterministic
// fallback on failure).

export { runReview } from './review/reviewHand.js';
export { runCoachAnswer } from './coach/coachAnswer.js';
export { decisionContext } from './context/decisionContext.js';
export { coachContext } from './context/coachContext.js';
export { rulesContext } from './context/rulesContext.js';
export { createMemory } from './memory/memory.js';
export { MODEL_ID } from './model.js';

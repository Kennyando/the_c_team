// The model-free floor for the coach agent.
//
// Deliberately minimal — not a re-implementation of the local coach. `frontend/src/game/coach.js`
// `ask()` is the real offline answer, and by the time a question reaches this agent it has
// already run on the client and returned its guided fallback (that is *why* the client
// escalated). Reproducing it here would just echo the same "I'm not sure" text. This is only
// what the Lambda returns when the model ran but its reply could not be used.

export function deterministicCoachAnswer() {
  return {
    title: 'Coach',
    lines: [
      "I couldn't work that one out just now.",
      'Try asking a different way, or tap one of the suggested questions.',
    ],
    modelAssisted: false,
  };
}

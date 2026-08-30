import { useEffect, useRef } from 'react';

/**
 * Say something aloud, unhurried. Shared by the game narration and the help coach so there is one
 * speech implementation, and one place for Amazon Polly to replace it later.
 */
export function speak(text) {
  const speech = typeof window !== 'undefined' ? window.speechSynthesis : null;
  if (!speech || !text) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.9;
  speech.speak(utterance);
}

/**
 * Speaks new game events aloud (proposal Section 6, "Ah Ma discarded a Red Dragon").
 *
 * Uses the browser's built-in Web Speech API, so voice works offline with no cloud call. The
 * proposal's Amazon Polly integration would slot in behind this same hook without the rest of the
 * app changing.
 */
export default function useNarration(log, enabled) {
  const spokenUpTo = useRef(0);

  useEffect(() => {
    const speech = typeof window !== 'undefined' ? window.speechSynthesis : null;
    if (!speech) return;

    if (!enabled) {
      speech.cancel();
      spokenUpTo.current = log.length; // don't replay a backlog when voice is switched on again
      return;
    }

    for (const line of log.slice(spokenUpTo.current)) speak(line);
    spokenUpTo.current = log.length;
  }, [log, enabled]);
}

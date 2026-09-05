import { useEffect, useRef, useState } from 'react';

import { postHandReview } from '../game/review.js';
import { speak } from '../hooks/useNarration.js';

/**
 * A short, encouraging walk-through of the discards and calls the player just made, shown inside
 * the end-of-hand ScoreSheet. Built from `state.decisions` — the engine's own record of each
 * choice next to what the coach would have done. Works with no backend (a plain local summary);
 * with VITE_REVIEW_URL set, a cheap model phrases the same points more warmly.
 */
export default function HandReview({ decisions, rules, voice }) {
  const [review, setReview] = useState(null);
  const spokenRef = useRef(false);

  useEffect(() => {
    let live = true;
    postHandReview(decisions, rules).then((r) => {
      if (live) setReview(r);
    });
    return () => {
      live = false;
    };
  }, [decisions, rules]);

  useEffect(() => {
    if (review && voice && !spokenRef.current) {
      spokenRef.current = true;
      const parts = [review.headline, ...review.improvements, review.oneThingToTry];
      speak(parts.join(' '));
    }
  }, [review, voice]);

  if (!review) return <p className="review-loading">Looking back over your hand…</p>;

  return (
    <section className="hand-review" aria-label="How that hand went">
      <h3>How that hand went</h3>
      <p className="review-headline">{review.headline}</p>

      {review.goodMoves.length > 0 && (
        <>
          <p className="review-label">Well played</p>
          <ul>{review.goodMoves.map((line, i) => <li key={i}>{line}</li>)}</ul>
        </>
      )}

      {review.improvements.length > 0 && (
        <>
          <p className="review-label">Next time</p>
          <ul>{review.improvements.map((line, i) => <li key={i}>{line}</li>)}</ul>
        </>
      )}

      <p className="review-one-thing"><strong>One thing to try:</strong> {review.oneThingToTry}</p>
    </section>
  );
}

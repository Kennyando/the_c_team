import { useEffect, useRef, useState } from 'react';

import { askWithModel, QUICK_QUESTIONS } from '../game/coach.js';
import { pendingHelp, situationHint } from '../game/advisor.js';
import { speak } from '../hooks/useNarration.js';
import Tile from './Tile.jsx';

// Shown instead of whatever askWithModel() returned if it throws, or if the result isn't shaped
// the way every local answer always is — a network hiccup or a future bug there should surface as
// this, not a stuck "asking…" state or a crash rendering `entry.answer.lines.map(...)`.
const ASK_FAILED_ANSWER = {
  title: "Couldn't get an answer",
  lines: ['Something went wrong — please try asking again.'],
};

const isWellFormedAnswer = (a) =>
  !!a && typeof a.title === 'string' && Array.isArray(a.lines) && a.lines.every((l) => typeof l === 'string');

/**
 * The help coach: a button in the bottom-right corner that opens a panel of questions and answers.
 *
 * Tappable questions come first and the text box second — for a player who is not confident typing,
 * recognising a question is far easier than composing one. Everything is sized from --tile-scale,
 * so the accessibility slider grows the coach along with the rest of the table.
 */
export default function Coach({ state, voice, hints, initialOpen = false }) {
  const [open, setOpen] = useState(initialOpen);
  const [thread, setThread] = useState([]);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const answersRef = useRef(null);
  // A ref, not just the `pending` state above: state updates are batched/async, so two clicks in
  // the same tick could both still read `pending === false` before either re-render lands. The
  // ref is set synchronously, so the second call is refused the instant the first one starts.
  const pendingRef = useRef(false);
  // Kept current via the effect below so askWithModel() can re-read the *latest* game state after
  // its network round trip, not whatever `state` this render's closure captured at the moment the
  // question was asked (the game keeps advancing on its own timer while a question is in flight).
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  const available = hints ? pendingHelp(state).length : 0;

  // Keep the newest answer in view.
  useEffect(() => {
    if (answersRef.current) answersRef.current.scrollTop = answersRef.current.scrollHeight;
  }, [thread, open]);

  const put = (question, answer) => {
    setThread((t) => [...t, { question, answer }]);
    if (voice) speak(`${answer.title}. ${answer.lines.join(' ')}`);
  };

  const askNow = async (question) => {
    // Refuse a second question while one is still in flight — otherwise a rapid double-tap (or
    // mashing a quick-question button) fires concurrent askWithModel() calls, and once escalated,
    // concurrent Bedrock requests for what should be a single answer.
    if (!question.trim() || pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setDraft('');
    try {
      // Resolves instantly for anything the local patterns already recognise — askWithModel
      // only reaches for the network when there is genuinely no local match. Passing a getter
      // (not `state` itself) is what lets it re-check the position after that round trip instead
      // of answering against a snapshot from before it.
      const answer = await askWithModel(question, () => stateRef.current);
      put(question, isWellFormedAnswer(answer) ? answer : ASK_FAILED_ANSWER);
    } catch (err) {
      // askWithModel() is documented never to throw, but this is the coach's own thread of
      // conversation with the player — a stuck "asking…" or a wall of nothing is a worse failure
      // mode than showing a plain "try again", so this is defended anyway.
      console.error('Coach: askWithModel failed', err);
      put(question, ASK_FAILED_ANSWER);
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  };

  // With hints on, lead with what is happening right now rather than an empty panel. Keyed on
  // `open` rather than the click, so it happens however the panel came to be open.
  useEffect(() => {
    if (!open || !hints || thread.length > 0) return;
    const hint = situationHint(state);
    if (hint) setThread([{ question: null, answer: { title: 'Right now', lines: [hint] } }]);
    // Deliberately not re-run as the game moves on: a tip that rewrites itself mid-read is worse
    // than a slightly stale one, and this audience needs time to read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, hints]);

  if (!open) {
    return (
      <button
        type="button"
        className="coach-fab"
        onClick={() => setOpen(true)}
        aria-label={available ? 'Ask for help — you have a move available' : 'Ask for help'}
      >
        <span aria-hidden="true">?</span>
        <span className="coach-fab-text">Help</span>
        {available > 0 && <span className="coach-badge" aria-hidden="true" />}
      </button>
    );
  }

  return (
    <section className="coach-panel" aria-label="Mahjong help">
      <header className="coach-head">
        <h2>Ask me anything</h2>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close help">Close</button>
      </header>

      <div className="coach-answers" ref={answersRef} aria-live="polite">
        {thread.length === 0 && (
          <p className="coach-intro">
            Tap a question below, or type your own. I can explain the rules or look at your hand.
          </p>
        )}
        {thread.map((entry, i) => (
          <div key={i}>
            {entry.question && <p className="coach-q">{entry.question}</p>}
            <div className="coach-a">
              <strong>{entry.answer.title}</strong>
              {entry.answer.tile && (
                <div className="coach-a-tile"><Tile tile={entry.answer.tile} small /></div>
              )}
              {entry.answer.lines.map((line, j) => <p key={j}>{line}</p>)}
            </div>
          </div>
        ))}
      </div>

      <div className="coach-quick">
        {QUICK_QUESTIONS.map((q) => (
          <button key={q} type="button" onClick={() => askNow(q)} disabled={pending}>{q}</button>
        ))}
      </div>

      <form
        className="coach-ask"
        onSubmit={(e) => { e.preventDefault(); askNow(draft); }}
      >
        <label htmlFor="coach-input" className="visually-hidden">Type your question</label>
        <input
          id="coach-input"
          type="text"
          value={draft}
          placeholder="Type a question…"
          onChange={(e) => setDraft(e.target.value)}
          disabled={pending}
        />
        <button type="submit" className="primary" disabled={pending}>Ask</button>
      </form>
    </section>
  );
}

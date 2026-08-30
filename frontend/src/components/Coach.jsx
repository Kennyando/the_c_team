import { useEffect, useRef, useState } from 'react';

import { ask, QUICK_QUESTIONS } from '../game/coach.js';
import { pendingHelp, situationHint } from '../game/advisor.js';
import { speak } from '../hooks/useNarration.js';

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
  const answersRef = useRef(null);

  const available = hints ? pendingHelp(state).length : 0;

  // Keep the newest answer in view.
  useEffect(() => {
    if (answersRef.current) answersRef.current.scrollTop = answersRef.current.scrollHeight;
  }, [thread, open]);

  const put = (question, answer) => {
    setThread((t) => [...t, { question, answer }]);
    if (voice) speak(`${answer.title}. ${answer.lines.join(' ')}`);
  };

  const askNow = (question) => {
    if (!question.trim()) return;
    put(question, ask(question, state));
    setDraft('');
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
              {entry.answer.lines.map((line, j) => <p key={j}>{line}</p>)}
            </div>
          </div>
        ))}
      </div>

      <div className="coach-quick">
        {QUICK_QUESTIONS.map((q) => (
          <button key={q} type="button" onClick={() => askNow(q)}>{q}</button>
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
        />
        <button type="submit" className="primary">Ask</button>
      </form>
    </section>
  );
}

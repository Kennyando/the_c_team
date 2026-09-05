/**
 * The landing screen: three doors in, nothing else. Visiting the site no longer drops you straight
 * into a live hand — you choose Play, Puzzle, or Rules first.
 */
export default function Home({ onNavigate }) {
  return (
    <div className="home-screen">
      <div className="dialog">
        <h2>Kaki Mahjong</h2>
        <p className="hint">A Singapore-rules table for one, three heuristic bots, and a coach.</p>
        <div className="row">
          <button type="button" className="primary" onClick={() => onNavigate('play')}>Play</button>
          <button type="button" onClick={() => onNavigate('puzzle')}>Puzzle</button>
          <button type="button" onClick={() => onNavigate('rules')}>Rules</button>
        </div>
      </div>
    </div>
  );
}

/**
 * The dark plate in the middle of the table: which round it is, how many tiles are left to draw,
 * and each seat's running score turned toward its own edge. Decorative — the same facts are in
 * the topbar and the score sheet — so it is hidden from assistive tech.
 */
export default function CenterBoard({ round, dealer, remaining, scores }) {
  return (
    <div className="center-board" aria-hidden="true">
      <span className="center-round">{round}</span>
      <span className="center-remaining">{remaining} left</span>
      <div className="center-scores">
        {scores.map((points, seat) => (
          <span
            key={seat}
            className={`center-score center-score-${seat}${seat === dealer ? ' is-dealer' : ''}`}
          >
            {points >= 0 ? '+' : ''}{points}
          </span>
        ))}
      </div>
    </div>
  );
}

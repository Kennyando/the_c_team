import { RULE_LABELS } from '../game/scoring.js';

const SCORING_RULES = [
  'seatFlower', 'flowerSet', 'dragonPong', 'seatWind', 'prevailingWind',
  'allChows', 'allPungs', 'halfFlush', 'fullFlush',
];
const TABLE_RULES = ['discarderPaysAll', 'includeAnimals'];

/**
 * Settings and the house-rules screen (proposal Section 5): every group toggles the variants they
 * personally play. Rule changes take effect on the next hand, so a hand in progress is never
 * rescored underneath the player.
 */
export default function Settings({ display, setDisplay, rules, setRules, onClose, onNewHand }) {
  const toggleRule = (key) => setRules({ ...rules, [key]: !rules[key] });

  return (
    <div className="backdrop" role="dialog" aria-modal="true" aria-label="Settings">
      <div className="dialog">
        <h2>Settings</h2>

        <div className="setting">
          <label htmlFor="size">Tile and text size</label>
          <input
            id="size"
            type="range"
            min="0.8"
            max="2"
            step="0.1"
            value={display.scale}
            onChange={(e) => setDisplay({ ...display, scale: Number(e.target.value) })}
          />
          <p className="hint">Everything on screen grows and shrinks together.</p>
        </div>

        <div className="setting">
          <label>Table view</label>
          <label className="toggle">
            <input
              type="radio"
              name="tableView"
              checked={display.tableView === 'seated'}
              onChange={() => setDisplay({ ...display, tableView: 'seated' })}
            />
            Seated — as if you are at the table
          </label>
          <label className="toggle">
            <input
              type="radio"
              name="tableView"
              checked={display.tableView === 'flat'}
              onChange={() => setDisplay({ ...display, tableView: 'flat' })}
            />
            Flat — looking straight down at the table
          </label>
          <p className="hint">Your own tiles stay the same size and face you either way.</p>
        </div>

        <div className="setting">
          <label>Tile pictures</label>
          <label className="toggle">
            <input
              type="radio"
              name="tileStyle"
              checked={display.tileStyle === 'traditional'}
              onChange={() => setDisplay({ ...display, tileStyle: 'traditional' })}
            />
            Traditional tiles — dots and bamboo, like a real set
          </label>
          <label className="toggle">
            <input
              type="radio"
              name="tileStyle"
              checked={display.tileStyle === 'numerals'}
              onChange={() => setDisplay({ ...display, tileStyle: 'numerals' })}
            />
            Big numbers — one large number on every tile
          </label>
        </div>

        <div className="setting">
          <label className="toggle">
            <input
              type="checkbox"
              checked={display.contrast}
              onChange={(e) => setDisplay({ ...display, contrast: e.target.checked })}
            />
            High-contrast black and white
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={display.voice}
              onChange={(e) => setDisplay({ ...display, voice: e.target.checked })}
            />
            Speak the game out loud
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={display.coachHints}
              onChange={(e) => setDisplay({ ...display, coachHints: e.target.checked })}
            />
            Let the helper offer tips on its own
          </label>
          <p className="hint">
            Voice uses your device's built-in speech, so nothing is sent anywhere. Tips only mark the
            Help button quietly — nothing pops up and there is never a timer.
          </p>
        </div>

        <div className="setting rules-list">
          <h3>House rules — scoring</h3>
          <p className="hint">
            Singapore scoring varies from table to table. Switch off anything your group doesn't play.
            Changes apply from the next hand.
          </p>
          {SCORING_RULES.map((key) => (
            <label className="toggle" key={key}>
              <input type="checkbox" checked={rules[key]} onChange={() => toggleRule(key)} />
              {RULE_LABELS[key]}
            </label>
          ))}
        </div>

        <div className="setting rules-list">
          <h3>House rules — table</h3>
          <label className="toggle" htmlFor="limit">
            Limit hand: cap at
            <input
              id="limit"
              type="number"
              min="1"
              max="13"
              value={rules.limit}
              onChange={(e) => setRules({ ...rules, limit: Number(e.target.value) })}
              style={{ width: '5em', minHeight: 'var(--tap)', fontSize: 'inherit' }}
            />
            tai
          </label>
          {TABLE_RULES.map((key) => (
            <label className="toggle" key={key}>
              <input type="checkbox" checked={rules[key]} onChange={() => toggleRule(key)} />
              {RULE_LABELS[key]}
            </label>
          ))}
        </div>

        <div className="row">
          <button type="button" className="primary" onClick={onClose}>Back to the game</button>
          <button type="button" onClick={onNewHand}>Start a new hand now</button>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';

import {
  newGame, drawTile, discardTile, resolveClaims, declareKong, declareSelfDraw, getTurnActions,
} from './game/engine.js';
import { chooseDiscard, chooseClaim, chooseTurnAction } from './game/bots.js';
import { DEFAULT_RULES } from './game/scoring.js';
import { tileName } from './game/tiles.js';

import Table from './components/Table.jsx';
import Hand from './components/Hand.jsx';
import { TileStyleProvider } from './components/Tile.jsx';
import CallBar from './components/CallBar.jsx';
import ConfirmDialog from './components/ConfirmDialog.jsx';
import ScoreSheet from './components/ScoreSheet.jsx';
import Settings from './components/Settings.jsx';
import Coach from './components/Coach.jsx';
import Home from './components/Home.jsx';
import Puzzle from './components/Puzzle.jsx';
import Rules from './components/Rules.jsx';
import useNarration from './hooks/useNarration.js';

// Unhurried pacing — the "kopitiam mode" of proposal Section 6. There is no turn clock anywhere;
// this is only how long the bots take so their moves can be followed.
const PACE = 950;

/** Apply an engine function to a fresh copy of the state. */
const advance = (state, fn) => fn(structuredClone(state));

/** Each bot decides which of its available claims, if any, it wants. */
function decideBots(state) {
  const bySeat = {};
  for (const claim of state.botClaims) (bySeat[claim.seat] ||= []).push(claim);

  const wanted = [];
  for (const seat of Object.keys(bySeat)) {
    const pick = chooseClaim(state.players[seat], bySeat[seat]);
    if (pick) wanted.push(pick);
  }
  state.botClaims = wanted;
  return state;
}

/** A bot's own turn: take a win, take a kong, otherwise discard. */
function botTurn(state) {
  const action = chooseTurnAction(getTurnActions(state));
  if (action?.type === 'win') return declareSelfDraw(state);
  if (action) return declareKong(state, action);
  return discardTile(state, chooseDiscard(state.players[state.turn]));
}

export default function App() {
  // Visiting the site lands on Home, not straight into a live hand — 'home' | 'play' | 'puzzle' |
  // 'rules'. Home renders without the app's topbar at all (it supplies its own title); the other
  // two destinations get a topbar with a Home button so there's always a way back.
  const [screen, setScreen] = useState('home');

  const [rules, setRules] = useState(DEFAULT_RULES);
  const [display, setDisplay] = useState({
    scale: 1.2, contrast: false, voice: false, tileStyle: 'traditional', coachHints: false,
    tableView: 'seated',
  });
  const [state, setState] = useState(() => newGame(DEFAULT_RULES, 0));
  const [confirm, setConfirm] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  const you = state.players[0];
  const isYourTurn = state.turn === 0;
  const yourTurnActions = useMemo(
    () => (state.phase === 'act' && isYourTurn ? getTurnActions(state) : []),
    [state, isYourTurn],
  );
  const canDiscard = state.phase === 'act' && isYourTurn && !confirm;
  const claiming = state.phase === 'claim' && state.claimOptions.length > 0;

  // One slider and one toggle drive the whole interface.
  useEffect(() => {
    document.documentElement.style.setProperty('--tile-scale', display.scale);
    document.documentElement.dataset.theme = display.contrast ? 'contrast' : 'light';
  }, [display]);

  useNarration(state.log, display.voice);

  // The game loop. It only ever runs while the Play screen is showing and nothing is waiting on
  // the human — a bot must not keep playing turns while the player has wandered off to Puzzle or
  // Rules (or Settings, or a confirm dialog).
  useEffect(() => {
    if (screen !== 'play' || state.phase === 'over' || showSettings || confirm) return;

    let step = null;
    if (state.phase === 'draw') step = drawTile;
    else if (state.phase === 'act' && !state.players[state.turn].isHuman) step = botTurn;
    else if (state.phase === 'claim' && !claiming) step = (s) => resolveClaims(decideBots(s), null);
    if (!step) return;

    const timer = setTimeout(() => setState((s) => advance(s, step)), PACE);
    return () => clearTimeout(timer);
  }, [screen, state, claiming, showSettings, confirm]);

  const apply = (fn) => setState((s) => advance(s, fn));

  const askThen = (title, tile, fn) =>
    setConfirm({
      title,
      tile,
      run: () => {
        setConfirm(null);
        apply(fn);
      },
    });

  const onDiscard = (tile) =>
    askThen(`Discard ${tileName(tile)}?`, tile, (s) => discardTile(s, tile));

  const onClaim = (action) =>
    askThen(
      `Call ${action.type.replace('Kong', ' kong').toUpperCase()}?`,
      state.pending?.tile ?? action.tile,
      (s) => resolveClaims(decideBots(s), action),
    );

  const onTurnAction = (action) =>
    askThen(
      action.type === 'win' ? 'Declare a win?' : `Declare a kong of ${tileName(action.tile)}?`,
      action.type === 'win' ? state.lastDrawn : action.tile,
      (s) => (action.type === 'win' ? declareSelfDraw(s) : declareKong(s, action)),
    );

  const onPass = () => apply((s) => resolveClaims(decideBots(s), null));

  const newHand = () => {
    setConfirm(null);
    setShowSettings(false);
    setState((s) => newGame(rules, (s.dealer + 1) % 4, s.players.map((p) => p.points)));
  };

  let prompt = 'Watch the table.';
  if (state.phase === 'over') prompt = 'The hand is finished.';
  else if (claiming) prompt = 'You can make a call on that tile — or tap Pass to let it go.';
  else if (canDiscard) prompt = 'Tap one of your tiles to discard it.';
  else if (state.phase === 'act') prompt = `${state.players[state.turn].name} is thinking…`;
  else if (state.phase === 'draw') prompt = `${state.players[state.turn].name} is drawing a tile…`;

  return (
    <TileStyleProvider value={display.tileStyle}>
    <div className="app">
      {screen !== 'home' && (
        <header className="topbar">
          <h1>Kaki Mahjong</h1>
          {screen === 'play' && (
            <span className="wall-count">{state.wall.length} tiles left in the wall</span>
          )}
          <span className="spacer" />
          {screen === 'play' && <button type="button" onClick={newHand}>New hand</button>}
          {screen === 'play' && (
            <button type="button" className="primary" onClick={() => setShowSettings(true)}>
              Settings
            </button>
          )}
          <button type="button" onClick={() => setScreen('home')}>Home</button>
        </header>
      )}

      {screen === 'home' && <Home onNavigate={setScreen} />}
      {screen === 'puzzle' && <Puzzle />}
      {screen === 'rules' && <Rules />}

      {screen === 'play' && (
        <>
          <main className={`table view-${display.tableView}`}>
            <div className="log" aria-live="polite">{state.log.at(-1)}</div>

            <Table state={state} />

            {/* Outside the scene on purpose: your hand is never tilted or foreshortened. */}
            <Hand
              player={you}
              dealer={state.dealer}
              canDiscard={canDiscard}
              lastDrawn={state.lastDrawn}
              onSelect={onDiscard}
              prompt={prompt}
            >
              {claiming && (
                <CallBar
                  actions={state.claimOptions}
                  tile={state.pending?.tile}
                  onChoose={onClaim}
                  onPass={onPass}
                />
              )}
              {!claiming && yourTurnActions.length > 0 && (
                <CallBar actions={yourTurnActions} onChoose={onTurnAction} />
              )}
            </Hand>
          </main>

          {/* Hidden while a dialog is up, so it never sits on top of a confirmation. */}
          {!confirm && !showSettings && state.phase !== 'over' && (
            <Coach state={state} voice={display.voice} hints={display.coachHints} />
          )}

          {confirm && (
            <ConfirmDialog
              title={confirm.title}
              tile={confirm.tile}
              onConfirm={confirm.run}
              onCancel={() => setConfirm(null)}
            />
          )}

          {showSettings && (
            <Settings
              display={display}
              setDisplay={setDisplay}
              rules={rules}
              setRules={setRules}
              onClose={() => setShowSettings(false)}
              onNewHand={newHand}
            />
          )}

          {state.phase === 'over' && !showSettings && (
            <ScoreSheet result={state.result} players={state.players} onNewHand={newHand} />
          )}
        </>
      )}
    </div>
    </TileStyleProvider>
  );
}

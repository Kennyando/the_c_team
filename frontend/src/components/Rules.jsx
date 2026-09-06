import Tile from './Tile.jsx';

/**
 * The Singapore Mahjong rulebook, retyped as text on the page (it used to be an embedded PDF).
 * Branding, contact details and organisation names from the source document have been removed —
 * only the rules themselves are kept.
 */

/** A wrapped row of tile pictures, drawn with the same artwork the game uses. */
function TileRow({ tiles }) {
  return (
    <div className="rules-tiles">
      {tiles.map((t, i) => <Tile key={`${t}-${i}`} tile={t} />)}
    </div>
  );
}

const RANKS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export default function Rules() {
  return (
    <div className="rules-screen">
      <article className="rules-doc">
        <h1>Singapore Mahjong — Rules &amp; Regulations</h1>

        <h2>A. Basic Rules of Play</h2>
        <ol className="rules-list">
          <li>
            <strong>Picking of seats.</strong> No specific rules during normal session play. Any
            player may or may not request a picking of seats at the onset or after finishing one
            round of play. Should one player request it, the rest must accommodate the request
            using the dice-throwing method by the requestor. The player obtaining the East wind
            picks first, followed by South, West and North.
          </li>
          <li><strong>Flow of movement</strong> of the game is anti-clockwise.</li>
          <li>
            <strong>Stacking of tiles.</strong> Banker and the opposite player each stack 19 wall
            tiles; the other two players each stack 18. Each wall stack is 2 tiles high.
          </li>
          <li>
            <strong>To begin the game,</strong> the player picking the East seat starts first; if
            not, anyone can throw the dice to determine the starting round banker.
          </li>
          <li>
            <strong>Dice number</strong> to determine the opening of the wall tiles and the
            starting banker: Banker (E) 1, 5, 9, 13, 17; 2nd seat (S) 2, 6, 10, 14, 18; 3rd seat
            (W) 3, 7, 11, 15; 4th seat (N) 4, 8, 12, 16.
          </li>
          <li>
            <strong>Responsibility of starting a new round wind:</strong> normally the starting
            banker announces it at the start of each round wind. Not announcing it, if the banker
            then wins on the start of the prevailing wind, is penalised by paying the other
            players according to the doubles won.
          </li>
          <li>
            <strong>Responsibility of ending a round wind:</strong> normally the North-wind seat
            changes the round wind before the banker starts the next one. Failing to do so
            attracts the same penalty as Rule 6.
          </li>
          <li><strong>No minimum number of rounds</strong> to be banker if he or she keeps winning.</li>
          <li>
            <strong>15 tiles (7½ stacks)</strong> remain from the back wall whether or not a game
            has been won.
          </li>
          <li>
            <strong>If a game ends without a winner,</strong> the banker continues to deal if no
            Kong (open or concealed) situation arose during the game.
          </li>
          <li>
            <strong>A player drawing the last tile</strong> of the game (even a flower or animal)
            need not discard, and the game is treated as having no winner.
          </li>
          <li>
            <strong>Last seven and five tiles</strong> (excluding Rule 9):
            <ul>
              <li>
                A player drawing the last 7th tile assumes all players&rsquo; liabilities if
                someone Kongs under the fresh-tile rule.
              </li>
              <li>
                A player drawing the last 5th tile assumes all players&rsquo; liabilities if
                someone Kongs and/or wins under the fresh-tile rule.
              </li>
              <li>
                The fresh-tile rule refers to tiles not found in the discard pool, and does not
                include the pong or chow sets displayed by each player.
              </li>
            </ul>
          </li>
          <li>No alert need be given in a situation of assuming liabilities (&ldquo;Bao&rdquo;).</li>
          <li>
            <strong>No actual monetary transaction</strong> &mdash; each player is given 400 in
            chips as capital. When a player&rsquo;s capital is exhausted the round ends and scores
            are tabulated for that table. The game also ends when the session time is up.
          </li>
          <li>
            <strong>Penalty of &ldquo;Za Hu&rdquo;</strong> (invalid declared win): pay a minimum
            of 5 doubles to each of the other players.
          </li>
          <li><strong>Minimum</strong> of one double is required in order to win.</li>
          <li>
            <strong>Self-drawn,</strong> or a player discarding the winning tile for another to
            win, pays full price while the others pay half price.
          </li>
          <li>
            <strong>Priority to win</strong> follows the anti-clockwise order, except for
            Thirteen Wonders, which supersedes players ahead of you who could also have won from
            that tile.
          </li>
          <li>Round (table) wind gives one double to whoever pongs that wind.</li>
          <li>
            Own wind gives one double, determined by where you sit counting from the banker
            (East), then South, West and North.
          </li>
        </ol>

        <h2>B. Doubles &amp; Payments</h2>
        <ol className="rules-list" start={21}>
          <li>
            <strong>Payments</strong> are according to how many doubles you have won, plus side
            wins such as Animals, Flowers marriage, Kong, and a Born Loser paying Za Hu.
            <div className="rules-table-wrap">
              <table>
                <thead>
                  <tr><th>Doubles</th><th>Full price</th><th>Half price</th></tr>
                </thead>
                <tbody>
                  <tr><td>One (1)</td><td>2</td><td>1</td></tr>
                  <tr><td>Two (2)</td><td>4</td><td>2</td></tr>
                  <tr><td>Three (3)</td><td>8</td><td>4</td></tr>
                  <tr><td>Four (4)</td><td>16</td><td>8</td></tr>
                  <tr><td>Five (5)</td><td>32</td><td>16</td></tr>
                  <tr><td>Ping Hu (4)</td><td>20</td><td>10</td></tr>
                </tbody>
              </table>
            </div>
          </li>
          <li>
            <strong>Instant payouts:</strong>
            <div className="rules-table-wrap">
              <table>
                <thead>
                  <tr><th>Type</th><th>Concealed (1st hand)</th><th>Subsequent (opened)</th></tr>
                </thead>
                <tbody>
                  <tr><td>Kong</td><td>2</td><td>1</td></tr>
                  <tr><td>Flower same-number marriage</td><td>2</td><td>1</td></tr>
                  <tr><td>Cat &amp; Mouse marriage</td><td>2</td><td>1</td></tr>
                  <tr><td>Rooster &amp; Centipede marriage</td><td>2</td><td>1</td></tr>
                  <tr><td>One set of Flowers or Animals</td><td>4</td><td>2</td></tr>
                </tbody>
              </table>
            </div>
          </li>
          <li>
            <strong>How to score a double (fan):</strong>
            <div className="rules-table-wrap">
              <table>
                <thead>
                  <tr><th>Pattern</th><th>Doubles</th></tr>
                </thead>
                <tbody>
                  <tr><td>a. Own Flower or Season matching your seating number</td><td>1</td></tr>
                  <tr><td>b. Complete set of Flowers or Seasons</td><td>2</td></tr>
                  <tr><td>c. Each Animal</td><td>1</td></tr>
                  <tr><td>d. One complete set of Animals</td><td>5</td></tr>
                  <tr><td>e. Pong of the round wind or your own wind (Rules 19 &amp; 20)</td><td>1</td></tr>
                  <tr><td>f. Pong of the round wind and your own wind (e.g. East wind &amp; banker)</td><td>2</td></tr>
                  <tr><td>g. Pong of any triplet of Dragon tiles</td><td>1</td></tr>
                  <tr><td>h. Pong of all 3 Dragon tiles (auto win, need not fulfil the hand)</td><td>5</td></tr>
                  <tr><td>i. Pong of any two Dragons with the remaining pair as the eye (1 + two Dragon doubles)</td><td>3</td></tr>
                  <tr><td>j. Mixed &ldquo;Pong Pong&rdquo; hu (all triplets)</td><td>2</td></tr>
                  <tr><td>k. Pong of 3 winds with a pair of the 4th wind</td><td>3 or 4</td></tr>
                  <tr><td>l. Half Flush (half colour)</td><td>2</td></tr>
                  <tr><td>m. Full Flush (one colour) mixed with pong or sequence, without Dragons and Winds</td><td>4</td></tr>
                  <tr><td>n. Green suit mixed with pong or sequence, with or without Green Dragons (bamboos 2, 3, 4, 6, 8 and Green Dragons)</td><td>4</td></tr>
                  <tr><td>o. Full Flush (one colour) Ping Hu, without Dragons, Winds, Animals or Flowers/Seasons</td><td>5</td></tr>
                  <tr><td>p. Mixed Ping Hu without Animals, Flowers/Seasons, Dragons, round wind or own wind</td><td>4</td></tr>
                  <tr><td>q. Mixed Ping Hu with Animals or Flowers/Seasons, without Dragons, round wind or own wind as the eye (Animals or own flower/season add more doubles)</td><td>1</td></tr>
                  <tr><td>r. Mixed pong of 1 &amp; 9 numerics with Dragons and Winds, minimum a pair of terminal tiles</td><td>2</td></tr>
                </tbody>
              </table>
            </div>
          </li>
          <li>
            <strong>Special hands (limit games)</strong> &mdash; each worth the limit of 5 doubles:
            <ol type="a">
              <li>Pong of all 4 winds (need not fulfil the hand) &mdash; Four Blessings</li>
              <li>Pong of all Winds and Dragons only, without any numerics &mdash; All Honours</li>
              <li>All triplets and an eye (Kam Kam Hu), concealed win, concealed Kong only &mdash; Hidden Treasures</li>
              <li>Four Kongs</li>
              <li>Pong of all 1 &amp; 9 numerics, with the pair also a terminal tile</li>
              <li>Nine Heavenly Gates flush 1112345678999, no open meld</li>
              <li>
                8 Flowers/Seasons: a player already holding 7 flowers/seasons can take the last
                8th tile from any player and win without fulfilling the hand (auto win)
              </li>
              <li>
                Heavenly win (Tien Hu): only for the banker, at the start of the game after all
                replacement tiles are drawn, winning without discarding the first tile
              </li>
              <li>Earthly win (Teh Hu): any non-banker winning on the banker&rsquo;s first discard</li>
              <li>
                Thirteen Wonders: pays full price whether self-drawn or discarded; priority to
                win applies (Rule 18)
              </li>
            </ol>
          </li>
          <li>
            <strong>Bonus situations:</strong>
            <div className="rules-table-wrap">
              <table>
                <thead>
                  <tr><th>Situation</th><th>Doubles</th></tr>
                </thead>
                <tbody>
                  <tr><td>a. Winning tile from the replacement wall after a Kong / Flower / Season / Animal</td><td>1</td></tr>
                  <tr><td>b. Winning tile from the replacement wall after a double Kong (Kong &amp; Kong &amp; win) in a simultaneous sequence</td><td>3</td></tr>
                  <tr><td>c. Last tile as the winning tile</td><td>1</td></tr>
                </tbody>
              </table>
            </div>
          </li>
          <li>
            <strong>Restrictions on winning under the Ping Hu rule</strong> (non-adherence may
            attract the Rule 15 penalty):
            <ol type="a">
              <li>No Dragon, own wind or round wind may be the pair (eye).</li>
              <li>All sets must be chows &mdash; sequential runs of 3 tiles, e.g. 5, 6, 7.</li>
              <li>The winning tile must come from a multi-sided wait.</li>
              <li>Winning on a tile that fills a gap (Ka Long) is not allowed, e.g. 6 for 5 &amp; 7.</li>
              <li>Winning on an edge wait is not allowed, e.g. 1 &amp; 2 waiting on 3.</li>
              <li>Winning on a tile that forms the pair is not allowed unless it is a multi-sided wait, e.g. 4 5 6 7 waiting on 4 or 7 as the eye.</li>
              <li>Points (c) to (f) do not apply if the win is self-drawn.</li>
            </ol>
          </li>
          <li>
            <strong>Assuming liabilities &mdash; &ldquo;Bao&rdquo; scenarios</strong> (no alerts
            given, Rule 13). Minimum display tiles:
            <div className="rules-table-wrap">
              <table>
                <tbody>
                  <tr><td>a) 3 sets of the same numeric shown (pong or chow)</td><td>Bao that numeric</td></tr>
                  <tr><td>b) 3 sets of 1 &amp; 9 pong</td><td>Bao 1 &amp; 9 numerics</td></tr>
                  <tr><td>c) 3 sets of wind pong</td><td>Bao the remaining wind</td></tr>
                  <tr><td>d) 3 sets of mixed winds and dragons pong</td><td>Bao the remaining winds &amp; dragon</td></tr>
                  <tr><td>e) 2 sets of dragon pong shown</td><td>Bao the remaining dragons</td></tr>
                  <tr><td>f) 3 doubles shown</td><td>Bao the wind giving 2 doubles (Rule 23f)</td></tr>
                  <tr><td>g) 4 doubles shown</td><td>Bao on dragons, own wind and round wind</td></tr>
                </tbody>
              </table>
            </div>
            <p>
              In a Bao situation, sequential priority applies: the last player who discarded a
              tile fitting the scenario assumes the liabilities, including on a self-drawn win.
              The winning tile need not be one that fits the scenario &mdash; the player who has
              already &ldquo;Bao-ed&rdquo; another in earlier moves still bears responsibility if
              that player eventually wins. There is no Bao if the win is on a tile discarded by a
              player not under the situation of assuming liabilities.
            </p>
          </li>
          <li>
            <strong>Wrong number of tiles.</strong>
            <ul>
              <li>
                <strong>More than 13 tiles (Da Xiang Gong):</strong> the player cannot Kong or
                win, cannot pong or chow, and should avoid discarding tiles others can win on. Aim
                for a draw.
              </li>
              <li>
                <strong>Fewer than 13 tiles (Xiao Xiang Gong):</strong> the player cannot win, but
                may Kong if the situation arises, and may pong. Avoid discarding tiles others can
                win on. Aim for a draw.
              </li>
            </ul>
          </li>
        </ol>

        <h2>Conclusion</h2>
        <p>
          These rules are a simplified version reflecting how Singapore Mahjong is commonly
          played. They can be adjusted to suit a different group of players or individual needs.
          Enjoy every session.
        </p>

        <h2>The Tiles</h2>
        <p>
          144 tiles: three numbered suits of 1&ndash;9 (four of each), the four winds, the three
          dragons, and eight bonus tiles &mdash; plus four optional animal tiles.
        </p>
        <div className="tile-chart">
          <div className="tile-chart-row">
            <span className="tile-chart-label">Dots / Circles</span>
            <TileRow tiles={RANKS.map((n) => `d${n}`)} />
          </div>
          <div className="tile-chart-row">
            <span className="tile-chart-label">Bamboo</span>
            <TileRow tiles={RANKS.map((n) => `b${n}`)} />
          </div>
          <div className="tile-chart-row">
            <span className="tile-chart-label">Characters</span>
            <TileRow tiles={RANKS.map((n) => `c${n}`)} />
          </div>
          <div className="tile-chart-row">
            <span className="tile-chart-label">Winds &mdash; East, South, West, North</span>
            <TileRow tiles={['we', 'ws', 'ww', 'wn']} />
          </div>
          <div className="tile-chart-row">
            <span className="tile-chart-label">Dragons &mdash; Red, Green, White</span>
            <TileRow tiles={['dr', 'dg', 'dw']} />
          </div>
          <div className="tile-chart-row">
            <span className="tile-chart-label">Flowers</span>
            <TileRow tiles={['f1', 'f2', 'f3', 'f4']} />
          </div>
          <div className="tile-chart-row">
            <span className="tile-chart-label">Seasons</span>
            <TileRow tiles={['s1', 's2', 's3', 's4']} />
          </div>
          <div className="tile-chart-row">
            <span className="tile-chart-label">Animals (optional)</span>
            <TileRow tiles={['a1', 'a2', 'a3', 'a4']} />
          </div>
        </div>

        <h2>Glossary</h2>
        <dl className="rules-glossary">
          <dt>Chow</dt>
          <dd>
            <p>
              Taking a tile discarded by the player on your left to complete a run of three
              sequential tiles of the same suit.
            </p>
            <TileRow tiles={['b5', 'b6', 'b7']} />
          </dd>
          <dt>Pong</dt>
          <dd>
            <p>
              Taking a discarded tile that matches a concealed pair of the same tile to make a
              triplet. It can be done out of turn; you must call it as the tile is discarded.
            </p>
            <TileRow tiles={['c3', 'c3', 'c3']} />
          </dd>
          <dt>Kong</dt>
          <dd>
            <p>Four identical tiles &mdash; same numeric suit, dragon, or wind.</p>
            <TileRow tiles={['d2', 'd2', 'd2', 'd2']} />
          </dd>
          <dt>Dragon tiles</dt>
          <dd>
            <p>Red, Green and White.</p>
            <TileRow tiles={['dr', 'dg', 'dw']} />
          </dd>
          <dt>Wind tiles</dt>
          <dd>
            <p>East, South, West and North.</p>
            <TileRow tiles={['we', 'ws', 'ww', 'wn']} />
          </dd>
        </dl>
      </article>
    </div>
  );
}

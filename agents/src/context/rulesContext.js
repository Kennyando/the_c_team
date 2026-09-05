// One line naming the scoring patterns this table is playing under, so a review can mention "you
// were close to a half flush, which this table rewards" without the model having to be told the
// house rules some other way. Reuses scoring.js's own label map — the same text the Settings
// screen shows the player.

import { RULE_LABELS } from '@kaki/game';

/**
 * @param {Object} rules  the game's `state.rules` object
 * @returns {{ limit:number, active:string[], line:string }}
 */
export function rulesContext(rules) {
  const r = rules && typeof rules === 'object' ? rules : {};
  const active = Object.keys(RULE_LABELS).filter((k) => r[k] === true).map((k) => RULE_LABELS[k]);
  const limit = typeof r.limit === 'number' ? r.limit : 5;
  const line = active.length
    ? `This table scores: ${active.join('; ')}. Limit ${limit} tai.`
    : `This table is playing a plain game with a ${limit} tai limit.`;
  return { limit, active, line };
}

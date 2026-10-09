/**
 * kanban next-id — the next free ticket id: highest id across ALL columns (done
 * included) + 1. Deterministic — no eyeballing a possibly-truncated board.
 *
 *   kanban next-id          42
 *   kanban next-id --pad    0042  (ready to use in a filename)
 */

import { requireBoardDir } from '../tickets.mjs';
import { loadTickets } from './search.mjs';

export function run(args) {
	const ids = loadTickets(requireBoardDir()).map((t) => t.id);
	const next = Math.max(0, ...ids) + 1;
	console.log(args.includes('--pad') ? String(next).padStart(4, '0') : String(next));
}

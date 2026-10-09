/**
 * kanban board — the opinionated, human-facing snapshot, grouped by column.
 *
 *   kanban board          backlog + ready + in-progress (done is hidden)
 *   kanban board --done   include the done archive too
 *
 * For a flat, filterable, sortable index built for pipes, use `kanban search`.
 */

import {
	ACTIVE_COLUMNS,
	COLUMNS,
	padId,
	readFrontmatter,
	requireBoardDir,
	ticketFiles,
} from '../tickets.mjs';

function toRow(file) {
	const fm = readFrontmatter(file) ?? {};
	const deps = Array.isArray(fm.depends_on) ? fm.depends_on : [];
	return {
		id: typeof fm.id === 'number' ? fm.id : 0,
		type: typeof fm.type === 'string' ? fm.type : '?',
		priority: typeof fm.priority === 'string' ? fm.priority : '·',
		title: typeof fm.title === 'string' ? fm.title : '(untitled)',
		blocked: deps.length
			? `  ↳ needs ${deps.map((d) => padId(Number(d))).join(', ')}`
			: '',
	};
}

export function run(args) {
	const boardDir = requireBoardDir();
	const columns = args.includes('--done') ? COLUMNS : ACTIVE_COLUMNS;

	const out = ['', 'kanban board', ''];
	for (const column of columns) {
		const rows = ticketFiles(boardDir, column).map(toRow);
		out.push(`${column} (${rows.length})`);
		if (rows.length === 0) {
			out.push('  —');
		} else {
			for (const r of rows) {
				out.push(
					`  ${padId(r.id)}  ${r.type.padEnd(9)} ${r.priority.padEnd(3)} ${r.title}${r.blocked}`,
				);
			}
		}
		out.push('');
	}
	console.log(out.join('\n'));
}

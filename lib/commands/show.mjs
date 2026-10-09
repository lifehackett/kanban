/**
 * kanban show — print full ticket content (frontmatter + body).
 *
 *   kanban show backlog        every ticket in a column (backlog|ready|in-progress|done)
 *   kanban show 10 7 22        specific tickets by id (#0010, 10, and 0010 all work)
 *   kanban show backlog 29     mix columns and ids
 */

import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import {
	COLUMNS,
	readFrontmatter,
	requireBoardDir,
	ticketFiles,
} from '../tickets.mjs';

export function run(args) {
	if (args.length === 0) {
		console.error(
			'usage: kanban show <column|id> [...]\n' +
				'  columns: backlog | ready | in-progress | done\n' +
				'  ids:     10  #0010  0010',
		);
		process.exit(1);
	}

	const boardDir = requireBoardDir();
	const tickets = COLUMNS.flatMap((column) =>
		ticketFiles(boardDir, column).map((file) => ({ column, file })),
	);

	const resolved = [];
	const missing = [];
	for (const arg of args) {
		if (COLUMNS.includes(arg)) {
			resolved.push(...tickets.filter((t) => t.column === arg));
			continue;
		}
		const id = Number(arg.replace(/^#/, ''));
		const match = tickets.find((t) => readFrontmatter(t.file)?.id === id);
		if (match) resolved.push(match);
		else missing.push(arg);
	}

	// De-dupe (a column + an id in it, or a repeated arg) while preserving order.
	const seen = new Set();
	const out = [];
	for (const { column, file } of resolved) {
		if (seen.has(file)) continue;
		seen.add(file);
		out.push(`\n===== [${column}] ${basename(file)} =====`);
		out.push(readFileSync(file, 'utf8').trimEnd());
	}
	if (missing.length) out.push(`\n(no ticket found for: ${missing.join(', ')})`);

	console.log(out.join('\n'));
}

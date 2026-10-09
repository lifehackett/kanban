/**
 * kanban search — the flat, machine-friendly list/search over tickets, built for
 * pipes and scripts. Read-only.
 *
 *   kanban search                        every ticket, all columns, id asc
 *   kanban search walk                   tickets whose title contains "walk"
 *   kanban search --sort id:desc         sort by <field>[:<dir>]
 *                                        field: id|title|priority|created, dir: asc|desc
 *   kanban search --column backlog,ready restrict to columns (default: all four)
 *   kanban search --active               backlog + ready + in-progress (exclude done)
 *   kanban search --type bug --priority p1
 *   kanban search --json                 JSON array instead of tab-separated lines
 *
 * Output (tab-separated, one ticket per line): id  column  priority  type  title
 */

import {
	ACTIVE_COLUMNS,
	COLUMNS,
	readFrontmatter,
	requireBoardDir,
	ticketFiles,
} from '../tickets.mjs';

const SORT_FIELDS = ['id', 'title', 'priority', 'created'];

/** p0 (highest) sorts before p2; an unset priority sorts last. */
const PRIORITY_RANK = { p0: 0, p1: 1, p2: 2 };

function fail(message) {
	console.error(`kanban search: ${message}`);
	process.exit(1);
}

function toTicket(column, file) {
	const fm = readFrontmatter(file) ?? {};
	const deps = Array.isArray(fm.depends_on) ? fm.depends_on : [];
	return {
		id: typeof fm.id === 'number' ? fm.id : 0,
		column,
		type: typeof fm.type === 'string' ? fm.type : '?',
		priority: typeof fm.priority === 'string' ? fm.priority : '',
		title: typeof fm.title === 'string' ? fm.title : '(untitled)',
		created: typeof fm.created === 'string' ? fm.created : '',
		depends_on: deps.map(Number).filter(Number.isFinite),
	};
}

function parseSort(raw) {
	if (!raw) return { field: 'id', dir: 'asc' };
	const [field, dir = 'asc'] = raw.split(':');
	if (!SORT_FIELDS.includes(field)) {
		fail(`unknown --sort field '${field}' (expected: ${SORT_FIELDS.join('|')})`);
	}
	if (dir !== 'asc' && dir !== 'desc') {
		fail(`unknown --sort direction '${dir}' (expected: asc|desc)`);
	}
	return { field, dir };
}

function parseColumns(raw, active) {
	if (active && raw) fail('use either --active or --column, not both');
	if (active) return ACTIVE_COLUMNS;
	if (!raw) return COLUMNS;
	const names = raw
		.split(',')
		.map((s) => s.trim())
		.filter(Boolean);
	for (const n of names) {
		if (!COLUMNS.includes(n)) {
			fail(`unknown column '${n}' (expected: ${COLUMNS.join('|')})`);
		}
	}
	return names;
}

function compare(a, b, field) {
	switch (field) {
		case 'id':
			return a.id - b.id;
		case 'title':
			return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
		case 'created':
			return a.created.localeCompare(b.created);
		case 'priority':
			return (PRIORITY_RANK[a.priority] ?? 99) - (PRIORITY_RANK[b.priority] ?? 99);
	}
}

/** Every ticket across the given columns (all four by default). */
export function loadTickets(boardDir, columns = COLUMNS) {
	return columns.flatMap((column) =>
		ticketFiles(boardDir, column).map((file) => toTicket(column, file)),
	);
}

export function run(args) {
	let query;
	let sortRaw;
	let columnRaw;
	let typeFilter;
	let priorityFilter;
	let json = false;
	let active = false;

	// Manual index walk — handles `--flag value` and `--flag=value`.
	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		const eq = arg.indexOf('=');
		const name = eq === -1 ? arg : arg.slice(0, eq);
		const inline = eq === -1 ? undefined : arg.slice(eq + 1);

		if (name === '--json') json = true;
		else if (name === '--active') active = true;
		else if (name === '--sort') sortRaw = inline ?? args[++i];
		else if (name === '--column') columnRaw = inline ?? args[++i];
		else if (name === '--type') typeFilter = inline ?? args[++i];
		else if (name === '--priority') priorityFilter = inline ?? args[++i];
		else if (arg.startsWith('--')) fail(`unknown flag '${arg}'`);
		else if (query === undefined) query = arg;
		else fail(`unexpected extra argument '${arg}'`);
	}

	const { field, dir } = parseSort(sortRaw);
	let tickets = loadTickets(requireBoardDir(), parseColumns(columnRaw, active));

	if (query) {
		const q = query.toLowerCase();
		tickets = tickets.filter((t) => t.title.toLowerCase().includes(q));
	}
	if (typeFilter) tickets = tickets.filter((t) => t.type === typeFilter);
	if (priorityFilter) tickets = tickets.filter((t) => t.priority === priorityFilter);

	tickets.sort((a, b) => compare(a, b, field));
	if (dir === 'desc') tickets.reverse();

	if (json) {
		console.log(JSON.stringify(tickets, null, 2));
		return;
	}
	for (const t of tickets) {
		console.log([t.id, t.column, t.priority || '·', t.type, t.title].join('\t'));
	}
}

/**
 * kanban hook — the Claude Code hook entry points wired in hooks/hooks.json.
 * Not meant to be run by hand.
 *
 *   kanban hook post-write   PostToolUse(Write|Edit): reads the hook JSON on stdin;
 *                            if the touched file is an active-column ticket, validate
 *                            it. Exit 2 + stderr feeds the errors back to Claude for
 *                            a same-turn fix. Any other file → silent exit 0.
 *   kanban hook session      SessionStart: sweep the active columns and print any
 *                            drift to stdout (added to session context). Always
 *                            exit 0 — never break startup, and stay silent in a repo
 *                            with no board.
 */

import { basename, dirname, relative, resolve } from 'node:path';
import { ACTIVE_COLUMNS, findBoardDir } from '../tickets.mjs';
import { activeTicketFiles, renderProblems, validateFile } from './check.mjs';

async function readStdin() {
	let data = '';
	for await (const chunk of process.stdin) data += chunk;
	return data;
}

/** True when `file` is `<board>/<active column>/<ticket>.md`. */
function isActiveTicket(boardDir, file) {
	if (!file.endsWith('.md') || basename(file) === '_template.md') return false;
	const column = relative(boardDir, dirname(file));
	return ACTIVE_COLUMNS.includes(column);
}

async function postWrite() {
	let filePath;
	try {
		filePath = JSON.parse(await readStdin())?.tool_input?.file_path;
	} catch {
		return;
	}
	if (typeof filePath !== 'string') return;

	const boardDir = findBoardDir();
	if (!boardDir) return;
	const file = resolve(process.env.CLAUDE_PROJECT_DIR ?? process.cwd(), filePath);
	if (!isActiveTicket(boardDir, file)) return;

	const problem = validateFile(file);
	if (!problem) return;
	process.stderr.write(`Kanban ticket schema errors:\n${renderProblems([problem])}\n`);
	process.exit(2);
}

function session() {
	const boardDir = findBoardDir();
	if (!boardDir) return;
	const problems = activeTicketFiles(boardDir).map(validateFile).filter(Boolean);
	if (problems.length > 0) {
		console.log(
			`⚠ ${problems.length} kanban ticket(s) fail the frontmatter schema:\n${renderProblems(problems)}`,
		);
	}
}

export async function run(args) {
	const [event] = args;
	try {
		if (event === 'post-write') await postWrite();
		else if (event === 'session') session();
		else {
			console.error(`kanban hook: unknown event '${event}' (expected post-write|session)`);
			process.exit(1);
		}
	} catch (err) {
		// A crashing hook must never block Claude — report and move on.
		console.error(`kanban hook ${event}: ${err.message}`);
	}
}

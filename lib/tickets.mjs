/**
 * Shared board helpers — where the board lives, the column layout, and reading a
 * ticket's frontmatter. Every command goes through here so they agree on what a
 * ticket is and where it lives.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { extractFrontmatter, parseYaml } from './frontmatter.mjs';

export const COLUMNS = ['backlog', 'ready', 'in-progress', 'done'];
export const ACTIVE_COLUMNS = ['backlog', 'ready', 'in-progress'];

const NON_TICKET = new Set(['_template.md', 'README.md']);

const isDir = (p) => existsSync(p) && statSync(p).isDirectory();

/**
 * Locate the board directory:
 *   1. $KANBAN_DIR (absolute, or relative to cwd)
 *   2. $CLAUDE_PROJECT_DIR/kanban
 *   3. the nearest `kanban/` walking up from cwd
 * Returns null when there is no board.
 */
export function findBoardDir() {
	if (process.env.KANBAN_DIR) {
		const dir = resolve(process.env.KANBAN_DIR);
		return isDir(dir) ? dir : null;
	}
	if (process.env.CLAUDE_PROJECT_DIR) {
		const dir = join(process.env.CLAUDE_PROJECT_DIR, 'kanban');
		if (isDir(dir)) return dir;
	}
	let current = process.cwd();
	while (true) {
		const candidate = join(current, 'kanban');
		if (isDir(candidate)) return candidate;
		const parent = dirname(current);
		if (parent === current) return null;
		current = parent;
	}
}

/** The board dir, or exit with a hint to run `kanban init`. */
export function requireBoardDir() {
	const dir = findBoardDir();
	if (!dir) {
		console.error(
			'kanban: no kanban/ directory found (looked in $KANBAN_DIR, $CLAUDE_PROJECT_DIR, and up from cwd).\n' +
				'Run `kanban init` at your repo root to create one.',
		);
		process.exit(1);
	}
	return dir;
}

/** Absolute paths of the `*.md` tickets in a column, sorted (skips _template.md/README.md). */
export function ticketFiles(boardDir, column) {
	const dir = join(boardDir, column);
	if (!existsSync(dir)) return [];
	return readdirSync(dir)
		.filter((name) => name.endsWith('.md') && !NON_TICKET.has(name))
		.sort()
		.map((name) => join(dir, name));
}

/** Parse a ticket's frontmatter to a raw object (no validation). null if absent/unparseable. */
export function readFrontmatter(file) {
	const frontmatter = extractFrontmatter(readFileSync(file, 'utf8'));
	if (frontmatter === null) return null;
	try {
		return parseYaml(frontmatter);
	} catch {
		return null;
	}
}

/** `42` → `#0042`. */
export function padId(id) {
	return `#${String(id).padStart(4, '0')}`;
}

/**
 * kanban init — scaffold a board in the current directory (run at your repo root):
 *
 *   kanban/
 *     README.md       how the board works (format, Definition of Ready, validation)
 *     _template.md    the ticket template
 *     backlog/ ready/ in-progress/ done/   (each with a .gitkeep)
 *
 * Never overwrites: existing files are left alone and reported as skipped.
 */

import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COLUMNS } from '../tickets.mjs';

const TEMPLATES = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'templates');

export function run() {
	const boardDir = process.env.KANBAN_DIR
		? resolve(process.env.KANBAN_DIR)
		: join(process.cwd(), 'kanban');
	const created = [];
	const skipped = [];
	const rel = (p) => relative(process.cwd(), p) || '.';

	for (const column of COLUMNS) {
		const dir = join(boardDir, column);
		mkdirSync(dir, { recursive: true });
		const keep = join(dir, '.gitkeep');
		if (existsSync(keep)) skipped.push(rel(keep));
		else {
			writeFileSync(keep, '');
			created.push(rel(keep));
		}
	}
	for (const name of ['README.md', '_template.md']) {
		const target = join(boardDir, name);
		if (existsSync(target)) skipped.push(rel(target));
		else {
			copyFileSync(join(TEMPLATES, name), target);
			created.push(rel(target));
		}
	}

	if (created.length) console.log(`created:\n${created.map((p) => `  ${p}`).join('\n')}`);
	if (skipped.length) console.log(`already present (left alone):\n${skipped.map((p) => `  ${p}`).join('\n')}`);
	console.log(
		'\nNext: `kanban install-git-hook` to validate tickets on commit (optional).',
	);
}

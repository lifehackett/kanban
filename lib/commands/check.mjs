/**
 * kanban check — validate ticket frontmatter against the schema.
 *
 *   kanban check              sweep every ticket in the active columns; human summary.
 *   kanban check <file>...    validate just these files (git pre-commit uses this).
 *
 * Exit 2 + stderr on any failure. Only the active columns are swept: done/ is a
 * frozen archive — a later schema tweak must not retroactively flag closed work.
 */

import { readFileSync } from 'node:fs';
import { extractFrontmatter, parseYaml } from '../frontmatter.mjs';
import { validateFrontmatter } from '../schema.mjs';
import { ACTIVE_COLUMNS, requireBoardDir, ticketFiles } from '../tickets.mjs';

/** Validate one file → { file, messages } on failure, null when valid. */
export function validateFile(file) {
	let raw;
	try {
		raw = readFileSync(file, 'utf8');
	} catch {
		return { file, messages: ['unreadable file'] };
	}
	const frontmatter = extractFrontmatter(raw);
	if (frontmatter === null) {
		return { file, messages: ['missing YAML frontmatter (--- … ---)'] };
	}
	let data;
	try {
		data = parseYaml(frontmatter);
	} catch (err) {
		return { file, messages: [`invalid frontmatter: ${err.message}`] };
	}
	const messages = validateFrontmatter(data);
	return messages.length ? { file, messages } : null;
}

export function renderProblems(problems) {
	return problems
		.map((p) => `  ✗ ${p.file}\n${p.messages.map((m) => `      - ${m}`).join('\n')}`)
		.join('\n');
}

/** Every ticket in the active columns. */
export function activeTicketFiles(boardDir) {
	return ACTIVE_COLUMNS.flatMap((column) => ticketFiles(boardDir, column));
}

export function run(args) {
	const paths = args.filter((a) => !a.startsWith('--'));
	const sweep = paths.length === 0;
	const files = sweep ? activeTicketFiles(requireBoardDir()) : paths;

	const problems = files.map(validateFile).filter(Boolean);
	if (problems.length === 0) {
		if (sweep) console.log(`✓ ${files.length} kanban ticket(s) valid`);
		return;
	}
	process.stderr.write(`Kanban ticket schema errors:\n${renderProblems(problems)}\n`);
	process.exit(2);
}

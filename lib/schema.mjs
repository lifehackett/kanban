/**
 * The ticket frontmatter schema — the single source of truth every validation
 * trigger shares (the PostToolUse write hook, the SessionStart sweep, the git
 * pre-commit gate, and `kanban check`).
 *
 * Only the *metadata* is schematized. A ticket's body (problem/context,
 * acceptance-criteria checklist, notes) stays free-form markdown by design.
 *
 * Strict: an unknown/typo'd key (`prioriy: p1`) is a hard error rather than a
 * silently-ignored field — catching drift is the whole point of the schema.
 */

export const TICKET_TYPES = [
	'bug',
	'feature',
	'refactor',
	'test',
	'docs',
	'chore',
	'spike',
];
export const PRIORITIES = ['p0', 'p1', 'p2'];
export const SIZES = ['S', 'M', 'L'];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const isPositiveInt = (v) => Number.isInteger(v) && v > 0;
const isNonEmptyString = (v) => typeof v === 'string' && v.length > 0;
const oneOf = (values) => (v) => values.includes(v);

/**
 * field → { required, check, expected }. `expected` is the human message shown
 * when `check` fails.
 */
const FIELDS = {
	/** Stable numeric id (the `NNNN-slug` filename convention). Never reused. */
	id: { required: true, check: isPositiveInt, expected: 'a positive integer' },
	title: { required: true, check: isNonEmptyString, expected: 'a non-empty string' },
	type: {
		required: true,
		check: oneOf(TICKET_TYPES),
		expected: `one of ${TICKET_TYPES.join(' | ')}`,
	},
	/** Subsystem tags, e.g. [chat, api]. Free-form; empty is allowed. */
	area: {
		check: (v) => Array.isArray(v) && v.every(isNonEmptyString),
		expected: 'a list of non-empty strings, e.g. [chat, api]',
	},
	/** Optional while in backlog/ — a Definition-of-Ready gate for ready/. */
	priority: {
		check: oneOf(PRIORITIES),
		expected: `one of ${PRIORITIES.join(' | ')}`,
	},
	size: { check: oneOf(SIZES), expected: `one of ${SIZES.join(' | ')}` },
	created: {
		required: true,
		check: (v) => typeof v === 'string' && ISO_DATE.test(v),
		expected: 'an ISO date (YYYY-MM-DD)',
	},
	/** Set by the `done` transition. Active columns leave it absent. */
	completed: {
		check: (v) => typeof v === 'string' && ISO_DATE.test(v),
		expected: 'an ISO date (YYYY-MM-DD)',
	},
	/** Ticket ids that must land first. */
	depends_on: {
		check: (v) => Array.isArray(v) && v.every(isPositiveInt),
		expected: 'a list of ticket ids, e.g. [12, 40]',
	},
	/** Optional path to the epic/spec this ticket decomposes. */
	spec: { check: isNonEmptyString, expected: 'a non-empty path' },
};

/** Validate parsed frontmatter. Returns a list of `field: message` problems (empty = valid). */
export function validateFrontmatter(data) {
	if (!data || typeof data !== 'object' || Array.isArray(data)) {
		return ['(root): frontmatter must be a `key: value` mapping'];
	}
	const problems = [];
	for (const key of Object.keys(data)) {
		if (!Object.hasOwn(FIELDS, key)) {
			problems.push(
				`${key}: unknown field (allowed: ${Object.keys(FIELDS).join(', ')})`,
			);
		}
	}
	for (const [key, rule] of Object.entries(FIELDS)) {
		const value = data[key];
		if (value === undefined) {
			if (rule.required) problems.push(`${key}: required`);
			continue;
		}
		if (!rule.check(value)) {
			problems.push(`${key}: expected ${rule.expected}, got ${JSON.stringify(value)}`);
		}
	}
	return problems;
}

/**
 * Frontmatter reader — a deliberately tiny YAML subset parser so the plugin has
 * zero npm dependencies (it runs on plain `node`, nothing to install).
 *
 * Supported (everything a ticket needs):
 *   key: value            one flat mapping, one key per line
 *   # comment             full-line comments and blank lines
 *   value # comment       trailing comments on unquoted values
 *   "double" / 'single'   quoted strings ("…" uses JSON escapes, '' escapes ')
 *   [a, "b", 3]           flow sequences of scalars
 *   42 / true / null / ~  ints, booleans, nulls; anything else is a plain string
 *
 * Dates stay strings (`created: 2026-07-07` → "2026-07-07"). Anything outside the
 * subset (nested maps, block lists, multi-line strings) is reported as an error
 * rather than guessed at — the validator surfaces it like any schema problem.
 */

/** Pull the YAML block out of a `---\n…\n---\n` fence. null if absent. */
export function extractFrontmatter(raw) {
	const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
	return match ? match[1] : null;
}

/** Strip a trailing ` # comment` from an unquoted value. */
function stripComment(text) {
	const idx = text.search(/(^|\s)#/);
	return (idx === -1 ? text : text.slice(0, idx)).trim();
}

function parseQuoted(text) {
	if (text.startsWith('"')) {
		const end = findClosingQuote(text, '"');
		if (end === -1) throw new Error(`unterminated string: ${text}`);
		const rest = stripComment(text.slice(end + 1));
		if (rest) throw new Error(`unexpected text after string: ${rest}`);
		return JSON.parse(text.slice(0, end + 1));
	}
	const end = findClosingQuote(text, "'");
	if (end === -1) throw new Error(`unterminated string: ${text}`);
	const rest = stripComment(text.slice(end + 1));
	if (rest) throw new Error(`unexpected text after string: ${rest}`);
	return text.slice(1, end).replaceAll("''", "'");
}

/** Index of the quote closing the string opened at text[0], or -1. */
function findClosingQuote(text, quote) {
	for (let i = 1; i < text.length; i++) {
		if (quote === '"' && text[i] === '\\') {
			i++;
			continue;
		}
		if (text[i] === quote) {
			if (quote === "'" && text[i + 1] === "'") {
				i++;
				continue;
			}
			return i;
		}
	}
	return -1;
}

function parsePlain(text) {
	if (text === '' || text === '~' || text === 'null') return null;
	if (text === 'true') return true;
	if (text === 'false') return false;
	if (/^-?\d+$/.test(text)) return Number(text);
	return text;
}

function parseScalar(text) {
	if (text.startsWith('"') || text.startsWith("'")) return parseQuoted(text);
	return parsePlain(stripComment(text));
}

/** Split a flow sequence body on top-level commas (respecting quotes). */
function splitFlow(body) {
	const items = [];
	let current = '';
	let quote = null;
	for (let i = 0; i < body.length; i++) {
		const ch = body[i];
		if (quote) {
			current += ch;
			if (quote === '"' && ch === '\\') current += body[++i] ?? '';
			else if (ch === quote) quote = null;
		} else if (ch === '"' || ch === "'") {
			quote = ch;
			current += ch;
		} else if (ch === ',') {
			items.push(current.trim());
			current = '';
		} else if (ch === '[' || ch === ']' || ch === '{' || ch === '}') {
			throw new Error('nested collections are not supported');
		} else {
			current += ch;
		}
	}
	if (quote) throw new Error('unterminated string in list');
	if (current.trim()) items.push(current.trim());
	else if (items.length) throw new Error('trailing comma in list');
	return items;
}

function parseValue(text) {
	if (!text.startsWith('[')) return parseScalar(text);
	const close = text.lastIndexOf(']');
	if (close === -1) throw new Error(`unterminated list: ${text}`);
	const rest = stripComment(text.slice(close + 1));
	if (rest) throw new Error(`unexpected text after list: ${rest}`);
	return splitFlow(text.slice(1, close)).map(parseScalar);
}

/**
 * Parse frontmatter YAML → plain object. Throws an Error naming the offending
 * line on anything outside the supported subset.
 */
export function parseYaml(source) {
	const data = {};
	const lines = source.split(/\r?\n/);
	for (let n = 0; n < lines.length; n++) {
		const line = lines[n];
		if (/^\s*(#.*)?$/.test(line)) continue;
		const match = line.match(/^([A-Za-z_][\w-]*)\s*:(?:\s+(.*))?$/);
		if (!match) {
			throw new Error(
				`line ${n + 1}: expected \`key: value\` (only flat frontmatter is supported): ${line.trim()}`,
			);
		}
		const [, key, rawValue = ''] = match;
		if (Object.hasOwn(data, key)) {
			throw new Error(`line ${n + 1}: duplicate key '${key}'`);
		}
		try {
			data[key] = parseValue(rawValue.trim());
		} catch (err) {
			throw new Error(`line ${n + 1}: ${err.message}`);
		}
	}
	return data;
}

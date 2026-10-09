/**
 * kanban install-git-hook — install a git pre-commit hook that validates staged
 * active-column tickets, so a hand-edit (not just an agent write) can't drift the
 * schema into the repo.
 *
 *   kanban install-git-hook           refuses if a pre-commit hook already exists
 *   kanban install-git-hook --force   overwrite an existing pre-commit hook
 *   kanban install-git-hook --print   print the hook instead of installing it
 *                                     (to merge into an existing hook by hand)
 *
 * The plugin's install path changes on every plugin update, so the hook doesn't
 * hard-code it: it uses `kanban` from PATH when available, else the newest copy
 * in the Claude Code plugin cache. If neither is found it warns and lets the
 * commit through rather than blocking.
 */

import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, relative } from 'node:path';

const HOOK = `#!/bin/sh
# Installed by the kanban Claude Code plugin (\`kanban install-git-hook\`).
# Validates staged kanban tickets (active columns) against the frontmatter schema.
staged=$(git diff --cached --name-only --diff-filter=ACM \\
	| grep -E '(^|/)kanban/(backlog|ready|in-progress)/[^/]+\\.md$' \\
	| grep -v '/_template\\.md$')
[ -z "$staged" ] && exit 0

KANBAN=$(command -v kanban 2>/dev/null)
if [ -z "$KANBAN" ]; then
	KANBAN=$(ls -d "$HOME"/.claude/plugins/cache/*/kanban/*/bin/kanban 2>/dev/null | sort -V | tail -1)
fi
if [ -z "$KANBAN" ]; then
	echo "kanban pre-commit: plugin not found — skipping ticket validation" >&2
	exit 0
fi

echo "$staged" | xargs "$KANBAN" check
`;

function gitHooksDir() {
	const out = execFileSync('git', ['rev-parse', '--git-path', 'hooks'], {
		encoding: 'utf8',
	}).trim();
	return isAbsolute(out) ? out : join(process.cwd(), out);
}

export function run(args) {
	if (args.includes('--print')) {
		process.stdout.write(HOOK);
		return;
	}
	let hooksDir;
	try {
		hooksDir = gitHooksDir();
	} catch {
		console.error('kanban install-git-hook: not inside a git repository');
		process.exit(1);
	}
	const target = join(hooksDir, 'pre-commit');
	if (existsSync(target) && !args.includes('--force')) {
		console.error(
			`kanban install-git-hook: ${relative(process.cwd(), target)} already exists.\n` +
				'Re-run with --force to overwrite it, or --print to merge the hook in by hand.',
		);
		process.exit(1);
	}
	writeFileSync(target, HOOK);
	chmodSync(target, 0o755);
	console.log(`installed ${relative(process.cwd(), target)}`);
}

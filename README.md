# kanban — a text-based kanban board for Claude Code

Your backlog lives in your repo as markdown files. A ticket's **column is its
directory** (`kanban/backlog/`, `ready/`, `in-progress/`, `done/`), so moving a
ticket is a `git mv` and the whole history is in git. Claude operates the board
through the `kanban` skill; you and Claude both read it through the `kanban` CLI.

What you get:

- **`kanban` skill** — "review the backlog", "groom #0042", "add a ticket: …",
  "start the streaming ticket", "mark #0042 done", "show the board".
- **`kanban` CLI** (on Claude's PATH while the plugin is enabled) — `board`,
  `show`, `search`, `next-id`, `check`, `init`, `install-git-hook`.
- **Validation hooks** — every ticket Claude writes is checked against the
  frontmatter schema immediately (errors go straight back to Claude), and schema
  drift is surfaced at session start.

Zero dependencies — just Node 18+. Nothing to `npm install`.

## Install

In Claude Code:

```
/plugin marketplace add lifehackett/kanban
/plugin install kanban@lifehackett-kanban
```

Or enable it for everyone working in a repo by committing this to
`.claude/settings.json`:

```json
{
	"extraKnownMarketplaces": {
		"lifehackett-kanban": {
			"source": { "source": "github", "repo": "lifehackett/kanban" }
		}
	},
	"enabledPlugins": {
		"kanban@lifehackett-kanban": true
	}
}
```

## Set up a board

Ask Claude to "set up a kanban board", or run it yourself at the repo root:

```
kanban init                # creates kanban/{backlog,ready,in-progress,done}, README.md, _template.md
kanban install-git-hook    # optional: validate tickets on every commit
```

(Outside Claude Code the CLI isn't on your PATH — run it as
`~/.claude/plugins/cache/lifehackett-kanban/kanban/<version>/bin/kanban`, or
symlink it somewhere on your PATH.)

`kanban/README.md` (created by `init`) documents the ticket format, the
Definition of Ready, and the validation rules.

## Fewer permission prompts (recommended)

The skill pre-approves its read-only commands while it's running. To also skip
prompts when Claude runs them outside the skill, add to `.claude/settings.json`:

```json
{
	"permissions": {
		"allow": [
			"Bash(kanban board*)",
			"Bash(kanban show *)",
			"Bash(kanban search*)",
			"Bash(kanban next-id*)",
			"Bash(kanban check*)"
		]
	}
}
```

## CLI

```
kanban board [--done]           human index of the active columns (+ archive)
kanban show <column|id> [...]   full tickets: `kanban show backlog`, `kanban show 10 #0022`
kanban search [query] [flags]   flat tab-separated index: --sort id:desc, --active,
                                --column backlog,ready, --type bug, --priority p1, --json
kanban next-id [--pad]          next free id (highest across all columns + 1)
kanban check [file...]          validate all active tickets, or just these files
kanban init                     scaffold kanban/ in the current directory
kanban install-git-hook         git pre-commit validation (--force, --print)
```

The board is found via `$KANBAN_DIR`, else `$CLAUDE_PROJECT_DIR/kanban`, else the
nearest `kanban/` walking up from the current directory.

## Ticket schema

```yaml
id: 42                   # required, positive int, never reused
title: Markdown formatting in chat output   # required; quote it if it has `:` or `#`
type: feature            # required: bug | feature | refactor | test | docs | chore | spike
area: [chat]             # optional free-form tags
priority: p2             # optional: p0 | p1 | p2 (required to enter ready/)
size: S                  # optional: S | M | L
created: 2026-07-07      # required, YYYY-MM-DD
completed: 2026-07-09    # set when moved to done/
depends_on: [12]         # optional ticket ids
spec: docs/specs/foo.md  # optional link
```

Unknown keys are rejected (typos like `prioriy:` don't slip through). Frontmatter
is flat `key: value` only. `done/` is never validated — the archive is frozen. To
change the allowed values, edit `lib/schema.mjs`.

---
name: kanban
description: Manage the project's text-based kanban board under kanban/ (columns backlog/ready/in-progress/done). Use when asked to review the backlog, surface candidates to promote to ready, groom/refine a ticket toward Ready, create a ticket, start or complete a ticket, move a ticket between columns, show the board, or set up a new board. Tickets are markdown files with schema-validated YAML frontmatter.
allowed-tools:
  - Bash(kanban board*)
  - Bash(kanban show *)
  - Bash(kanban search*)
  - Bash(kanban next-id*)
  - Bash(kanban check*)
---

# Kanban

The project's work queue is a text-based board in `kanban/`. A ticket's **column
is its directory** — transitioning a ticket is a `git mv`. Read `kanban/README.md`
for the format (the frontmatter schema, Definition of Ready). This skill is _how
you operate the board_.

All reading goes through the `kanban` CLI (shipped by this plugin, on your PATH).
If `kanban` isn't found, fall back to `"${CLAUDE_PLUGIN_ROOT}/bin/kanban"`.

If the repo has **no `kanban/` directory**, offer to create one with `kanban init`
(run at the repo root) — don't hand-build the structure.

## Ground rules

- **Frontmatter is schematized, the body is free-form.** Never put acceptance
  criteria or prose into YAML — they belong in the markdown body as a checklist.
  Frontmatter is flat `key: value` only; quote a `title` containing `:` or `#`.
- **Transition = `git mv`.** Move the file between column dirs; never copy-delete
  (it loses history). Keep the id and filename stable across the move.
- **Ids are stable and never reused.** Get the next one **deterministically** —
  don't eyeball the board (a truncated view yields a wrong id → a duplicate):

  ```
  kanban next-id --pad     # e.g. 0042 — highest id across all columns + 1
  ```
- **Do not `git commit`** unless the user asks.

## The board

```
kanban board               # opinionated human index: backlog + ready + in-progress
kanban board --done        # also show the done archive
kanban show backlog        # full frontmatter + body of every ticket in a column
kanban show 10 22          # full content of specific tickets by id (#0010, 10, 0010)
kanban search              # flat, machine-readable index — filter/sort/pipe
kanban check               # validate every active ticket's frontmatter
```

Reach for these instead of `cat`/`awk`/`ls` loops. `board` is the human index
(relay its output); `show` is the detail (a whole column, or a handful of ids — mix
them: `kanban show ready 29`). Prefer `show` over the Read tool when pulling more
than one or two tickets — it's one call.

`search` is the **scriptable** index — flat tab-separated `id  column  priority
type  title`, one ticket per line, across _all_ columns by default. Supports
`--sort <id|title|priority|created>[:<dir>]`, a title-substring query,
`--column`/`--active`/`--type`/`--priority` filters, and `--json`. Use it whenever
you need a computed answer.

**Don't truncate `board`/`show`** (`| tail`, `| head`, `| sed -n`) — they're the
human views; cutting them drops rows and corrupts ticket resolution. Pipe `search`
instead (that's what it's for).

## Resolving a ticket

A verb may name a ticket by **id** (`#0042`, `42`) or by a **description** — the
user is more likely to remember "streaming output" than a number. To resolve a
description:

1. Match it case-insensitively against ticket titles across the active columns —
   `kanban search --active <words>`, or Grep `^title:` lines under `kanban/`.
2. **Exactly one match** → proceed, but first echo the resolved `#id — title` so a
   wrong match is caught before you act.
3. **Several matches** → list them (`#id — title`) and ask which.
4. **No match** → say so; offer the closest titles.

## Verbs

### review

"Review the backlog and surface N candidates to promote" / "…for tickets that are
no longer relevant."

- default N = 5
- Dump the column in one call: `kanban show backlog` — no per-file reads.
- To **surface candidates**: rank by priority, small/clear scope, unblocked
  `depends_on`, and strategic fit; present N with a one-line rationale each. Do not
  move anything — recommend, let the user decide.
- To **find stale tickets**: cross-check each against current code/docs (a ticket
  naming removed code or an already-shipped feature is a deletion candidate).
  Present them; delete only on the user's confirmation (`git rm`).

### groom (promote to ready)

"Get #0042 ready" / "groom the streaming output ticket." Resolve the reference
(see **Resolving a ticket**), then work iteratively and collaboratively:

1. Read the ticket (`kanban show <id>`). Walk the **Definition of Ready** (see
   `kanban/README.md`): clear problem, concrete acceptance criteria, `priority`
   set, no unresolved design forks, dependencies known.
2. Fill the gaps _with the user_ — sharpen the problem, write acceptance criteria,
   resolve open questions. This may involve reading code or drafting a small design.
3. When the DoR is met, set `priority` (and `size` if known) and
   `git mv kanban/backlog/0042-*.md kanban/ready/`.

Do not promote a ticket that still has open questions — that's what backlog is for.

### new

"Add a ticket: <description>."

- Copy `kanban/_template.md` to `kanban/backlog/<NNNN>-<short-slug>.md` with the id
  from `kanban next-id --pad`; fill `id`/`title`/`type`/`area`; set `created` to
  today (get it from the environment — e.g. `date +%F` — don't guess).
- Default to **backlog/** unless the user says it's already defined + prioritized.
- Keep a fresh backlog ticket honest: capture the problem; don't invent acceptance
  criteria you can't yet justify.

### start

Resolve the reference (id or description), then
`git mv kanban/ready/0042-*.md kanban/in-progress/`. Prefer keeping in-progress to
~1 item; if others are already there, confirm with the user before adding.

### done

Resolve the reference (id or description), set `completed:` to today's date, then
`git mv kanban/in-progress/0042-*.md kanban/done/`. A one-line outcome note in the
body is welcome. `done/` is frozen afterward.

## Validation

Frontmatter is validated automatically on write (a PostToolUse hook) and on
session start (drift is surfaced into context), and optionally on commit (a git
pre-commit hook installed by `kanban install-git-hook`). `kanban check` runs the
full sweep by hand. If a write is rejected, fix the reported field — don't work
around the schema. Unknown keys are rejected on purpose.

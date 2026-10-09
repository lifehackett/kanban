# Kanban board

A text-based board. A ticket's **column is its directory** — moving a ticket
between columns is a `git mv`. Managed by the `kanban` Claude Code plugin (the
`kanban` skill + the `kanban` CLI).

| Directory | Column | Meaning |
| --- | --- | --- |
| [`backlog/`](backlog/) | Backlog | Raw — not prioritized, or not yet defined enough to build. |
| [`ready/`](ready/) | Ready for development | Prioritized and meets the Definition of Ready (below). |
| [`in-progress/`](in-progress/) | In progress | Actively being worked. Keep this to ~1 (a soft WIP limit). |
| [`done/`](done/) | Done | Completed. A frozen archive — never loaded unless you ask. |

Show the board: `kanban board` (add `--done` to include the archive).

Search/list tickets (flat, scriptable — for filtering, sorting, or piping):
`kanban search` — tab-separated `id column priority type title` across all
columns. Supports a title-substring query, `--sort <id|title|priority|created>[:<dir>]`,
`--column`/`--active`/`--type`/`--priority` filters, and `--json`. The next id is
`kanban next-id`.

## Ticket format

`NNNN-short-slug.md` (a stable, zero-padded numeric id). The id never changes or
gets reused; the *path* changes as the ticket moves columns (git preserves history
across the move). Cross-reference tickets by id (`#0042`), never by path.

**YAML frontmatter is schematized**; the **body is free-form markdown**. Prose and
the acceptance-criteria checklist live in the body, not in YAML. See
[`_template.md`](_template.md).

```yaml
id: 42
title: Markdown formatting in chat output
type: feature            # bug | feature | refactor | test | docs | chore | spike
area: [chat]             # subsystem tags, free-form
priority: p2             # p0 | p1 | p2 — optional in backlog, required for ready/
size: S                  # S | M | L — optional
created: 2026-07-07
depends_on: []           # ticket ids that must land first
# spec: docs/specs/...   # optional link to the epic
```

> Quote any `title` that contains `:` or `#` — YAML reads a bare ` #` as a comment
> and would otherwise silently truncate the title. Frontmatter is flat `key: value`
> only (no nested maps or block lists).

## Labels

- **type** (one, required): `bug` `feature` `refactor` `test` `docs` `chore` `spike`
- **area** (zero+, free-form): whatever subsystem tags fit your project.

## Definition of Ready

A ticket may enter `ready/` only when:

- [ ] The problem/context is clear.
- [ ] It has concrete acceptance criteria.
- [ ] `priority` is set.
- [ ] There are no unresolved design forks left in the body.
- [ ] Dependencies (`depends_on`) are known.

This is a rule the `kanban` skill enforces at promotion time — it is not a stored
field.

## Validation

The frontmatter schema is enforced automatically (all via `kanban check`):

- **On write** — a Claude Code `PostToolUse` hook validates a ticket the moment
  it's written/edited.
- **On session start** — a `SessionStart` hook sweeps the active columns and
  surfaces any drift into context.
- **On commit** (optional) — a git `pre-commit` hook blocks a commit that would
  introduce an invalid ticket. Install once per clone: `kanban install-git-hook`.

Only the active columns are validated; `done/` is left frozen.

Run it by hand: `kanban check`.

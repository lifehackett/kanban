/**
 * `kanban` CLI dispatcher. Each subcommand lives in ./commands/<name>.mjs and
 * exports `run(args)`.
 */

const COMMANDS = {
	board: 'Show the board (backlog, ready, in-progress; --done adds the archive)',
	show: 'Print full tickets: kanban show <column|id> [...]',
	search: 'Flat, scriptable ticket index (filters, --sort, --json)',
	'next-id': 'Print the next free ticket id (--pad for 0042 form)',
	check: 'Validate ticket frontmatter (all active tickets, or the given files)',
	init: 'Scaffold a kanban/ board in the current directory',
	'install-git-hook': 'Install a git pre-commit hook that validates tickets',
	hook: '(internal) Claude Code hook entry points',
};

function usage() {
	const width = Math.max(...Object.keys(COMMANDS).map((c) => c.length));
	return [
		'usage: kanban <command> [args]',
		'',
		...Object.entries(COMMANDS).map(([name, desc]) => `  ${name.padEnd(width)}  ${desc}`),
	].join('\n');
}

const [command, ...args] = process.argv.slice(2);

if (!command || command === '-h' || command === '--help' || command === 'help') {
	console.log(usage());
} else if (!Object.hasOwn(COMMANDS, command)) {
	console.error(`kanban: unknown command '${command}'\n\n${usage()}`);
	process.exit(1);
} else {
	const mod = await import(`./commands/${command}.mjs`);
	await mod.run(args);
}

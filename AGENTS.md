# AGENTS.md — shared rules for every AI assistant

This file is the single source of truth for how AI coding assistants (Claude Code, Grok, or any other)
work in this repo. Both maintainers use it. If a rule here conflicts with an assistant's defaults, this
file wins. Change these rules only through a pull request that both people see.

## Project

- A web game plus its website, built by two maintainers who are both admins.
- **Stack: not decided yet.** Until it is, don't add a framework, bundler or package manager on your own.
  Propose the choice in a PR that updates this section first.
- Live site deploys automatically from `main`.

## Structure

Keep to this layout so the two maintainers rarely edit the same files:

| Folder | What lives there | Main owner |
|---|---|---|
| `src/game/` | Game logic: loop, state, physics, rules, input | _fill in_ |
| `src/ui/` | Menus, HUD, website pages, styles | _fill in_ |
| `public/` | Static assets: images, sounds, fonts | shared |
| `docs/` | Design notes and decisions | shared |

The owner reviews PRs that touch their folder. Anyone can edit any folder, but say so in the PR.

## Git workflow

1. `git pull origin main` before starting.
2. Work on a branch: `daniel/<short-topic>` or `<friend>/<short-topic>`. Never commit directly to `main`.
3. Keep PRs small and focused on one thing. Pull `main` into your branch often.
4. Open a pull request. The **other** person reviews and merges it.
5. Delete the branch after merging.

Commit messages: short imperative summary line, e.g. `Add jump physics`, `Fix score reset on restart`.

## Secrets

- Never commit API keys, tokens, passwords or `.env` files. `.gitignore` blocks them; don't override it.
- Add new variable **names** (no values) to `.env.example`.
- Real values go in the hosting dashboard's environment variables and in each person's local `.env`.
- If a secret is ever committed, rotate it immediately. Deleting the commit isn't enough.

## Code style

- Readable over clever. Small functions, descriptive names.
- No new dependency without saying why in the PR description.
- Don't reformat or rename code outside the task: it causes merge conflicts for the other person.
- Keep the game playable on phones and desktops.

## Before opening a PR

- The game runs locally without console errors.
- Tests and lint pass (once the stack adds them).
- The PR description says what changed, why, and how to test it.

## For AI assistants specifically

- Read this file at the start of each session.
- Don't push to `main`, force-push, or merge PRs unless your human explicitly asks.
- Don't edit files outside the task's scope.
- When a decision affects both maintainers (stack, structure, dependencies), propose it in a PR
  instead of just doing it.

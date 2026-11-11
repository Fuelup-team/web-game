# AGENTS.md — shared rules for every AI assistant

This file is the single source of truth for how AI coding assistants (Claude Code, Grok, or any other)
work in this repo. Both maintainers use it. If a rule here conflicts with an assistant's defaults, this
file wins. Agree changes to these rules with each other before pushing them.

## Project

- A web game plus its website, built by two maintainers who are both admins.
- **Stack: not decided yet.** Until it is, don't add a framework, bundler or package manager on your own.
  Agree the choice together, then update this section first.
- Live site deploys automatically from `main`.

## Structure

Keep to this layout so the two maintainers rarely edit the same files:

| Folder | What lives there | Main owner |
|---|---|---|
| `src/game/` | Game logic: loop, state, physics, rules, input | _fill in_ |
| `src/ui/` | Menus, HUD, website pages, styles | _fill in_ |
| `public/` | Static assets: images, sounds, fonts | shared |
| `docs/` | Design notes and decisions | shared |

Anyone can edit any folder. If you change the other person's area, mention it in the commit message.

## Git workflow

Both maintainers push straight to `main` — no pull requests or approvals needed. Every push to `main`
deploys the live site, so:

1. `git pull --rebase origin main` before starting and again right before pushing.
2. Make small commits that each leave the game working.
3. `git push origin main`. If the push is rejected, pull with `--rebase`, fix any conflicts, and push again.
4. Never force-push (`--force`) — GitHub blocks it on `main` anyway, because it would erase the other
   person's work.
5. For a big or risky change, use a branch (`daniel/<topic>` or `eeli/<topic>`) and merge it when ready.

Commit messages: short imperative summary line, e.g. `Add jump physics`, `Fix score reset on restart`.

## Secrets

- Never commit API keys, tokens, passwords or `.env` files. `.gitignore` blocks them; don't override it.
- Add new variable **names** (no values) to `.env.example`.
- Real values go in the hosting dashboard's environment variables and in each person's local `.env`.
- If a secret is ever committed, rotate it immediately. Deleting the commit isn't enough.

## Code style

- Readable over clever. Small functions, descriptive names.
- No new dependency without saying why in the commit message.
- Don't reformat or rename code outside the task: it causes merge conflicts for the other person.
- Keep the game playable on phones and desktops.

## Before pushing to main

- The game runs locally without console errors.
- Tests and lint pass (once the stack adds them).
- You pulled the latest `main` first.

## For AI assistants specifically

- Read this file at the start of each session.
- Commit and push to `main` only when your human asks. Never force-push or rewrite history.
- Don't edit files outside the task's scope.
- When a decision affects both maintainers (stack, structure, dependencies), tell your human so they
  can agree it with the other maintainer first.

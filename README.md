# Web Game

A web game and website built by two maintainers.

- **Rules for humans and AI assistants:** [AGENTS.md](AGENTS.md)
- **One-time setup (GitHub, hosting):** [SETUP.md](SETUP.md)

## Daily workflow

Both of us push straight to `main`. Every push deploys the live site.

```bash
git pull --rebase origin main
# ...make changes...
git add -A && git commit -m "Short description"
git pull --rebase origin main
git push origin main
```

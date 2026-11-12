# One-time setup checklist

Do these once. Steps marked **(Daniel)** or **(friend)** are for one person; the rest are shared.

## 1. GitHub repo

Pick one option:

- **Simple:** create a repo on your personal account, then add your friend as a collaborator.
- **Equal ownership (recommended for two admins):** create a free GitHub Organization, make both of you
  Owners, and create the repo inside it. Neither person "owns" it alone.

Steps **(Daniel)**:

1. On github.com, create an empty repo (no README, no .gitignore; this folder already has them).
2. In this folder:
   ```bash
   git add -A
   git commit -m "Initial project scaffold"
   git remote add origin https://github.com/<owner>/<repo>.git
   git push -u origin main
   ```
3. Repo → **Settings → Collaborators** → invite your friend with the **Admin** role
   (skip if you used an Organization and both are Owners).

## 2. Friend's machine **(friend)**

```bash
git clone https://github.com/<owner>/<repo>.git
cd <repo>
```

Tell Grok to read `AGENTS.md` at the start of each session (paste it into Grok's project or custom
instructions if it doesn't pick the file up automatically).

## 3. Branch protection on `main`

Done. A ruleset named **Protect main** (Settings → Rules → Rulesets) blocks force pushes and deleting
`main`. Both of you can push directly, with no pull requests or approvals.

## 4. Hosting with auto-deploy

Fuelup is hosted on **Cloudflare** (moved from Netlify in Nov 2026, when Netlify's free deploy
credits ran out). Every push to `main` is checked and deployed automatically.

- Settings live in `wrangler.jsonc`: the site files, the fleet board worker (`worker/index.js`) and the
  Workers KV namespace that stores scores.
- Cloudflare dashboard: Workers & Pages, then the `fuelup` project, for deploy logs and settings.
- Build command: `node scripts/check.mjs`. Deploy command: `npx wrangler deploy`.
- To give Eeli access: Cloudflare dashboard, Manage account, Members, invite him.

## 5. Domain (optional)

- Buy it through the hosting provider or a registrar both of you can log into.
- Add the other person as a user on the registrar account, or note who holds it.
- Point the domain at the hosting project and turn on HTTPS (automatic on all three).

## 6. Secrets

- Each person keeps their own local `.env` (copy from `.env.example`).
- Production values go only in the hosting dashboard → **Environment variables**.
- Share secret values with each other through a password manager, not chat.

## 7. Fill in the blanks

- [ ] Add each person's area to the ownership table in `AGENTS.md`
- [x] Stack chosen: plain HTML, CSS and JavaScript (see `AGENTS.md`)
- [x] Fleet board backend (Cloudflare Worker + Workers KV)

# Updating your live Chula 3D game on GitHub / Vercel

1. Download and extract `A_Day_at_Chula_v02_Architecture_Vercel.zip`.
2. Open your existing `chula-life-3d` GitHub repository.
3. Replace existing root files and folders using the **contents** of `chula-life-game` (NOT the ZIP). You can upload via GitHub's **Add file > Upload files**; commit the additions/changes. If editing in VS Code, `git add . && git commit -m "Upgrade Central Library 3D to v0.2" && git push` is simpler.
4. Confirm these paths exist in your repository **root**:

   - `package.json`
   - `index.html`
   - `src/main.js`
   - `public/game_logic.py`
   - `public/models/chula_exterior_v02.glb`

5. Open Vercel > your project > Deployments. Its GitHub integration normally starts a new deployment after the push. No new Vercel project required.
6. Vercel settings: Framework `Vite`; Build Command `npm run build`; Output Directory `dist`; Install Command `npm install`.
7. Visit your deployment URL, hard-refresh, allow first-time Pyodide download; you should begin outdoors looking at the staircase.

If Vercel shows Build Failed, send the **first error** in Build Logs, not just the final build status.

## Important

The model is reference-based, **not** an official digital twin. Interior proportions are estimated and floor 7 is not accessible. Source evidence and limits are in `REFERENCE_NOTES.md`.

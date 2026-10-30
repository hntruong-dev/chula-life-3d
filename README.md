# A Day at Chula — v0.2 Architecture Upgrade

3D browser game portraying daily life for a Vietnamese graduate student at Chulalongkorn University's **Office of Academic Resources / Central Library**.

## v0.2 changes

- Reconstructed **recognisable white exterior** from Chulalongkorn University's official photo: multi-wing facade, tall vertical slats, raised glazed entrance, broad staircase, **green railings**, trees and plaza.
- **Python-generated GLB model**: `public/models/chula_exterior_v02.glb` (optimized web model, 11 draw groups, about 212 KB) loaded using Three.js `GLTFLoader`. The model was generated with `tools/build_exterior.py` using `trimesh`, and the independent `chula_exterior_editable_v02.glb` retains 434 individually named components for Blender. The procedural JavaScript facade is retained only as a fallback if GLB loading fails.
- Begin the game **outside** the building. Climb the stairs, cross the entrance, check in at the reception and explore.
- More detailed 1F learning commons (library service, self-check kiosks, student computing, print/scan), 2F co-working/group rooms, 4–6F study/collections; 3F illustrative digital learning area.
- Working desk/kiosk collisions; no walking through furniture and perimeter walls. Functional lift menu `F` can return you to the exterior (`OUT`).
- Python gameplay logic remains in `public/game_logic.py`, executed client-side with **Pyodide**; 3D world is rendered with **Three.js**.
- Six core student-life missions, game time, budget, energy, hunger, stress, research progress, dialogue and NPC interaction.

> **Accuracy disclosure:** Landmark details are based on public photos and library service information. The building footprint, proportions, stairs and floor plans are reconstructed approximately, not copied from an official measured model. Please read [REFERENCE_NOTES.md](REFERENCE_NOTES.md) for the evidence and outstanding inaccuracies.

## Deploy to Vercel

1. Upload all files (including `public` and `src`) to the **root** of your GitHub repository (not the ZIP archive).
2. On Vercel import the GitHub repository, choose **Vite** and use:
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`
3. Deploy; Vercel serves a static site. No Python backend needed because Pyodide runs Python code in the browser.
4. A network connection is required for first load because Pyodide is fetched from jsDelivr.

## Run locally

Node.js 18+:

```bash
npm install
npm run dev
```

Open the local URL given by Vite. To verify production build run `npm run build`.

To **regenerate the GLB from Python** (not necessary for deployment):

```bash
python -m pip install -r requirements-assets.txt
python tools/build_exterior.py
python test_game_logic.py
```

Upload the updated `public/models/chula_exterior_v02.glb` on GitHub after regeneration. Vercel deploys the pre-generated GLB as a static asset. Python is not invoked during the build.

## Controls

- `W/A/S/D`: walk; mouse to look; `Shift`: walk faster.
- `E`: interact when a nearby target is highlighted.
- `F`: lift / floor selection; `OUT`: return to building exterior.
- `Esc`: pause; press Resume to continue.
- On a touch-screen: directional pad, E/F, drag to rotate camera.

## Structure

```text
chula-life-game/
├── index.html
├── package.json
├── vercel.json
├── README.md
├── REFERENCE_NOTES.md
├── requirements-assets.txt
├── test_game_logic.py
├── tools/
│   └── build_exterior.py        # Python / trimesh 3D mesh generator
├── public/
│   ├── game_logic.py            # Python / Pyodide gameplay
│   └── models/
│       ├── chula_exterior_v02.glb           # Optimized runtime asset
│       └── chula_exterior_editable_v02.glb  # Detailed editable Blender model
└── src/
    ├── main.js                  # Three.js game client + GLTFLoader
    └── style.css                # UI
```

## Future high-fidelity options

To reach surveyed architectural accuracy, import Blender `.glb` assets made from measured plans / permitted photographs and add mesh-based collisions and navmesh pathing. Current version deliberately has **no inaccessible proprietary model dependencies**; it uses original, editable procedurally generated geometry.

## Updating an existing GitHub + Vercel deployment

In your `chula-life-3d` GitHub repository, replace the older root files with the new files **keeping exactly the paths above** (especially `src/main.js`, `public/game_logic.py` and `public/models/chula_exterior_v02.glb`). Commit. Existing Vercel-GitHub integration normally builds and deploys the new commit automatically. Do **not** upload the ZIP as a single file. Check that the root `package.json` and `index.html` are still in the repository root.

## Testing disclosures

Verified in this environment: Python gameplay smoke test, syntax of `main.js`, generated GLB was read back successfully with `trimesh` (11 runtime groups; 434 editable component meshes). A full Vite build/browser rendering test could not be performed here because this offline container does not have cached npm dependencies.

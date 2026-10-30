# A Day at Chula — 3D Student-Life Game

A browser-based 3D prototype set in a stylised reconstruction of Chulalongkorn University's Office of Academic Resources (Central Library).

## What is included

- First-person 3D exploration across seven floors.
- Interactive reception, coffee corner, printer, book collection, study desk, NPC, group-study area and elevator.
- A day plan with six tasks and student-life stats (energy, hunger, stress, research, social connection, money).
- **Python game logic** in `public/game_logic.py`, executed in the browser by Pyodide.
- Three.js handles 3D rendering, camera, controls and interaction targeting.
- Vite build, ready for Vercel deployment.

## Important fidelity note

This is a playable **stylised blockout**, not an architecturally surveyed replica or a photogrammetry scan. It uses publicly documented library functions and floor information as a design basis. The exact room geometry, dimensions, furniture positions and architectural details should be refined against the official 360° tour / Chula Library Metaverse and additional reference photos.

The official library information page describes the 1st-floor circulation/computer/printing/coffee/learning services, 2nd-floor group-study rooms, 3rd-floor AV/meeting functions, and floors 4–6 collections. The library is described by Chula as occupying seven floors.

## Run locally

Requirements: Node.js 18+.

```bash
npm install
npm run dev
```

Open the local URL shown by Vite.

To create a production build:

```bash
npm run build
npm run preview
```

## Deploy to Vercel

1. Create a GitHub repository and upload the contents of this folder.
2. In Vercel, choose **Add New → Project** and import the repository.
3. Vercel should detect Vite. Confirm:
   - Framework: `Vite`
   - Build command: `npm run build`
   - Output directory: `dist`
4. Click **Deploy**.

The game is a static browser app. No Python server is required: Pyodide loads and runs `game_logic.py` in the browser.

## Controls

- Desktop: `W A S D` move, mouse look, `E` interact, `F` elevator, `Shift` walk faster, `Esc` pause.
- Mobile: on-screen directional pad, E/F buttons; drag the screen to look around.

## Project structure

```text
chula-life-game/
├── index.html
├── package.json
├── vercel.json
├── src/
│   ├── main.js
│   └── style.css
└── public/
    └── game_logic.py
```

## Reference sources

- Chula Library Services / floor directory: https://www.arts.chula.ac.th/libsci/student-life/library-services/
- Office of Academic Resources 360° video and Chula Library Metaverse: https://www.car.chula.ac.th/vdo.php
- Chulalongkorn University article describing the seven-floor Central Library: https://sustainability.chula.ac.th/report/187/
- Official Central Library website: https://www.car.chula.ac.th/

## Next production upgrades

1. Replace blockout geometry with a measured floor plan / detailed 3D model.
2. Add more accurate facade, staircases, elevators, lighting and room proportions.
3. Add animated NPCs, Thai/Vietnamese/English dialogue, sound and ambient audio.
4. Add save/load, multiple days, class schedules, budgeting and branching story missions.
5. Optimise mobile rendering and add accessibility settings.

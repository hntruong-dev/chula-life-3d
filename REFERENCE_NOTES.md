# Chula Central Library v0.2 — Architectural Reference Notes

## What changed

This original 3D geometry reconstruction replaces the generic square library blockout with:

- The characteristic multi-part white Mahathira Rachanusorn Building massing.
- A wide external stepped plaza, a raised entry landing and green railings.
- A stepped corner-tower facade with narrow vertical fins and horizontal white bands.
- An entrance with large glass panes, bilingual labels and an open walking portal.
- A foyer with access-control devices, service counter, multiple self-check kiosks, computing tables and print/scan devices.
- More differentiated co-working, group-study, quiet-study, collection and media areas for floors 2–6.
- A non-public floor 7 (exterior modelled; gameplay access disabled pending verification).
- Collision detection (walls / desks / kiosks), approximate stair traversal, exterior entry spawn and a return-to-exterior lift option.

The external geometry is generated as `.glb` files by `tools/build_exterior.py` (Python + `trimesh`), while interior/fallback geometry is generated in Three.js. The runtime asset is batched into 11 meshes; the Blender-editable file contains 434 individually named primitive meshes. **There is no official 3D model, measured CAD file, photogrammetry reconstruction, official floor plan download or licensed architectural asset included.** No Chula logos or source photographs are redistributed inside the game package.

## Evidence used (accessed October 30, 2026)

| Source | Verified information used | In-game representation |
| --- | --- | --- |
| Chulalongkorn University, Office of Academic Resources: https://www.chula.ac.th/en/services/office-of-academic-resources/ | Official exterior shows white multi-wing facade, distinctive vertical slats, broad stairs, green handrails, large entrance glazing; services include self-check, printing/scanning, study and media | Facade, stairs, kiosk, print/scan, room programs |
| Office of Academic Resources FAQ: https://www.car.chula.ac.th/faq.php | One Stop Service on 1F; Media & Entertainment Corner on 4F; links to official floor plan | Reception and 4F media corner |
| OAR opening hours: https://www.car.chula.ac.th/detail_hour.php | Separately listed floors 1–2, AIX, 4, 5, 6 | Public-access floor navigation limited to 1–6; floor 3 schematic only |
| Chula for Sustainable Development: https://sustainability.chula.ac.th/report/187/ | Central Library occupies seven floors; self-borrow machines, displays of available seats, study facilities | Seven-story external volume, self-service interior |
| Chula Library floor plan portal: https://cucentrallib.car.chula.ac.th/ | Official portal exists, but its client-rendered floor maps could not be inspected/reliably extracted in this environment | No measured or exact plan is claimed |
| Chula Library / Digital reference: https://www.car.chula.ac.th/3d.php | 3D/360° tour is linked in public materials but the page was not directly accessible in this run | Not used to assert exact room coordinates |
| Chulalongkorn University Library Visit: https://www.arts.chula.ac.th/dlives/program-libVisit.html | Interior photograph showing bright glazed space and flexible study seating | Large windows, light interior, round tables / lounge seats |

## Unverified and simplified

- Exact building footprint, floor-to-floor height, stair tread dimensions, camera geometry and structural column coordinates are estimated. `1 unit = approximately 1 metre` in the game; this **does not** certify a real-world scale.
- Interior layout is illustrative. Floor service programmes are based on published offerings but exact desk positions, elevator location and room numbers are **not verified**.
- Coffee and lunch concession elements are game mechanics, **not** claims about current concession locations.
- Floor 3 and floor 7 are deliberately marked illustrative/restricted to avoid implying approved visitor access to rooms.
- No actual people, photographs, copyrighted floor plans or institutional 3D assets are bundled.

## Accuracy path

Provide an accessible public floor-plan image plus 8–12 photos for each level to rebuild this more precisely. Until then this is a landmark-faithful **stylized reconstruction**, not a digital twin.

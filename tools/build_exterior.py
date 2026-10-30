"""
Build a self-contained editable GLB architectural exterior for A Day at Chula.

Original geometry derived qualitatively from published images, NOT a surveyed
architectural model. Approximate world-space coordinates match Three.js game.

Usage:
    python tools/build_exterior.py
    -> public/models/chula_exterior_v02.glb

Requirements: numpy, trimesh.
"""
from pathlib import Path
import math
import numpy as np
import trimesh
from trimesh.transformations import rotation_matrix

OUT = Path(__file__).resolve().parent.parent / 'public' / 'models' / 'chula_exterior_v02.glb'
EDITABLE = OUT.with_name('chula_exterior_editable_v02.glb')
scene = trimesh.Scene()
buckets = {}
count = 0

PALETTE = {
    'ivory': (228,231,225,255),
    'white': (247,248,243,255),
    'concrete': (185,184,176,255),
    'stairs': (204,203,196,255),
    'dark': (82,99,103,255),
    'window': (102,140,146,255),
    'greenrail': (45,117,98,255),
    'planter': (177,182,171,255),
    'leaf': (68,114,76,255),
    'bark': (106,81,63,255),
    'ground': (129,153,130,255),
}

def add(mesh, name, color):
    global count
    rgba = PALETTE.get(color,color)
    mesh.visual.face_colors = rgba
    buckets.setdefault(str(color), []).append(mesh.copy())
    count += 1
    scene.add_geometry(mesh, node_name=f'{count:04d}_{name}', geom_name=f'{count:04d}_{name}')

def block(name, x,y,z, w,h,d, color):
    m=trimesh.creation.box(extents=[w,h,d]);m.apply_translation([x,y,z]);add(m,name,color)

def post(name,x,y,z,r,h,color):
    m=trimesh.creation.cylinder(radius=r,height=h,sections=10)
    m.apply_transform(rotation_matrix(math.pi/2,[1,0,0]))
    m.apply_translation([x,y,z]);add(m,name,color)

def railing(name, x1,y1,z1, x2,y2,z2,r=.06):
    a=np.array([x1,y1,z1],dtype=float)
    b=np.array([x2,y2,z2],dtype=float)
    delta=b-a
    length=float(np.linalg.norm(delta))
    mesh=trimesh.creation.cylinder(radius=r,height=length,sections=9)
    # trimesh cylinder is constructed along Z. Rotate into line direction.
    direction=delta/length
    zaxis=np.array([0,0,1],dtype=float)
    axis=np.cross(zaxis,direction)
    alpha=float(np.arccos(np.clip(zaxis.dot(direction),-1,1)))
    if np.linalg.norm(axis)>1e-10:
        mesh.apply_transform(rotation_matrix(alpha,axis))
    elif direction[2] < 0:
        mesh.apply_transform(rotation_matrix(math.pi,[1,0,0]))
    mesh.apply_translation((a+b)/2)
    add(mesh,name,'greenrail')

def ball(name,x,y,z,r,color='leaf',stretch=(1,1,1)):
    m=trimesh.creation.icosphere(subdivisions=1,radius=r)
    m.apply_scale(np.asarray(stretch))
    m.apply_translation([x,y,z]);add(m,name,color)

# Ground is a landscaping base rather than an official site survey.
block('landscape_ground',0,-2.71,18,110,.20,100,'ground')
block('plaza',0,-2.51,20.4,39,.30,28,'concrete')
block('approach',0,-2.47,28.0,38,.05,3.7,'stairs')

# Building lateral wings are clearly visible in official Chula exterior image.
block('west_wing',-20,11.7,.6,12,25.5,17,'ivory')
block('east_wing',20,13.7,.4,11.6,29.5,17,'ivory')
for floor in range(1,7):
    y=(floor-1)*4.15
    for x in (-20,20):
        block('wing_horizontal_lower',x,y+.37,9.14,11.2,.78,.40,'white')
        block('wing_horizontal_upper',x,y+3.76,9.14,11.2,.58,.42,'white')
        block('wing_window_band',x,y+2.11,9.17,11.0,2.62,.08,'dark')
        for k in range(-2,3):
            block('wing_mullion',x+k*1.94,y+2.06,9.22,.18,2.82,.25,'white')
            block('wing_glass',x+k*1.94+.72,y+2.03,9.27,1.26,2.70,.04,'window')
    if floor>1:
        # Highly distinctive sun-shading fin grid of corner tower.
        block('tower_white_band_lower',6.8,y+.25,9.55,14,.64,.8,'white')
        block('tower_white_band_upper',6.8,y+3.72,9.55,14,.58,.8,'white')
        block('tower_recessed_dark_window',6.8,y+2.0,9.4,13.4,2.7,.12,'dark')
        for k in range(23):
            x=.5+k*.57
            block('tower_vertical_fin',x,y+2.04,9.88,.075,2.84,.24,'ivory')

# Seven-storey massing / raised parapet.
block('main_roof',-1,29.0,0,31,.62,20.2,'white')
block('front_roof_parapet',1,29.9,9.4,29.3,1.35,.56,'ivory')

# Glazed entrance, central clear doorway flanked by panels.
block('front_entry_header',0,3.76,9.32,27.5,.72,.58,'white')
for x in [-8.4,8.4]:
    block('entry_glass_wing',x,1.8,9.35,9.0,3.14,.12,'window')
for x in [-12.8,-9.7,-6.6,-3.4,3.4,6.6,9.7,12.8]:
    block('entry_green_mullion',x,1.81,9.48,.11,3.45,.18,'greenrail')
for x in [-2,2]:
    block('open_sliding_glass',x,1.60,9.4,1.15,2.78,.10,'window')
    block('sliding_door_frame',x,1.59,9.55,1.13,2.70,.08,'greenrail')
block('entrance_canopy',0,3.48,9.55,6.3,.28,.5,'white')

# Raised landing and staircase with approximately 12 treads.
block('entrance_landing',0,-.16,11.1,18,.32,4.2,'concrete')
steps=12
for i in range(steps):
    z=13+(23.3-13)*(i+.5)/steps
    top=-.19-2.16*(i+1)/steps
    bottom=-2.45
    block('stair_structure',0,(top+bottom)/2,z,18,top-bottom,(23.3-13)/steps+.025,'concrete')
    block('stair_tread',0,top+.018,z,18.05,.035,(23.3-13)/steps+.035,'stairs')
for x in [-8.7,-2.6,2.6,8.7]:
    railing('signature_green_stair_rail',x,.68,12.7,x,-1.62,23.6,.052)
    for k in range(7):
        t=k/6;z=12.7+t*10.9;y=-.13-t*2.23
        railing('stair_support',x,y,z,x,y+.80,z,.038)

# Planters and surrounding street trees from original low-poly shapes.
for x in [-10.6,10.6]:
    block('concrete_planter',x,.30,11.9,1.1,.65,.9,'planter')
    for i in range(5):
        dx=(i-2)*.16
        post('thin_stem',x+dx,.95,11.9,.045,.95,'bark')
        for a in range(3):
            ball('bamboo_leaf',x+dx+(a-1)*.22,1.15+a*.22,12,.24,'leaf',(.7,.42,1.5))
for x,z,r in [(-18,20.2,1.5),(17,24.4,1.3),(-21,30,1.6)]:
    post('tree_trunk',x,-.4,z,.2,3.8,'bark')
    for i in range(5):
        angle=i*2.399
        ball('tree_canopy',x+math.cos(angle)*.65,1.55+(i%2)*.45,z+math.sin(angle)*.6,r,'leaf',(1.1,.85,1.0))
for x in [-12.3,12.3]:
    post('entrance_pot',x,-1.95,17.5,.46,.8,'concrete')
    ball('entrance_pot_plant',x,-1.32,17.5,.53,'leaf',(1.1,.55,1.0))
# Distant low-key buildings to avoid an empty horizon.
for x in range(-40,41,11):
    if abs(x)<20:continue
    h=7+abs(x)%5
    block('distant_campus_building',x,h/2-2.5,-42,7,h,9,'planter')

# Two GLBs: per-primitive editable model and material-batched fast web model.
# Neither one embeds photographs, logos, library floor-plans or proprietary models.
OUT.parent.mkdir(parents=True,exist_ok=True)
EDITABLE.write_bytes(scene.export(file_type='glb'))
optimized = trimesh.Scene()
for material_name, meshes in buckets.items():
    combined = trimesh.util.concatenate(meshes)
    if material_name == 'window':
        # GLTF AlphaBlend, so the outer windows don't become an opaque blue wall.
        from trimesh.visual.material import PBRMaterial
        combined.visual = trimesh.visual.TextureVisuals(material=PBRMaterial(
            name='semi_transparent_library_glazing',
            baseColorFactor=[102, 140, 146, 100],
            metallicFactor=0.10, roughnessFactor=0.24,
            alphaMode='BLEND', doubleSided=True
        ))
    optimized.add_geometry(combined, geom_name=f'batched_{material_name}', node_name=f'batched_{material_name}')
OUT.write_bytes(optimized.export(file_type='glb'))
print(f'Editable: {EDITABLE} ({EDITABLE.stat().st_size:,} bytes, {count} named primitive meshes)')
print(f'Vercel asset: {OUT} ({OUT.stat().st_size:,} bytes, {len(optimized.geometry)} batched meshes)')

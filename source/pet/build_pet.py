# Build a web-ready GLB of the Sweetie Belle model for the LVC site pet.
# Run: bpyenv/bin/python -I build_pet.py -- <in.blend> <out.glb> [subsurf_level] [tex_size]
import bpy, sys, math
from mathutils import Vector, Quaternion, Matrix

args = sys.argv[sys.argv.index('--') + 1:]
SRC, OUT = args[0], args[1]
SUBSURF = int(args[2]) if len(args) > 2 else 1   # 2 = mixed: face/hair smooth, body/clothes level 0
FACE_PARTS = {'头', '头发', '刘海', '鬓角', '头皮', '发卡', '瞳孔', '高光', '脸红'}
TEX = int(args[3]) if len(args) > 3 else 1024

bpy.ops.wm.open_mainfile(filepath=SRC)
scene = bpy.context.scene
scene.render.fps = 24
D = bpy.data
ARM = D.objects['骨架']
ROOT = '本模型由图云制作，免费提供'

# ---------------------------------------------------------------- clean up
for n in ['头.001', '瞳孔.001', '高光.001', 'Camera']:
    if n in D.objects:
        D.objects.remove(D.objects[n], do_unlink=True)
for n in ['头', '瞳孔', '高光']:          # the copies carrying shape keys sit 0.7 to the side
    D.objects[n].location.x = 0.0
# overlay meshes we do not use (tears, tired lines, frown marks, eye bags, squint lines)
for n in ['泪水', '泪珠', '泪目', '疲惫', '皱眉', '眼袋', '紧闭']:
    D.objects.remove(D.objects[n], do_unlink=True)
for a in list(D.actions):
    D.actions.remove(a)
for o in D.objects:
    if o.type == 'MESH' and o.data.shape_keys and o.data.shape_keys.animation_data:
        o.data.shape_keys.animation_data_clear()
    if o.animation_data:
        o.animation_data_clear()

# shape keys kept as morph targets (everything else is baked at its default value)
KEEP = {
    '头': ['笑眼', '轻闭眼', '微笑', '大笑', '紧闭', '小张嘴----嘴', '抬眉'],
    '脸红': ['脸红'],
}
RENAME = {'小张嘴----嘴': 'open', '笑眼': 'happyEyes', '轻闭眼': 'blink', '微笑': 'smile',
          '大笑': 'laugh', '紧闭': 'squeeze', '抬眉': 'browsUp', '脸红': 'blush'}

# ---------------------------------------------------------------- bake modifiers, keep chosen shape keys
dg = bpy.context.evaluated_depsgraph_get()

def bake(obj):
    keep = KEEP.get(obj.name, [])
    for m in obj.modifiers:
        if m.type == 'SUBSURF':
            m.levels = (1 if obj.name in FACE_PARTS else 0) if SUBSURF == 2 else SUBSURF
        if m.type == 'ARMATURE':
            m.show_viewport = False
    kb = obj.data.shape_keys.key_blocks if obj.data.shape_keys else []
    defaults = {k.name: k.value for k in kb}
    for k in kb:
        if k.name in keep:
            k.value = 0.0
    def evaluate():
        bpy.context.view_layer.update()
        ev = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
        return D.meshes.new_from_object(ev, preserve_all_data_layers=True,
                                        depsgraph=bpy.context.evaluated_depsgraph_get())
    base = evaluate()
    targets = []
    for name in keep:
        kb[name].value = 1.0
        m = evaluate()
        assert len(m.vertices) == len(base.vertices), (obj.name, name)
        targets.append((RENAME.get(name, name), [v.co.copy() for v in m.vertices]))
        D.meshes.remove(m)
        kb[name].value = 0.0
    new = D.objects.new(obj.name, base)
    for c in obj.users_collection:
        c.objects.link(new)
    new.parent = ARM
    new.matrix_world = obj.matrix_world.copy()
    for vg in obj.vertex_groups:            # names in index order so weights line up
        if vg.name not in new.vertex_groups:
            new.vertex_groups.new(name=vg.name)
    if targets:
        new.shape_key_add(name='Basis')
        for name, co in targets:
            sk = new.shape_key_add(name=name, from_mix=False)
            for i, p in enumerate(co):
                sk.data[i].co = p
            sk.value = 0.0
    mod = new.modifiers.new('Armature', 'ARMATURE')
    mod.object = ARM
    D.objects.remove(obj, do_unlink=True)
    new.name = new.name.split('.')[0]
    return new

meshes = [o for o in D.objects if o.type == 'MESH']
total = 0
for o in meshes:
    n = bake(o)
    total += len(n.data.vertices)
print('BAKED verts', total)
import os
if os.environ.get('SAVE_BAKED'):
    bpy.ops.wm.save_as_mainfile(filepath=os.environ['SAVE_BAKED'], copy=True)

# ---------------------------------------------------------------- materials -> plain Principled so the exporter writes colour/texture
def lin(c):
    return (c[0], c[1], c[2], 1.0)
for mat in D.materials:
    if not mat.use_nodes:
        continue
    nt = mat.node_tree
    img = next((n.image for n in nt.nodes if n.type == 'TEX_IMAGE' and n.image), None)
    emi = next((n for n in nt.nodes if n.type == 'EMISSION'), None)
    mix = next((n for n in nt.nodes if n.type == 'MIX_SHADER'), None)
    outline = mat.use_backface_culling and any(n.type == 'NEW_GEOMETRY' for n in nt.nodes)
    color = emi.inputs['Color'].default_value[:] if emi else (1, 1, 1, 1)
    alpha = 1.0 - (mix.inputs[0].default_value if (mix and not outline) else 0.0)
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    nt.links.new(bsdf.outputs[0], out.inputs[0])
    if img:
        tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = img
        nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    else:
        bsdf.inputs['Base Color'].default_value = lin(color)
    bsdf.inputs['Alpha'].default_value = alpha
    mat.use_backface_culling = outline
    # name hints for the runtime: outline / alpha
    if outline and not mat.name.startswith('OL_'):
        mat.name = 'OL_' + mat.name
    if alpha < 1.0:
        mat.surface_render_method = 'BLENDED'

for img in D.images:
    w, h = img.size
    if w > TEX:
        img.scale(TEX, max(1, int(h * TEX / w)))

# ---------------------------------------------------------------- animation helpers (armature space -> bone local)
P = ARM.pose.bones
B = ARM.data.bones
for pb in P:
    pb.rotation_mode = 'QUATERNION'
    pb.location = (0, 0, 0); pb.rotation_quaternion = (1, 0, 0, 0); pb.scale = (1, 1, 1)

def rest3(n):
    return B[n].matrix_local.to_3x3()

def set_loc(n, offset):
    """offset in armature space (assumes parent rotation ~ rest)"""
    P[n].location = rest3(n).inverted() @ Vector(offset)

def set_rot(n, axis, deg):
    """rotate about an armature-space axis through the bone head"""
    a = rest3(n).inverted() @ Vector(axis)
    P[n].rotation_quaternion = Quaternion(a.normalized(), math.radians(deg))

def set_rot2(n, rots):
    q = Quaternion()
    for axis, deg in rots:
        a = rest3(n).inverted() @ Vector(axis)
        q = q @ Quaternion(a.normalized(), math.radians(deg))
    P[n].rotation_quaternion = q

def head(n):
    return B[n].head_local.copy()

ANIMATED = [ROOT, '骶椎', '腰控制器', '颈控制器', '头骨',
            '小腿IK.L', '小腿IK.R', '小臂IK.L', '小臂IK.R', '手掌IK.L', '手掌IK.R',
            '中指控制器.L', '无名指控制器.L', '小指控制器.L', '食指控制器.L',
            '中指控制器.R', '无名指控制器.R', '小指控制器.R', '食指控制器.R']

def key_all(frame):
    for n in ANIMATED:
        if n in P:
            P[n].keyframe_insert('location', frame=frame)
            P[n].keyframe_insert('rotation_quaternion', frame=frame)

def reset_pose():
    for n in ANIMATED:
        if n in P:
            P[n].location = (0, 0, 0); P[n].rotation_quaternion = (1, 0, 0, 0)

WRIST_REST = {s: head('小臂IK.' + s) for s in 'LR'}
HAND_REST = {s: head('手掌IK.' + s) for s in 'LR'}
SIGN = {'L': 1.0, 'R': -1.0}
FWD = Vector((0, -1, 0))   # model faces -Y

def arm_to(side, wrist, hand_dir=(0, -0.01, -1), hand_len=0.053):
    """place wrist IK target at armature-space point, point the hand along hand_dir"""
    wrist = Vector(wrist)
    set_loc('小臂IK.' + side, wrist - WRIST_REST[side])
    hd = Vector(hand_dir).normalized() * hand_len
    # 手掌IK is a child of 小臂IK: its offset is relative to where the parent moved it
    target = wrist + hd
    moved_rest = HAND_REST[side] + (wrist - WRIST_REST[side])
    set_loc('手掌IK.' + side, target - moved_rest)

def curl(side, deg):
    for f in ['中指', '无名指', '小指', '食指']:
        n = f + '控制器.' + side
        if n in P:
            P[n].rotation_quaternion = Quaternion(Vector((1, 0, 0)), math.radians(deg))

def relaxed_arm(side, swing=0.0, lift=0.0, out=0.0):
    s = SIGN[side]
    wrist = Vector((s * (0.205 + out), 0.03 + swing, 0.945 + lift))
    arm_to(side, wrist, hand_dir=(s * 0.12, swing * 0.6, -1))

def new_action(name):
    reset_pose()
    act = D.actions.new(name)
    act.use_fake_user = True
    if not ARM.animation_data:
        ARM.animation_data_create()
    ARM.animation_data.action = act
    return act

def ease(t):
    return 0.5 - 0.5 * math.cos(math.pi * t)

# ---------------------------------------------------------------- Idle (2 s loop)
new_action('Idle')
N = 48
for f in range(N + 1):
    t = f / N
    br = math.sin(2 * math.pi * t)
    set_loc('骶椎', (0, 0, -0.012 + 0.006 * br))
    set_rot('腰控制器', (1, 0, 0), 0.4 * br)
    set_rot2('头骨', [((0, 1, 0), 3.0 * math.sin(2 * math.pi * t + 0.6)), ((1, 0, 0), -1.5 * br)])
    for s in 'LR':
        relaxed_arm(s, swing=0.006 * br * SIGN[s], lift=0.006 * br)
        curl(s, 22)
    key_all(f)

# ---------------------------------------------------------------- Walk (1 s loop, two steps)
new_action('Walk')
N = 24
STRIDE, LIFT = 0.1, 0.075
for f in range(N + 1):
    t = f / N
    for s, ph in (('L', 0.0), ('R', 0.5)):
        p = (t + ph) % 1.0
        if p < 0.5:                       # stance: front -> back
            u = p / 0.5
            y = -STRIDE + 2 * STRIDE * u
            z = 0.0
        else:                             # swing: back -> front, lifted
            u = (p - 0.5) / 0.5
            y = STRIDE - 2 * STRIDE * ease(u)
            z = LIFT * math.sin(math.pi * u)
        set_loc('小腿IK.' + s, (0, y, z))
        # arms swing opposite to the leg on the same side
        relaxed_arm(s, swing=0.75 * y, lift=0.01 + 0.01 * abs(y) / STRIDE)
        curl(s, 25)
    bob = math.cos(4 * math.pi * t)
    set_loc('骶椎', (0.012 * math.sin(2 * math.pi * t), 0, -0.018 - 0.008 * bob))
    set_rot2('腰控制器', [((1, 0, 0), 1.5), ((0, 0, 1), 4.0 * math.sin(2 * math.pi * t))])
    set_rot2('头骨', [((1, 0, 0), -3.0 + 1.5 * bob), ((0, 0, 1), -3.0 * math.sin(2 * math.pi * t))])
    key_all(f)

# ---------------------------------------------------------------- Happy (tap reaction, 1.1 s one-shot)
new_action('Happy')
N = 26
for f in range(N + 1):
    t = f / N
    # crouch -> jump -> land -> settle
    if t < 0.18:
        u = ease(t / 0.18); jump = 0.0; crouch = 0.07 * u
    elif t < 0.65:
        u = (t - 0.18) / 0.47; jump = 0.26 * math.sin(math.pi * u); crouch = 0.07 * (1 - min(1, u * 4))
    elif t < 0.8:
        u = (t - 0.65) / 0.15; jump = 0.0; crouch = 0.06 * math.sin(math.pi * u)
    else:
        jump = 0.0; crouch = 0.0
    set_loc(ROOT, (0, 0, jump))
    set_loc('骶椎', (0, 0, -0.012 - crouch))
    up = ease(min(1.0, max(0.0, (t - 0.06) / 0.2))) * (1 - ease(min(1.0, max(0.0, (t - 0.72) / 0.24))))
    for s in 'LR':
        sg = SIGN[s]
        rest = Vector((sg * 0.205, 0.03, 0.945))
        high = Vector((sg * 0.36, -0.06, 1.42))
        w = rest.lerp(high, up) + Vector((0, -0.16 * math.sin(math.pi * up), 0))   # swing up in front
        arm_to(s, w, hand_dir=(sg * (0.12 + 0.6 * up), -0.2 * up, -1 + 2 * up))
        curl(s, 22 - 30 * up)
        tuck = 0.06 * math.sin(math.pi * min(1.0, max(0.0, (t - 0.2) / 0.4)))
        set_loc('小腿IK.' + s, (0, 0.05 * tuck / 0.06, tuck))
    set_rot('头骨', (1, 0, 0), -8 * up)
    set_rot('腰控制器', (1, 0, 0), -1.2 * up)
    key_all(f)

# ---------------------------------------------------------------- Held (being dragged, 1 s loop)
new_action('Held')
N = 24
for f in range(N + 1):
    t = f / N
    k = math.sin(2 * math.pi * t)
    for s in 'LR':
        sg = SIGN[s]
        arm_to(s, (sg * 0.33, -0.02, 1.43), hand_dir=(sg * 0.5, 0, 1))
        curl(s, 10)
        kick = k * sg
        set_loc('小腿IK.' + s, (0, -0.05 * kick + 0.02, 0.045 + 0.03 * kick))
    set_loc('骶椎', (0, 0, -0.03))
    set_rot2('腰控制器', [((1, 0, 0), -0.8), ((0, 1, 0), 0.8 * k)])
    set_rot2('头骨', [((1, 0, 0), -6), ((0, 1, 0), -4 * k)])
    key_all(f)

for act in D.actions:
    for fc in getattr(act, 'fcurves', []):
        for kp in fc.keyframe_points:
            kp.interpolation = 'LINEAR'
ARM.animation_data.action = None
reset_pose()

import os
if os.environ.get('SAVE_FINAL'):
    bpy.ops.wm.save_as_mainfile(filepath=os.environ['SAVE_FINAL'], copy=True)

# ---------------------------------------------------------------- export
for o in D.objects:
    o.select_set(o.type in ('MESH', 'ARMATURE'))
bpy.context.view_layer.objects.active = ARM
bpy.ops.export_scene.gltf(
    filepath=OUT, export_format='GLB', use_selection=True,
    export_apply=False, export_normals=False, export_tangents=False,
    export_texcoords=True, export_materials='EXPORT', export_image_format='WEBP',
    export_image_quality=88,
    export_skins=True, export_def_bones=True, export_morph=True, export_morph_normal=False,
    export_animations=True, export_animation_mode='ACTIONS', export_force_sampling=True,
    export_optimize_animation_size=True, export_optimize_animation_keep_anim_armature=True,
    export_anim_single_armature=True,
    export_frame_range=False, export_yup=True,
)
print('EXPORTED', OUT)

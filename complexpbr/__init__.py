import os, time
from panda3d.core import Shader, ShaderAttrib, TextureStage, TexGenAttrib, NodePath, Texture, ATS_none
from direct.stdpy import threading2
from direct.filter.FilterManager import FilterManager


shader_init = True

shader_dir = os.path.join(os.path.dirname(__file__), '')

with open(os.path.join(shader_dir, 'pbr_v.vert')) as shaderfile:
    shaderstr = shaderfile.read()
    out_v = open('pbr_v.vert','w')
    out_v.write(shaderstr)
    out_v.close()

with open(os.path.join(shader_dir, 'pbr_f_shadows.frag')) as shaderfile:
    shaderstr = shaderfile.read()
    out_v = open('pbr_f_shadows.frag','w')
    out_v.write(shaderstr)
    out_v.close()

with open(os.path.join(shader_dir, 'min_v.vert')) as shaderfile:
    shaderstr = shaderfile.read()
    out_v = open('min_v.vert','w')
    out_v.write(shaderstr)
    out_v.close()

with open(os.path.join(shader_dir, 'min_f.frag')) as shaderfile:
    shaderstr = shaderfile.read()
    out_v = open('min_f.frag','w')
    out_v.write(shaderstr)
    out_v.close()

def set_cubebuff_inactive():
    def set_thread():
        time.sleep(.5)
        base.cube_buffer.set_active(0)
    return threading2._start_new_thread(set_thread,())

def set_cubebuff_active():
    def set_thread():
        time.sleep(.5)
        base.cube_buffer.set_active(1)
    return threading2._start_new_thread(set_thread,())

def rotate_cubemap(task):
    c_map = base.render.find('cuberig')
    c_map.set_hpr(base.cam.get_hpr(base.render))
    c_map.set_pos(base.cam.get_pos(base.render))

    return task.cont

def sobel_aa():
    filter_manager = FilterManager(base.win, base.cam)
    scene_tex = Texture("scene_tex")
    depth_tex = Texture("depth_tex")
    screen_quad = filter_manager.render_scene_into(colortex=scene_tex,depthtex=depth_tex)
    Texture.set_textures_power_2(ATS_none)
    
    vert = "min_v.vert"
    frag = "min_f.frag"
    shader = Shader.load(Shader.SL_GLSL, vert, frag)
    screen_quad.set_shader(shader)
    window_size = [base.win.get_x_size(),base.win.get_y_size()]
    screen_quad.set_shader_input("window_size", window_size)

def apply_shader(node=None,intensity=5):
    global shader_init

    if shader_init:
        shader_init = False

        vert = "pbr_v.vert"
        frag = "pbr_f_shadows.frag"

        shader = Shader.load(Shader.SL_GLSL, vert, frag)

        cube_rig = NodePath('cuberig')
        base.cube_buffer = base.win.make_cube_map('cubemap', 512, cube_rig)
        cube_rig.reparent_to(base.render)
        cube_rig.set_pos(base.cam.get_pos(base.render))
        cube_rig.set_hpr(base.cam.get_hpr(base.render))

        node.set_shader(shader)
        node.set_tex_gen(TextureStage.get_default(), TexGenAttrib.MWorldCubeMap)
        node.set_shader_input("env_intensity", intensity)
        node.set_shader_input("cubemaptex", base.cube_buffer.get_texture())

        base.task_mgr.add(rotate_cubemap)


class Shaders:
    def __init__(self):
        return

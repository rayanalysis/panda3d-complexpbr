import os, time
from panda3d.core import Shader, ShaderAttrib, TextureStage, TexGenAttrib, NodePath, Texture, ATS_none, Vec3
from direct.stdpy import threading2
from direct.filter.FilterManager import FilterManager


shader_init = True
shader_dir = os.path.join(os.path.dirname(__file__), '')

with open(os.path.join(shader_dir, 'ibl_v.vert')) as shaderfile:
    shaderstr = shaderfile.read()
    out_v = open('ibl_v.vert','w')
    out_v.write(shaderstr)
    out_v.close()

with open(os.path.join(shader_dir, 'ibl_f.frag')) as shaderfile:
    shaderstr = shaderfile.read()
    out_v = open('ibl_f.frag','w')
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
    if base.env_cam_pos is None:
        c_map.set_pos(base.cam.get_pos(base.render))
    else:
        c_map.set_pos(base.env_cam_pos)

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

def apply_shader(node=None,intensity=0.5,env_cam_pos=None):
    global shader_init

    if shader_init:
        shader_init = False
        base.env_cam_pos = env_cam_pos
        
        vert = "ibl_v.vert"
        frag = "ibl_f.frag"

        shader = Shader.load(Shader.SL_GLSL, vert, frag)

        cube_rig = NodePath('cuberig')
        base.cube_buffer = base.win.make_cube_map('cubemap', 1024, cube_rig)
        cube_rig.reparent_to(base.render)
        cube_rig.set_pos(base.cam.get_pos(base.render))
        cube_rig.set_hpr(base.cam.get_hpr(base.render))
        
        try:
            brdf_lut_tex = loader.load_texture('output_brdf_lut.png')
            shader_cam_pos = Vec3(base.cam.get_pos(base.render))

            node.set_shader(shader)
            node.set_tex_gen(TextureStage.get_default(), TexGenAttrib.MWorldCubeMap)
            node.set_shader_input("cubemaptex", base.cube_buffer.get_texture())
            node.set_shader_input("brdfLUT", brdf_lut_tex)
            node.set_shader_input("camPos", shader_cam_pos)
            node.set_shader_input("ao", intensity)

            base.task_mgr.add(rotate_cubemap)
            
        except:
            ex_text = "You must create the 'output_brdf_lut.png' or copy the complexpbr sample to your program dir."
            ex_text_2 = '\n\n' + "You may create a custom BRDF LUT with the provided 'brdf_lut_calculator.py' script."
            ex_text_3 = '\n\n' + "The sample 'output_brdf_lut.png' and the creation script can be found in the panda3d-complexpbr git repo."
            print(ex_text,ex_text_2,ex_text_3)


class Shaders:
    def __init__(self):
        return

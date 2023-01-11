import os
from panda3d.core import Shader, ShaderAttrib, TextureStage, TexGenAttrib, NodePath


shader_init = True

def apply_shader(node=None,intensity=50):
    global shader_init

    if shader_init:
        shader_init = False

        vert = "pbr_shader_v_invert.vert"
        frag = "pbr_shader_f_invert.frag"

        shader = Shader.load(Shader.SL_GLSL, vert, frag)
        
        cube_rig = NodePath('cuberig')
        cube_buffer = base.win.make_cube_map('cubemap', 1024, cube_rig)
        cube_rig.reparent_to(base.render)
        cube_rig.set_pos(5, 5, 0)
        cube_rig.set_p(-90)

        node.set_shader(shader)
        node.set_tex_gen(TextureStage.get_default(), TexGenAttrib.MWorldCubeMap)
        node.set_shader_input("env_intensity", intensity)
        node.set_shader_input("cubemaptex", cube_buffer.get_texture())

class Shaders:
    def __init__(self):
        return

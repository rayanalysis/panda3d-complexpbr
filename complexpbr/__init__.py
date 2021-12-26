import os
from panda3d.core import Shader, ShaderAttrib


class Shaders:
    def __init__(self):
        return
    
    def apply_shader(self, node=None, scene=False, skin=False, tracer=False):
    
        shader_dir = os.path.join(os.path.dirname(__file__), '')

        if scene:
            with open(os.path.join(shader_dir, 'pbr_v.vert')) as shaderfile:
                vert = shaderfile.name
                
            with open(os.path.join(shader_dir, 'pbr_f.frag')) as shaderfile:
                frag = shaderfile.name

            scene_shader = Shader.load(Shader.SL_GLSL, vert, frag)
            node.set_shader_off()
            node.set_shader(scene_shader)

        if skin:
            with open(os.path.join(shader_dir, 'pbr_v_arm.vert')) as shaderfile:
                vert = shaderfile.name
                
            with open(os.path.join(shader_dir, 'pbr_f_arm.frag')) as shaderfile:
                frag = shaderfile.name

            arm_shader = Shader.load(Shader.SL_GLSL, vert, frag)
            arm_attrib = ShaderAttrib.make(arm_shader)
            arm_attrib.set_flag(ShaderAttrib.F_hardware_skinning, True)
            node.set_shader_off()
            node.set_attrib(arm_attrib)
        
        if tracer:
            raise Exception('Tracing is not yet implemented.')

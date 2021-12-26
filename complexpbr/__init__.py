from panda3d.core import Shader, ShaderAttrib


class Shaders:
    def __init__(self):
        return
    
    def apply_shader(self, node=None, scene=False, skin=False, tracer=False):
        if scene:
            vert = 'pbr_v.vert'
            frag = 'pbr_f.frag'
            scene_shader = Shader.load(Shader.SL_GLSL, vert, frag)
            node.set_shader_off()
            node.set_shader(scene_shader)

        if skin:
            vert = 'pbr_v_arm.vert'
            frag = 'pbr_f_arm.frag'
            arm_shader = Shader.load(Shader.SL_GLSL, vert, frag)
            arm_attrib = ShaderAttrib.make(arm_shader)
            arm_attrib.set_flag(ShaderAttrib.F_hardware_skinning, True)
            node.set_shader_off()
            node.set_attrib(arm_attrib)
        
        if tracer:
            raise Exception('Tracing is not yet implemented.')

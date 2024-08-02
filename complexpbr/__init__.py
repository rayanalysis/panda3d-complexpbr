import os, time
from pathlib import Path
from panda3d.core import Shader, ShaderAttrib, TextureStage, TexGenAttrib, NodePath
from panda3d.core import Texture, ATS_none, Vec3, AuxBitplaneAttrib, PNMImage, AntialiasAttrib
from panda3d.core import load_prc_file_data
from direct.stdpy import threading2
from direct.filter.FilterManager import FilterManager


complexpbr_init = True
shader_dir = os.path.join(os.path.dirname(__file__), '')

def remove_shader_files():
    os.remove('ibl_v.vert')
    os.remove('ibl_f.frag')
    
    try:
        os.remove('min_v.vert')
        os.remove('min_f.frag')
    except:
        print('complexpbr message: Screenspace shaders are not present for deletion.')
        
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
    base.complexpbr_map.set_h(base.render,base.cam.get_h(base.render))
    base.complexpbr_map.set_p(base.render,base.cam.get_p(base.render) + 90)
    cam_pos = base.cam.get_pos(base.render)
    if base.env_cam_pos is not None:
        base.complexpbr_map.set_pos(base.env_cam_pos[0],base.env_cam_pos[1],base.env_cam_pos[2]+base.complexpbr_map_z)
    else:
        base.complexpbr_map.set_pos(cam_pos[0],cam_pos[1],cam_pos[2]+base.complexpbr_map_z)
        
    if base.complexpbr_z_tracking:
        cam_relative_pos = base.cam.get_pos(base.render)
        cam_relative_pos[2] = cam_relative_pos[2]-(2 * cam_relative_pos[2])
        base.env_cam_pos = cam_relative_pos

    return task.cont

def screenspace_init():
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

    auxbits = 0
    auxbits |= AuxBitplaneAttrib.ABOAuxNormal

    filter_manager = FilterManager(base.win, base.cam)
    scene_tex = Texture("scene_tex")
    depth_tex = Texture("depth_tex")
    normal_tex = Texture("normal_tex")
    all_tex = {}
    screen_quad = filter_manager.render_scene_into(colortex=scene_tex,
                                                   auxbits=auxbits,
                                                   depthtex=depth_tex,
                                                   auxtex=normal_tex,
                                                   textures=all_tex)
    Texture.set_textures_power_2(ATS_none)
    window_size = [base.win.get_x_size(),base.win.get_y_size()]
    camera_near = base.camLens.get_near()
    camera_far = base.camLens.get_far()
    
    bloom_intensity = 0.0  # default Bloom to 0.0 / off
    bloom_blur_width = 10
    bloom_samples = 6
    bloom_threshold = 0.7
    ssr_intensity = 0.5
    ssr_step = 4.0
    ssr_fresnel_pow = 3.0
    ssr_samples = 0  # default SSR to 0.0 / off
    ssao_samples = 8
    reflection_threshold = 1.0
    hsv_r = 1.0
    hsv_g = 1.0
    hsv_b = 1.0

    vert = "min_v.vert"
    frag = "min_f.frag"
    shader = Shader.load(Shader.SL_GLSL, vert, frag)
    screen_quad.set_shader(shader)
    screen_quad.set_shader_input("window_size", window_size)
    screen_quad.set_shader_input("scene_tex", scene_tex)
    screen_quad.set_shader_input("depth_tex", depth_tex)
    screen_quad.set_shader_input("normal_tex", normal_tex)
    screen_quad.set_shader_input("cameraNear", camera_near)
    screen_quad.set_shader_input("cameraFar", camera_far)
    screen_quad.set_shader_input("bloom_intensity", bloom_intensity)
    screen_quad.set_shader_input("bloom_threshold", bloom_threshold)
    screen_quad.set_shader_input("bloom_blur_width", bloom_blur_width)
    screen_quad.set_shader_input("bloom_samples", bloom_samples)
    screen_quad.set_shader_input("ssr_intensity", ssr_intensity)
    screen_quad.set_shader_input("ssr_step", ssr_step)
    screen_quad.set_shader_input("ssr_fresnel_pow", ssr_fresnel_pow)
    screen_quad.set_shader_input("ssr_samples", ssr_samples)
    screen_quad.set_shader_input("ssao_samples", ssao_samples)
    screen_quad.set_shader_input("reflection_threshold", reflection_threshold)
    screen_quad.set_shader_input("hsv_r", hsv_r)
    screen_quad.set_shader_input("hsv_g", hsv_g)  # HSV saturation adjustment
    screen_quad.set_shader_input("hsv_b", hsv_b)
    
    base.screen_quad = screen_quad
    base.render.set_antialias(AntialiasAttrib.MMultisample)

def complexpbr_rig_init(node, intensity, lut_fill):
    load_prc_file_data('', 'hardware-animated-vertices #t')
    load_prc_file_data('', 'framebuffer-srgb #t')
    load_prc_file_data('', 'framebuffer-depth-32 1')
    load_prc_file_data('', 'gl-depth-zero-to-one #f')
    load_prc_file_data('', 'gl-cube-map-seamless 1')
    load_prc_file_data('', 'framebuffer-multisample 1')
    load_prc_file_data('', 'multisamples 4')
    
    brdf_lut_tex = Texture("complexpbr_lut")
    brdf_lut_image = PNMImage()
    brdf_lut_image.clear(x_size=base.win.get_x_size(),y_size=base.win.get_y_size(),num_channels=4)
    brdf_lut_image.fill(red=lut_fill[0],green=lut_fill[1],blue=lut_fill[2])
    # brdf_lut_image.alpha_fill(1.0)
    brdf_lut_tex.load(brdf_lut_image)
    brdf_lut_ext_tex = Path('output_brdf_lut.png')
    
    if brdf_lut_ext_tex.is_file():
        brdf_lut_tex = loader.load_texture('output_brdf_lut.png')
    else:
        brdf_lut_tex.load(brdf_lut_image)

    shader_cam_pos = Vec3(base.cam.get_pos(base.render))
    displacement_scale_val = 0.0  # default to 0 to avoid having to check for displacement
    displacement_map = Texture()
    specular_factor = 1.0

    node.set_shader(base.complexpbr_shader)

    node.set_tex_gen(TextureStage.get_default(), TexGenAttrib.MWorldCubeMap)
    node.set_shader_input("cubemaptex", base.cube_buffer.get_texture())
    node.set_shader_input("brdfLUT", brdf_lut_tex)
    node.set_shader_input("ao", intensity)
    node.set_shader_input("displacement_scale", displacement_scale_val)
    node.set_shader_input("displacement_map", displacement_map)
    node.set_shader_input("specular_factor", specular_factor)

    base.task_mgr.add(rotate_cubemap)

    base.complexpbr_skin_attrib = ShaderAttrib.make(base.complexpbr_shader)
    base.complexpbr_skin_attrib = base.complexpbr_skin_attrib.set_flag(ShaderAttrib.F_hardware_skinning, True)

def skin(node):
    node.set_attrib(base.complexpbr_skin_attrib)

def apply_shader(node=None,intensity=1.0,env_cam_pos=None,env_res=256,lut_fill=[1.0,0.0,0.0],complexpbr_z_tracking=False):
    global complexpbr_init
    
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

    if complexpbr_init:
        complexpbr_init = False
        
        vert = "ibl_v.vert"
        frag = "ibl_f.frag"

        base.complexpbr_shader = Shader.load(Shader.SL_GLSL, vert, frag)

        base.complexpbr_map = NodePath('cuberig')
        base.cube_buffer = base.win.make_cube_map('cubemap', env_res, base.complexpbr_map)
        base.complexpbr_map.reparent_to(base.render)
        base.complexpbr_map_z = 0
        base.env_cam_pos = env_cam_pos
        base.complexpbr_z_tracking = complexpbr_z_tracking

    complexpbr_rig_init(node, intensity=intensity, lut_fill=lut_fill)

class Shaders:
    def __init__(self):
        return

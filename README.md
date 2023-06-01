# panda3d-complexpbr
Functional node level scene shader application for Panda3D. complexpbr supports realtime environment reflections for BSDF materials. These reflections are implemented with IBL (Image-based lighting) and PBR (Physically Based Rendering) forward shading constructs. Your machine must support GLSL version 430 or higher. Sample screenshots below.

Featuring support for vertex displacement mapping, SSAO (Screen Space Ambient Occlusion), SSR (Screen Space Reflections), HSV color correction, Bloom, and Sobel based antialiasing in a screenspace kernel shader, which approximates temporal antialiasing. complexpbr.screenspace_init() automatically enables the AA, SSAO, SSR, and HSV color correction. To use the vertex displacement mapping, provide your displacement map as a shader input to your respective model node -- example below in the Usage section.

By default, the environment reflections dynamically track the camera view. You may set a custom position with the 'env_cam_pos' apply_shader() input variable to IE fix the view to a skybox somewhere on the scene graph. This env_cam_pos variable can be updated live afterwards by setting base.env_cam_pos = Vec3(some_pos). The option to disable or re-enable dynamic reflections is available. 

As of the current version, you must copy the provided output_brdf_lut.png or (recommended) create your own BRDF LUT using the provided brdf_lut_calculator.py using an image you supply from your game/program scene. These can be found in the complexpbr folder here.

The goal of this project is to provide extremely easy to use scene shaders to expose the full functionality of Panda3D rendering, including interoperation with CommonFilters and setting shaders on a per-node basis.

![complexpbr_reflections_2](https://github.com/rayanalysis/panda3d-complexpbr/assets/3117958/d6d3867a-6dfb-4512-8a79-de80bf35bc26)

![helmet_3](https://github.com/rayanalysis/panda3d-complexpbr/assets/3117958/47ab57e8-180c-46e6-a8c2-289bb59edccd)

![sponza_screen_1-Thu-Jun-01-08-03-05-2023-51](https://github.com/rayanalysis/panda3d-complexpbr/assets/3117958/3dc0cfd7-d3a5-47b5-929f-f33bf0718506)

![sponza_screen_1-Thu-Jun-01-08-04-56-2023-20](https://github.com/rayanalysis/panda3d-complexpbr/assets/3117958/36b76bb6-f31b-4a95-8fae-3b22fe1696d3)

![complexpbr_bloom_screen_1](https://user-images.githubusercontent.com/3117958/236596857-4469be04-f9ab-4f84-9566-fe4bb5c0b201.png)

## Usage:
```python
from direct.showbase.ShowBase import ShowBase
import complexpbr

class main(ShowBase):
    def __init__(self):
        super().__init__()
         
        # apply a scene shader with PBR IBL
        # node can be base.render or any model node, intensity is the desired AO
        # (ambient occlusion reflection) intensity (float, 0.0 to 1.0)
        # you may wish to define a specific position in your scene where the 
        # cube map is rendered from, to IE have multiple skyboxes preloaded
        # somewhere on the scene graph and have their reflections map to your
        # models -- to achieve this, set env_cam_pos=Vec3(your_pos)
        # you may set base.env_cam_pos after this, and it will update in realtime
        # env_res is the cube map resolution, can only be set once upon first call
        
        complexpbr.apply_shader(self.render,intensity=0.7,env_cam_pos=None,env_res=256)

        # initialize complexpbr's screenspace effects (SSAO, SSR, AA, HSV color correction)
        # this replaces CommonFilters functionality
        complexpbr.screenspace_init()
        
        # make the cubemap rendering static (performance boost)
        complexpbr.set_cubebuff_inactive()
        
        # make the cubemap rendering dynamic (this is the default state)
        complexpbr.set_cubebuff_active()
        
        # example of how to use the vertex displacement mapping
        wood_sphere_3 = loader.load_model('assets/models/wood_sphere_3.gltf')
        wood_sphere_3.reparent_to(base.render)
        wood_sphere_3.set_pos(0,0,1)
        dis_tex = Texture()
        dis_tex.read('assets/textures/WoodFloor057_2K-PNG/WoodFloor057_2K_Displacement.png')
        wood_sphere_3.set_shader_input('displacement_map',dis_tex)
        wood_sphere_3.set_shader_input('displacement_scale',0.01)
        
        # example of how to set up bloom -- complexpbr.screenspace_init() must have been called first
        screen_quad = base.screen_quad
        
        bloom_intensity = 5.0  # bloom defaults to 0.0 / off
        bloom_blur_width = 10
        bloom_samples = 6
        bloom_threshold = 0.7

        screen_quad.set_shader_input("bloom_intensity", bloom_intensity)
        screen_quad.set_shader_input("bloom_threshold", bloom_threshold)
        screen_quad.set_shader_input("bloom_blur_width", bloom_blur_width)
        screen_quad.set_shader_input("bloom_samples", bloom_samples)
        
        # example of how to customize SSR
        ssr_intensity = 0.5
        ssr_step = 4.0
        ssr_fresnel_pow = 3.0
        ssr_samples = 128
        
        screen_quad.set_shader_input("ssr_intensity", ssr_intensity)
        screen_quad.set_shader_input("ssr_step", ssr_step)
        screen_quad.set_shader_input("ssr_fresnel_pow", ssr_fresnel_pow)
        screen_quad.set_shader_input("ssr_samples", ssr_samples)
        
        # example of how to modify the specular contribution
        # the specular_factor defaults to 1.0
        self.render.set_shader_input("specular_factor", 10.0)
        
        # if complexpbr.screenspace_init() has not been called, you may use CommonFilters
        # scene_filters = CommonFilters(base.win, base.cam)
        # scene_filters.set_bloom(size='medium')
        # scene_filters.set_exposure_adjust(1.1)
        # scene_filters.set_gamma_adjust(1.1)
        # scene_filters.set_blur_sharpen(0.9)
```
## Building:

The module may be built using setuptools. 
```bash
python3 setup.py bdist_wheel
```
```bash
pip3 install 'path/to/panda3d-complexpbr.whl'
```
## Installing with PyPI:

To-do.

## Future Project Goals:
- Function triggers for building new BRDF LUT samplers in realtime
- Installation over pip

## Requirements:

- panda3d

![sponza_screen_1-Thu-Jun-01-05-39-29-2023-111](https://github.com/rayanalysis/panda3d-complexpbr/assets/3117958/9401bdd4-ed00-46a1-baa1-d542a090374f)

![sponza_screen_1-Thu-Jun-01-05-55-48-2023-540](https://github.com/rayanalysis/panda3d-complexpbr/assets/3117958/cd7b84e1-d1c1-479b-88ef-62b791476b2e)

![sponza_screen_2-Thu-Jun-01-05-40-36-2023-262](https://github.com/rayanalysis/panda3d-complexpbr/assets/3117958/4c668524-430c-4157-9f1a-1881006bb2a1)

![sponza_screen_2-Thu-Jun-01-05-56-06-2023-591](https://github.com/rayanalysis/panda3d-complexpbr/assets/3117958/f9ef5d69-a248-4f08-a152-8f3a7cd7cbf5)

![sponza_screen_3-Thu-Jun-01-05-56-32-2023-657](https://github.com/rayanalysis/panda3d-complexpbr/assets/3117958/0c8a149a-e8c9-47de-b4d3-d7c36c5da97a)

![complexpbr_daytime_screen_1](https://user-images.githubusercontent.com/3117958/235431990-d8ea4364-2526-4739-963c-dce122815f2a.png)

![complexpbr_daytime_screen_2](https://user-images.githubusercontent.com/3117958/235431991-d1f40263-f442-46ed-98a7-056e6186c148.png)

![complexpbr_daytime_screen_3](https://user-images.githubusercontent.com/3117958/235432001-07091c4c-9bc1-4385-81d2-9d50c6fd61b9.png)

![complexpbr_screen_2](https://user-images.githubusercontent.com/3117958/234434099-c6add6ce-578c-4c03-a142-adcf955c14fc.png)

![complexpbr_screen_3](https://user-images.githubusercontent.com/3117958/234434136-9418663d-2304-451b-a318-d3cb4d945a8b.png)

Vertex Displacement Mapping:

![complexpbr_screen_4](https://user-images.githubusercontent.com/3117958/234434178-1e14fa32-2be4-4072-ae15-9ee235d8c036.png)

SSR:

![complexpbr_screen_7](https://user-images.githubusercontent.com/3117958/234434222-f903c22c-dcd5-4d7b-be25-b7f4bf2f927d.png)


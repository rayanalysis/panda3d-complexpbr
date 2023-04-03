# panda3d-complexpbr
Functional node level scene shader application for Panda3D. complexpbr supports realtime environment reflections for BSDF materials. These reflections are implemented with IBL (Image-based lighting) and PBR (Physically Based Rendering) forward shading constructs. 

By default, the environment reflections dynamically track the camera view. The option to disable or re-enable dynamic reflections is available. As of the current version, you must copy the provided output_brdf_lut.png or (recommended) create your own BRDF LUT using the provided brdf_lut_calculator.py using an image you provide from your game/program scene. These can be found in the complexpbr folder here.

Also featuring support for Sobel based antialiasing in a screenspace kernel shader. This approximates temporal antialiasing.

The goal of this project is to provide extremely easy to use scene shaders to expose the full functionality of Panda3D rendering, including interoperation with CommonFilters and setting shaders on a per-node basis.

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
        
        complexpbr.apply_shader(self.render,intensity=0.3)
        
        # make the cubemap rendering static (large performance boost)
        complexpbr.set_cubebuff_inactive()
        
        # make the cubemap rendering dynamic (this is the default state)
        complexpbr.set_cubebuff_active()
        
        # initialize complexpbr's implementation of screenspace AA
        # this replaces CommonFilters functionality
        complexpbr.sobel_aa()

        # if complexpbr.sobel_aa() has not been called, you may use CommonFilters
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

- panda3d-gltf

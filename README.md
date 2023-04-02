# panda3d-complexpbr
Functional node level scene shader application for Panda3D. complexpbr supports realtime environment reflections for BSDF metals. These reflections are Roughness-mediated. By default, the environment reflections dynamically track the camera view. The option to disable or re-enable dynamic reflections is available.

Now featuring support for Sobel based antialiasing in a screenspace kernel shader. This approximates temporal antialiasing.

The goal of this project is to provide extremely easy to use scene shaders to expose the full functionality of Panda3D rendering, including interoperation with CommonFilters and setting shaders on a per-node basis. 

## Usage:
```python
from direct.showbase.ShowBase import ShowBase
import complexpbr

class main(ShowBase):
    def __init__(self):
        super().__init__()
         
        # apply a scene shader with support for realtime environment metal reflections
        # node can be base.render or any model node, intensity is the desired env_map intensity
        
        complexpbr.apply_shader(self.render,intensity=5)
        
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
- Installation over pip

## Requirements:

- panda3d-gltf

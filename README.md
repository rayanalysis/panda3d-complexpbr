# panda3d-complexpbr
Functional node level shader application for Panda3D. This project is under development and has been recently refactored to support realtime environment reflections for BSDF metals. These reflections are Roughness-mediated.

This is an early prototype for applying prebuilt scene shaders with an OpenGL 330 PBR workflow using Panda3D. The module assumes you have .gltf files prepared with fully complete 4-slot metal-rough texturing on a BSDF Principled Node. Currently, the shaders are modified and prearranged versions based on https://github.com/Moguri/panda3d-simplepbr

The goal of this project is to provide extremely easy to use scene shaders to expose the full functionality of Panda3D rendering, including interoperation with CommonFilters and setting shaders on a per-node basis. 

## Usage:
```python
from direct.showbase.ShowBase import ShowBase
import complexpbr

class main(ShowBase):
     def __init__(self):
         super().__init__()
         gltf.patch_loader(self.loader)
         
         # apply a scene shader with support for realtime environment metal reflections
         complexpbr.apply_shader(node=render)
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

- Implementing a GLSL raytracer or pathtracer scene shader
- Installation over pip

## Requirements:

- panda3d-gltf
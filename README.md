# panda3d-complexpbr
Functional node level shader application for Panda3D.

This is an early prototype for applying prebuilt scene shaders with an OpenGL 330 PBR workflow using Panda3D. The module assumes you have .gltf files prepared with fully complete 4-slot metal-rough texturing on a BSDF Principled Node.

The goal of this project is to provide extremely easy to use scene shaders to expose the full functionality of Panda3D rendering, including interoperation with CommonFilters and setting shaders on a per-node basis. 

## Usage:
```python
from direct.showbase.ShowBase import ShowBase
from direct.actor.Actor import Actor
from complexpbr import Shaders as pbr
import gltf

class main(ShowBase):
     def __init__(self):
         super().__init__()
         gltf.patch_loader(self.loader)
         
         # apply a scene shader with no hardware skinning
         pbr.apply_shader(self, node=render, scene=True)
         
         # apply an "Actor shader" for hardware skinning
         your_character = Actor(loader.load_model('character.gltf'))
         pbr.apply_shader(self, node=your_character, skin=True)
```
## Building:

The module may be built using setuptools. python3 setup.py bdist_wheel

pip3 install 'path/to/panda3d-complexpbr.whl'

## Installing with PyPi:

To-do.

## Future Project Goals:

- Implementing a GLSL raytracer or pathtracer scene shader
- Installation over pip

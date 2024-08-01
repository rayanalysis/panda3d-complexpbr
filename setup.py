from setuptools import setup

setup(
    name='panda3d-complexpbr',
    version='0.5.5',
    packages=['complexpbr'],
    package_data={
       "": ["*.txt","*.vert","*.frag","*.png"],
       }
    )

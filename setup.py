from setuptools import setup

setup(
    name='panda3d-complexpbr',
    version='0.6.2',
    packages=['complexpbr'],
    package_data={
       "": ["*.txt","*.vert","*.frag","*.png"],
       }
    )

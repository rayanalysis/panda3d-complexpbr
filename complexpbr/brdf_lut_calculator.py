# This script loads an input texture named 'input_texture.png', applies the BRDF calculations to it, 
# and saves the result as 'output_brdf_lut.png'.

import numpy as np
import OpenGL  # this is PyOpenGL
# if the pip install of PyOpenGL isn't working, install from https://www.lfd.uci.edu/~gohlke/pythonlibs/#pyopengl
from OpenGL.GL import *
from OpenGL.GLUT import *
from OpenGL.GLU import *
from PIL import Image

def compile_shader(source, shader_type):
    shader = glCreateShader(shader_type)
    glShaderSource(shader, source)
    glCompileShader(shader)
    print('Compiling BRDF LUT shader...')
    return shader

def create_program(vertex_shader, fragment_shader):
    program = glCreateProgram()
    glAttachShader(program, vertex_shader)
    glAttachShader(program, fragment_shader)
    glLinkProgram(program)
    print('Creating BRDF LUT program...')
    return program

vertex_shader_src = '''
#version 330 core
layout (location = 0) in vec3 aPos;
layout (location = 1) in vec2 aTexCoord;

out vec2 TexCoord;

void main()
{
    gl_Position = vec4(aPos, 1.0);
    TexCoord = aTexCoord;
}
'''

fragment_shader_src = '''
#version 330 core
out vec4 FragColor;
in vec2 TexCoord;

uniform sampler2D inputTexture;
uniform float aspectRatio;

const float PI = 3.14159265359;

float RadicalInverse_VdC(uint bits)
{
    bits = (bits << 16u) | (bits >> 16u);
    bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);
    bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);
    bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);
    bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);
    return float(bits) * 2.3283064365386963e-10; // / 0x100000000
}

vec2 Hammersley(uint i, uint N)
{
    return vec2(float(i)/float(N), RadicalInverse_VdC(i));
}

vec3 ImportanceSampleGGX(vec2 Xi, vec3 N, float roughness)
{
    float a = roughness*roughness;
	
    float phi = 2.0 * PI * Xi.x;
    float cosTheta = sqrt((1.0 - Xi.y) / (1.0 + (a*a - 1.0) * Xi.y));
    float sinTheta = sqrt(1.0 - cosTheta*cosTheta);
	
    vec3 H;
    H.x = cos(phi) * sinTheta;
    H.y = sin(phi) * sinTheta;
    H.z = cosTheta;
	
    vec3 up = abs(N.z) < 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
    vec3 tangent = normalize(cross(up, N));
    vec3 bitangent = cross(N, tangent);
	
    vec3 sampleVec = tangent * H.x + bitangent * H.y + N * H.z;
    return normalize(sampleVec);
}

void main()
{       
    vec2 uv = TexCoord * vec2(1.0, aspectRatio);
    vec3 N = vec3(0.0, 0.0, 1.0);
    vec3 V = vec3(sqrt(1.0 - uv.y) * cos(2.0 * PI * uv.x), sqrt(1.0 - uv.y) * sin(2.0 * PI * uv.x), uv.y);
    
    vec4 inputColor = texture(inputTexture, TexCoord);

    float roughness = inputColor.r;
    uint SAMPLE_COUNT = uint(1024u * max(inputColor.g, 0.001));
    
    float A = 0.0;
    float B = 0.0;

    for(uint i = 0u; i < SAMPLE_COUNT; ++i)
    {
        vec2 Xi = Hammersley(i, SAMPLE_COUNT);
        vec3 H = ImportanceSampleGGX(Xi, N, roughness);
        vec3 L = 2.0 * dot(V, H) * H - V;

        
        float NdotL = max(L.z, 0.0);
        float NdotV = max(V.z, 0.0);
        float VdotH = max(dot(V, H), 0.0);
        float NdotH = max(H.z, 0.0);
        
        if(NdotL > 0.0)
        {
            float G = min(1.0, min((2.0 * NdotH * NdotV) / VdotH, (2.0 * NdotH * NdotL) / VdotH));
            float G_Vis = G * VdotH / (NdotH * NdotV);
            float Fc = pow(1.0 - VdotH, 5.0);
            
            A += (1.0 - Fc) * G_Vis;
            B += Fc * G_Vis;
        }
}
    A /= float(SAMPLE_COUNT);
    B /= float(SAMPLE_COUNT);
    
    FragColor = vec4(A, B, 0.0, 0.0);
}
'''

def capture_lut():
    # initialize GLUT
    glutInit()
    glutInitDisplayMode(GLUT_DOUBLE | GLUT_RGB | GLUT_DEPTH)
    glutInitWindowSize(512, 512)
    glutCreateWindow(b'BRDF LUT Generator')

    # compile shaders and create a program
    vertex_shader = compile_shader(vertex_shader_src, GL_VERTEX_SHADER)
    fragment_shader = compile_shader(fragment_shader_src, GL_FRAGMENT_SHADER)
    shader_program = create_program(vertex_shader, fragment_shader)

    # generate a quad to render the texture
    quad_vertices = np.array([
        -1.0, 1.0, 0.0, 0.0, 1.0,
        -1.0, -1.0, 0.0, 0.0, 0.0,
        1.0, 1.0, 0.0, 1.0, 1.0,
        1.0, -1.0, 0.0, 1.0, 0.0
    ], dtype=np.float32)

    vertex_array_object = glGenVertexArrays(1)
    glBindVertexArray(vertex_array_object)

    vertex_buffer_object = glGenBuffers(1)
    glBindBuffer(GL_ARRAY_BUFFER, vertex_buffer_object)
    glBufferData(GL_ARRAY_BUFFER, quad_vertices, GL_STATIC_DRAW)

    glEnableVertexAttribArray(0)
    glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 20, None)
    glEnableVertexAttribArray(1)
    glVertexAttribPointer(1, 2, GL_FLOAT, GL_FALSE, 20, ctypes.c_void_p(12))

    glUseProgram(shader_program)

    # load the input texture
    input_image = Image.open('input_texture.png')  # provide some precaptured framebuffer texture from your program/game here
    input_image_data = np.array(input_image, dtype=np.uint8)

    # set a fixed size for the output texture
    output_texture_size_1 = 1080
    output_texture_size_2 = 1920
    
    # calculate the aspect ratio
    aspect_ratio = float(input_image.width) / float(input_image.height)

    input_texture = glGenTextures(1)
    glBindTexture(GL_TEXTURE_2D, input_texture)
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA, input_image.width, input_image.height, 0, GL_RGBA, GL_UNSIGNED_BYTE, input_image_data)
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR)
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR)
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE)
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE)

    # set the input texture as a uniform in the shader
    glUniform1i(glGetUniformLocation(shader_program, "inputTexture"), 0)

    # pass the aspect ratio to the shader
    glUniform1f(glGetUniformLocation(shader_program, "aspectRatio"), aspect_ratio)

    # generate framebuffer to render the output texture
    framebuffer = glGenFramebuffers(1)
    glBindFramebuffer(GL_FRAMEBUFFER, framebuffer)

    # generate the output texture
    output_texture = glGenTextures(1)
    glBindTexture(GL_TEXTURE_2D, output_texture)
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA16F, output_texture_size_1, output_texture_size_2, 0, GL_RGBA, GL_FLOAT, None)
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR)
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR)
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE)
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE)

    # attach the output texture to the framebuffer
    glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, output_texture, 0)

    # bind the input texture to a texture unit and set the uniform sampler2D in the shader
    glActiveTexture(GL_TEXTURE0)
    glBindTexture(GL_TEXTURE_2D, input_texture)
    glUniform1i(glGetUniformLocation(shader_program, "inputTexture"), 0)

    # render the output texture
    glViewport(0, 0, output_texture_size_1, output_texture_size_2)
    glDrawArrays(GL_TRIANGLE_STRIP, 0, 4)

    # read the output texture data
    output_texture_data = glReadPixels(0, 0, output_texture_size_1, output_texture_size_2, GL_RGBA, GL_FLOAT)
    output_texture_data = np.frombuffer(output_texture_data, dtype=np.float32).reshape((output_texture_size_1, output_texture_size_2, 4))

    # save the output texture to a file
    output_texture_image = (np.nan_to_num(output_texture_data) * 65535).astype(np.uint16)  # convert to 16-bit
    Image.fromarray(output_texture_image, mode='RGBA').save('output_brdf_lut.png')
    print('Saved BRDF LUT image...')
    # return Image.fromarray(output_texture_image, mode='RGBA')

    # clean up
    glDeleteTextures(2, [input_texture, output_texture])
    glDeleteFramebuffers(1, [framebuffer])
    glDeleteVertexArrays(1, [vertex_array_object])
    glDeleteBuffers(1, [vertex_buffer_object])
    glDeleteProgram(shader_program)
    glDeleteShader(vertex_shader)
    glDeleteShader(fragment_shader)
    glutDestroyWindow(glutGetWindow())

    print("Output texture generated and saved as output_brdf_lut.png")

capture_lut()

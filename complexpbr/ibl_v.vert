#version 430
#extension GL_ARB_bindless_texture : require

#ifndef MAX_LIGHTS
    #define MAX_LIGHTS 20
#endif

uniform mat4 p3d_ProjectionMatrix;
uniform mat4 p3d_ModelViewMatrix;
uniform mat3 p3d_NormalMatrix;
uniform mat4 p3d_TextureMatrix;

in vec3 p3d_Normal;
in vec4 p3d_Vertex;
in vec4 p3d_Color;
in vec4 p3d_Tangent;
in vec2 p3d_MultiTexCoord0;

out vec3 v_position;
out vec4 v_color;
out mat3 v_tbn;
out vec2 v_texcoord;

uniform sampler2D displacement_map;
uniform float displacement_scale;

uniform struct p3d_LightSourceParameters {
    vec4 position;
    vec4 diffuse;
    vec4 specular;
    vec3 attenuation;
    vec3 spotDirection;
    float spotCosCutoff;
    sampler2DShadow shadowMap;
    mat4 shadowViewMatrix;
} p3d_LightSource[MAX_LIGHTS];

out vec4 v_shadow_pos[MAX_LIGHTS];

void main()
{
    vec3 normal = normalize(p3d_NormalMatrix * p3d_Normal);
    vec3 tangent = normalize(p3d_NormalMatrix * p3d_Tangent.xyz);
    vec3 bitangent = cross(normal, tangent) * p3d_Tangent.w;
    v_tbn = mat3(tangent, bitangent, normal);
	
    v_color = p3d_Color;
    v_texcoord = (p3d_TextureMatrix * vec4(p3d_MultiTexCoord0, 0.0, 1.0)).xy;
    float displacement = texture(displacement_map, v_texcoord).r * displacement_scale;
    vec4 displaced_vertex = p3d_Vertex + vec4(normal, 0.0) * displacement;
    v_position = vec3(p3d_ModelViewMatrix * displaced_vertex);
    
    // calculate the shadow positions after updating the v_position
    for (int i = 0; i < MAX_LIGHTS; ++i) {
        v_shadow_pos[i] = p3d_LightSource[i].shadowViewMatrix * vec4(v_position, 1);
    }

    gl_Position = p3d_ProjectionMatrix * p3d_ModelViewMatrix * displaced_vertex;
}
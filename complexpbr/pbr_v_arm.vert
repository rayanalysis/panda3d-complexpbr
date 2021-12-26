// Based on panda3d-simplepbr (see license files for information)

#version 330

#define GLM_FORCE_SWIZZLE

#ifndef MAX_LIGHTS
    #define MAX_LIGHTS 5
#endif

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

uniform mat4 p3d_ProjectionMatrix;
uniform mat4 p3d_ModelViewMatrix;
uniform mat3 p3d_NormalMatrix;
uniform mat4 p3d_TextureMatrix;
uniform mat4 p3d_TransformTable[100];

in vec3 p3d_Normal;
in vec4 p3d_Vertex;
in vec4 p3d_Color;
in vec4 p3d_Tangent;
in vec2 p3d_MultiTexCoord0;

in vec4 transform_weight;
in uvec4 transform_index;

out vec3 v_position;
out vec4 v_color;
out mat3 v_tbn;
out vec2 v_texcoord;

out vec4 v_shadow_pos[MAX_LIGHTS];

void main() {
    mat4 skin_matrix = (
        p3d_TransformTable[transform_index.x] * transform_weight.x +
        p3d_TransformTable[transform_index.y] * transform_weight.y +
        p3d_TransformTable[transform_index.z] * transform_weight.z +
        p3d_TransformTable[transform_index.w] * transform_weight.w);
    
    vec4 vert_pos4 = p3d_ModelViewMatrix * skin_matrix * p3d_Vertex;

    v_position = vec3(vert_pos4);
    v_color = p3d_Color;
    vec3 normal = normalize(p3d_NormalMatrix * (skin_matrix * vec4(p3d_Normal.xyz, 0.0)).xyz);
    v_texcoord = (p3d_TextureMatrix * vec4(p3d_MultiTexCoord0, 0, 1)).xy;

    for (int i = 0; i < p3d_LightSource.length(); ++i) {
        v_shadow_pos[i] = p3d_LightSource[i].shadowViewMatrix * vert_pos4;
    }

    vec3 tangent = normalize(vec3(p3d_ModelViewMatrix * vec4(p3d_Tangent.xyz, 0.0)));
    vec3 bitangent = cross(normal, tangent) * p3d_Tangent.w;
    v_tbn = mat3(
        tangent,
        bitangent,
        normal
    );

    gl_Position = p3d_ProjectionMatrix * vert_pos4;
}

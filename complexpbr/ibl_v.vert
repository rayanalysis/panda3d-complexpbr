#version 430

#ifndef MAX_LIGHTS
    #define MAX_LIGHTS 20
#endif

uniform mat4 p3d_ProjectionMatrix;
uniform mat4 p3d_ModelViewMatrix;
uniform mat3 p3d_NormalMatrix;
uniform mat4 p3d_TextureMatrix;
uniform mat4 p3d_ModelMatrix;

// skinning
uniform mat4 p3d_TransformTable[100];
in vec4 transform_weight;
in vec4 transform_index;

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

void main() {
    mat4 skin_matrix = (
        p3d_TransformTable[int(transform_index.x)] * transform_weight.x +
        p3d_TransformTable[int(transform_index.y)] * transform_weight.y +
        p3d_TransformTable[int(transform_index.z)] * transform_weight.z +
        p3d_TransformTable[int(transform_index.w)] * transform_weight.w);

    vec3 normal = normalize(p3d_NormalMatrix * (skin_matrix * vec4(p3d_Normal.xyz, 0.0)).xyz);
    vec3 tangent = normalize(p3d_NormalMatrix * (skin_matrix * vec4(p3d_Tangent.xyz, 0.0)).xyz);
    vec3 bitangent = cross(normal, tangent) * p3d_Tangent.w;
    v_tbn = mat3(tangent, bitangent, normal);

    v_color = p3d_Color;
    v_texcoord = (p3d_TextureMatrix * vec4(p3d_MultiTexCoord0, 0.0, 1.0)).xy;
    float displacement = texture(displacement_map, v_texcoord).r * displacement_scale;
    vec4 displaced_vertex = skin_matrix * p3d_Vertex + vec4(normal, 0.0) * displacement;
    vec4 model_view_displaced_vertex = p3d_ModelViewMatrix * displaced_vertex;
    v_position = vec3(model_view_displaced_vertex);

    for (int i = 0; i < p3d_LightSource.length(); ++i) {
        v_shadow_pos[i] = p3d_LightSource[i].shadowViewMatrix * model_view_displaced_vertex;
    }

    gl_Position = p3d_ProjectionMatrix * model_view_displaced_vertex;
}

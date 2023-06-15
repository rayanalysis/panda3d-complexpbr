#version 430

uniform mat4 p3d_ModelViewProjectionMatrix;

uniform mat4 p3d_ProjectionMatrix;
uniform mat4 p3d_ModelViewMatrix;

in vec4 p3d_Vertex;
in vec2 p3d_MultiTexCoord0;
in vec3 p3d_Normal;
in vec4 p3d_Tangent;

out vec2 texcoord;
out vec3 tbn_tangent;
out vec3 tbn_bitangent;
out vec3 tbn_normal;
out vec3 vertex_pos_view;

void main() {
    vec3 normal = normalize(mat3(p3d_ModelViewMatrix) * p3d_Normal);
    vec3 tangent = normalize(mat3(p3d_ModelViewMatrix) * p3d_Tangent.xyz);
    vec3 bitangent = cross(normal, tangent) * p3d_Tangent.w;
    mat3 tbn_matrix = mat3(tangent, bitangent, normal);

    vec4 current_vertex = p3d_ModelViewMatrix * p3d_Vertex;
    vertex_pos_view = current_vertex.xyz / current_vertex.w;
    texcoord = p3d_MultiTexCoord0;
    
    tbn_tangent = tbn_matrix[0];
    tbn_bitangent = tbn_matrix[1];
    tbn_normal = tbn_matrix[2];

    gl_Position = p3d_ModelViewProjectionMatrix * p3d_Vertex;
}
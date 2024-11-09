#version 430

#ifndef MAX_LIGHTS
    #define MAX_LIGHTS 20
#endif

uniform sampler2D p3d_Texture0;
uniform sampler2D p3d_Texture1;
uniform sampler2D p3d_Texture2;
uniform sampler2D p3d_Texture3;
uniform samplerCube cubemaptex;
uniform sampler2D brdfLUT;
// layout(rgba32f) uniform image2D outputNormalNorm;
layout(location=1) out vec3 outputNormal;

in vec3 v_position;
in vec4 v_color;
in mat3 v_tbn;
in vec2 v_texcoord;

in vec4 v_shadow_pos[MAX_LIGHTS];

uniform float ao;
uniform float specular_factor;
uniform float shadow_boost;

const float LIGHT_CUTOFF = 0.001;
const float SPOTSMOOTH = 0.1;

out vec4 o_color;

const float PI = 3.14159265359;

uniform struct p3d_MaterialParameters {
    vec4 baseColor;
    vec4 emission;
    float roughness;
    float metallic;
} p3d_Material;

vec3 fresnelSchlick(float cosTheta, vec3 F0)
{
    return F0 + (1.0 - F0) * pow(1.0 - cosTheta, 5.0);
}

float DistributionGGX(vec3 N, vec3 H, float roughness)
{
    float a = roughness * roughness;
    float a2 = a * a;
    float NdotH = max(dot(N, H), 0.0);
    float NdotH2 = NdotH * NdotH;

    float num = a2;
    float denom = (NdotH2 * (a2 - 1.0) + 1.0);
    denom = PI * denom * denom;

    return num / denom;
}

float GeometrySchlickGGX(float NdotV, float roughness)
{
    float r = (roughness + 1.0);
    float k = (r * r) / 8.0;

    float num = NdotV;
    float denom = NdotV * (1.0 - k) + k;

    return num / denom;
}

float GeometrySmith(vec3 N, vec3 V, vec3 L, float roughness)
{
    float NdotV = max(dot(N, V), 0.0);
    float NdotL = max(dot(N, L), 0.0);
    float ggx2 = GeometrySchlickGGX(NdotV, roughness);
    float ggx1 = GeometrySchlickGGX(NdotL, roughness);

    return ggx1 * ggx2;
}

vec3 getIBL(vec3 N, vec3 V, vec3 F0, vec3 diffuse_color, float roughness)
{
    vec3 R = reflect(-V, N);
    vec3 kS = fresnelSchlick(max(dot(N, V), 0.0), F0);
    vec3 kD = vec3(1.0) - kS;

    vec3 irradiance = texture(cubemaptex, N).rgb;
    vec3 diffuse = irradiance * diffuse_color;

    const float MAX_REFLECTION_LOD = 4.0;
    vec3 prefilteredColor = vec3(0.0);
    if (roughness < 0.7) 
        prefilteredColor = textureLod(cubemaptex, R, roughness * MAX_REFLECTION_LOD).rgb;
    else if (roughness >= 0.7)
        if (roughness < 0.99)
            prefilteredColor = textureLod(cubemaptex, R, roughness * MAX_REFLECTION_LOD).rgb * vec3(0.04);
    else if (roughness >= 0.99) 
        prefilteredColor = prefilteredColor;
    vec2 brdf = texture(brdfLUT, vec2(max(dot(N, V), 0.0), roughness)).rg;
    vec3 specular = prefilteredColor * (kS * brdf.x + brdf.y);
    vec3 ao_final = (kD * diffuse + specular) * ao;

    return (ao_final * (specular * specular_factor));
}

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

uniform struct p3d_LightModelParameters {
    vec4 ambient;
} p3d_LightModel;

uniform vec4 p3d_ColorScale;

struct FunctionParameters {
    float n_dot_l;
    float n_dot_v;
    float n_dot_h;
    float l_dot_h;
    float v_dot_h;
    float roughness;
    float metallic;
    vec3 reflection0;
    vec3 diffuse_color;
    vec3 specular_color;
};

// Smith GGX with fast sqrt approximation (see https://google.github.io/filament/Filament.md.html#materialsystem/specularbrdf/geometricshadowing(specularg))
float visibility_occlusion(FunctionParameters func_params) {
    float r = func_params.roughness;
    float r2 = r * r;
    float n_dot_l = func_params.n_dot_l;
    float n_dot_v = func_params.n_dot_v;
    float ggxv = n_dot_l * (n_dot_v * (1.0 - r) + r);
    float ggxl = n_dot_v * (n_dot_l * (1.0 - r) + r);
    return max(0.0, 0.5 / (ggxv + ggxl));
}

// GGX/Trowbridge-Reitz
float microfacet_distribution(FunctionParameters func_params) {
    float roughness2 = func_params.roughness * func_params.roughness;
    float f = (func_params.n_dot_h * func_params.n_dot_h) * (roughness2 - 1.0) + 1.0;
    return roughness2 / (PI * f * f);
}

// Lambert
float diffuse_function(FunctionParameters func_params) {
    return 1.0 / PI;
}

float normal_blur(in float x, in float sig)
{
    return 0.3989*exp(-0.5*x*x/(sig*sig))/sig;
}

void main()
{
    vec3 N = normalize(v_tbn * (2.0 * texture(p3d_Texture2, v_texcoord).rgb - 1.0));
    // vec3 N = normalize((2.0 * texture(p3d_Texture2, v_texcoord).rgb - 1.0));
    vec3 V = normalize(-v_position);

    // sample the albedo texture
    vec4 albedo = p3d_Material.baseColor * v_color * p3d_ColorScale * texture(p3d_Texture0, v_texcoord);

    // sample the metal-rough texture
    vec4 metalRough = texture(p3d_Texture1, v_texcoord);
    float metallic = clamp(p3d_Material.metallic * metalRough.b, 0.0, 1.0);
    float roughness = clamp(p3d_Material.roughness * metalRough.g,  0.0, 1.0);
    
    // sample the emission texture
    vec3 emission = p3d_Material.emission.rgb * texture(p3d_Texture3, v_texcoord).rgb;

    vec3 F0 = vec3(0.04);
    F0 = mix(F0, albedo.rgb, metallic);

    vec3 diffuse_color = (albedo.rgb * (vec3(1.0) - F0)) * (1.0 - metallic);
    vec3 spec_color = F0;

    // vec3 color = vec3(0.0);
    vec4 color = vec4(vec3(0.0), albedo.a);

    // compute the direct lighting from light sources
    for (int i = 0; i < MAX_LIGHTS; ++i) {
        vec3 lightcol = p3d_LightSource[i].diffuse.rgb;

        if (dot(lightcol, lightcol) < LIGHT_CUTOFF) {
            continue;
        }

        vec3 light_pos = p3d_LightSource[i].position.xyz - v_position * p3d_LightSource[i].position.w;
        vec3 l = normalize(light_pos);
        vec3 h = normalize(l + V);
        float dist = length(light_pos);
        vec3 att_const = p3d_LightSource[i].attenuation;
        float attenuation_factor = 1.0 / (att_const.x + att_const.y + att_const.z * dist * dist);
        float spotcos = dot(normalize(p3d_LightSource[i].spotDirection), -l);
        float spotcutoff = p3d_LightSource[i].spotCosCutoff;
        float shadowSpot = smoothstep(spotcutoff-SPOTSMOOTH, spotcutoff+SPOTSMOOTH, spotcos);

        float shadowCaster = textureProj(p3d_LightSource[i].shadowMap, v_shadow_pos[i]);
        float shadow = shadowSpot * shadowCaster * attenuation_factor;

        FunctionParameters func_params;
        func_params.n_dot_l = clamp(dot(N, l), 0.0, 1.0);
        func_params.n_dot_v = clamp(abs(dot(N, V)), 0.0, 1.0);
        func_params.n_dot_h = clamp(dot(N, h), 0.0, 1.0);
        func_params.l_dot_h = clamp(dot(l, h), 0.0, 1.0);
        func_params.v_dot_h = clamp(dot(V, h), 0.0, 1.0);
        func_params.roughness = roughness;
        func_params.metallic =  metallic;
        func_params.reflection0 = spec_color;
        func_params.diffuse_color = diffuse_color;
        func_params.specular_color = spec_color;

        float V = visibility_occlusion(func_params); // V = G / (4 * n_dot_l * n_dot_v)
        float D = microfacet_distribution(func_params);

        vec3 diffuse_contrib = (diffuse_color * p3d_LightModel.ambient.rgb) * diffuse_function(func_params);
        vec3 spec_contrib = vec3(F0 * V * D);
        color.rgb += func_params.n_dot_l * lightcol * (diffuse_contrib + spec_contrib) * shadow;
        color.rgb += albedo.rgb * shadow_boost; // node-level shadow boost heuristic
    }
    
    vec3 ibl = getIBL(N, V, F0, diffuse_color, roughness);
    o_color = vec4(ibl + emission + color.rgb, color.a);
    // o_color = vec4(v_tbn * texture(p3d_Texture2, v_texcoord).rgb, 1)
    // o_color = vec4(v_tbn, 1);
    // o_color = vec4(N, color.a);
    // send the normal texture to post
    // imageStore(outputNormalNorm, coord, vec4(texture(p3d_Texture2, v_texcoord).rgb * 0.5 + vec3(0.5),1));
    outputNormal = texture(p3d_Texture2, v_texcoord).rgb * 0.5 + vec3(0.5);
    // outputNormal = N * 0.5 + vec3(0.5);
    // outputNormal = N;
}

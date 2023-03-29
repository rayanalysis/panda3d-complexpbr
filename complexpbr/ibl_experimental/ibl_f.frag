#version 330 core

#ifndef MAX_LIGHTS
    #define MAX_LIGHTS 5
#endif

uniform sampler2D p3d_Texture0;
uniform sampler2D p3d_Texture1;
uniform sampler2D p3d_Texture2;
uniform sampler2D p3d_Texture3;
uniform samplerCube cubemaptex;
uniform sampler2D brdfLUT;

in vec3 v_position;
in vec4 v_color;
in mat3 v_tbn;
in vec2 v_texcoord;

in vec4 v_shadow_pos[MAX_LIGHTS];

uniform vec3 camPos;
uniform float ao;

const float LIGHT_CUTOFF = 0.001;
const float SPOTSMOOTH = 0.1;

out vec4 o_color;

const float PI = 3.14159265359;

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

vec3 getIBL(vec3 N, vec3 V, vec3 F0)
{
    vec3 R = reflect(-V, N);
    vec3 kS = fresnelSchlick(max(dot(N, V), 0.0), F0);
    vec3 kD = vec3(1.0) - kS;

    vec3 irradiance = texture(cubemaptex, N).rgb;
    vec3 diffuse = irradiance * diffuse_color;

    const float MAX_REFLECTION_LOD = 4.0;
    vec3 prefilteredColor = textureLod(cubemaptex, R, roughness * MAX_REFLECTION_LOD).rgb;
    vec2 brdf = texture(brdfLUT, vec2(max(dot(N, V), 0.0), roughness)).rg;
    vec3 specular = prefilteredColor * (kS * brdf.x + brdf.y);

    return (kD * diffuse + specular) * ao;
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

// Schlick's Fresnel approximation with Spherical Gaussian approximation to replace the power
vec3 specular_reflection(FunctionParameters func_params) {
    vec3 f0 = func_params.reflection0;
    float v_dot_h= func_params.v_dot_h;
    return f0 + (1 - f0) * pow(2, (-5.55473 * v_dot_h - 6.98316) * v_dot_h);
}

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

void main()
{
    vec3 N = normalize(v_tbn * texture(p3d_Texture2, v_texcoord).rgb * 2.0 - 1.0);
    vec3 V = normalize(camPos - v_position);

    // Sample the albedo texture
    vec3 albedo = texture(p3d_Texture0, v_texcoord).rgb;

    // Sample the metal-rough texture
    vec2 metalRough = texture(p3d_Texture1, v_texcoord).rg;
    float metallic = metalRough.r;
    float roughness = metalRough.g;

    vec3 F0 = vec3(0.04);
    F0 = mix(F0, albedo, metallic);

    vec3 diffuse_color = albedo;
    vec3 spec_color = F0;

    vec3 color = vec3(0.0);

    // Compute the direct lighting from light sources
    for (int i = 0; i < p3d_LightSource.length(); ++i) {
        vec3 lightcol = p3d_LightSource[i].diffuse.rgb;

        if (dot(lightcol, lightcol) < LIGHT_CUTOFF) {
            continue;
        }

        vec3 light_pos = p3d_LightSource[i].position.xyz - v_position * p3d_LightSource[i].position.w;
        vec3 l = normalize(light_pos);
        vec3 h = normalize(l + v);
        float dist = length(light_pos);
        vec3 att_const = p3d_LightSource[i].attenuation;
        float attenuation_factor = 1.0 / (att_const.x + att_const.y + att_const.z * dist);
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
		
		// vec4 env_map_rough = env_map * alpha_roughness;

        vec3 F = specular_reflection(func_params);
        float V = visibility_occlusion(func_params); // V = G / (4 * n_dot_l * n_dot_v)
        float D = microfacet_distribution(func_params);

        vec3 diffuse_contrib = (diffuse_color) * diffuse_function(func_params);
        vec3 spec_contrib = vec3(F * V * D);
        color.rgb += func_params.n_dot_l * lightcol * (diffuse_contrib + spec_contrib) * shadow;
    }

    vec3 ibl = getIBL(N, V, F0);
    
    // Sample the emission texture
    vec3 emission = texture(p3d_Texture3, v_texcoord).rgb;

    o_color = vec4(ibl + emission + color, 1.0);
}
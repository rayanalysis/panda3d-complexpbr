#version 430

uniform sampler2D scene_tex;  // albedo
uniform sampler2D depth_tex;  // depth
uniform sampler2D normal_tex;  // normal
uniform vec2 window_size;
uniform mat4 p3d_ViewMatrix;
uniform mat4 p3d_ProjectionMatrixInverse;

// SSAO parameters with default values
const float radius = 0.5;
const float bias = 0.025;

// Bloom
uniform float bloom_intensity;
uniform float bloom_threshold;
uniform int bloom_blur_width;
uniform int bloom_samples;

// SSR
uniform float ssr_intensity;
uniform float ssr_step;
uniform float ssr_fresnel_pow;
uniform int ssr_samples;

// SSAO
uniform int ssao_samples;

// HSV
uniform float hsv_r = 1.0;
uniform float hsv_g = 1.0;
uniform float hsv_b = 1.0;

// camera
uniform float cameraNear;
uniform float cameraFar;

// screenspace-level global reflection intensity
uniform float reflection_threshold;

in vec2 texcoord;
in vec3 tbn_tangent;
in vec3 tbn_bitangent;
in vec3 tbn_normal;
in vec3 vertex_pos_view;

out vec4 o_color;

mat3 vx = mat3(
    1.,2.,1.,
    0.,0.,0.,
    -1.,-2.,-1.
);

mat3 vy = mat3(
    1.,0.,-1.,
    2.,0.,0.,
    -1.,-2.,-1.
);

float hash(float n)
{
    return fract(sin(n) * 43758.5453);
}

vec3 randomSample(int i, vec2 uv)
{
    float r1 = hash(float(i) + 1.0 + uv.x * uv.y * 1000.0);
    float r2 = hash(float(i) + 21.0 + uv.y * uv.x * 1000.0);

    float phi = 2.0 * 3.14159265 * r1;
    float cosTheta = 1.0 - r2;
    float sinTheta = sqrt(1.0 - cosTheta * cosTheta);

    return vec3(cos(phi) * sinTheta, sin(phi) * sinTheta, cosTheta);
}

float normalBlur(in float x, in float sig)
{
    return 0.3989*exp(-0.5*x*x/(sig*sig))/sig;
}

float luminance(vec3 color)
{
    return dot(color, vec3(0.299, 0.587, 0.114));
}

struct SSRout {
    vec3 color;
    float intensity;
};

SSRout screenSpaceReflection(vec2 uv, float linearDepth, vec3 normal)
{
    vec3 viewPos = vec3(uv, linearDepth);
    viewPos = (p3d_ProjectionMatrixInverse * vec4(viewPos, 1.0)).xyz;
    vec3 reflect_color = vec3(0.0);

    vec3 reflectedRay = reflect(normalize(viewPos), normal);
    vec3 screenSpaceRay = (p3d_ProjectionMatrixInverse * vec4(reflectedRay, 0.0)).xyz;
    screenSpaceRay.xy /= screenSpaceRay.z;
    screenSpaceRay.x = 0.0;

    float ssr_step = 0.75;
    vec2 rayStep = screenSpaceRay.xy * ssr_step;
    vec2 rayPosition = uv;

    for (int i = 0; i < ssr_samples; i++)
    {
        rayPosition -= rayStep;
        rayPosition = clamp(rayPosition, vec2(0.0), vec2(1.0));

        float depth = 1.0 - texture(depth_tex, rayPosition).r + 0.5;
        vec3 position = vec3(rayPosition * 2.0 - 1.0, depth);
        position = (p3d_ProjectionMatrixInverse * vec4(position, 1.0)).xyz;

        if (abs(viewPos.z - position.z) < ssr_step)
        {
            float fresnel = pow(1.0 - dot(normal, normalize(viewPos)), ssr_fresnel_pow);
            vec3 color = texture(scene_tex, rayPosition).rgb;
            reflect_color = mix(reflect_color, color, fresnel);
        }
    }

    SSRout result;
    result.color = reflect_color;
    result.intensity = ssr_intensity;
    return result;
}

float ssao(in vec2 uv, in vec3 viewPos, in vec3 viewNormal)
{
    float occlusion = 0.0;
    float sampleDepth;

    for (int i = 0; i < ssao_samples; ++i)
    {
        vec3 randomSampleVec = randomSample(i, uv);
        vec3 samplePosOffset = radius * (viewNormal * randomSampleVec.z + vec3(randomSampleVec.xy * vec2(radius), 0.0));
        vec3 ao_sample = viewPos + samplePosOffset;
        vec4 samplePos = p3d_ProjectionMatrixInverse * vec4(ao_sample, 1.0);
        samplePos.xyz /= samplePos.w;
        samplePos.xy = (samplePos.xy * 0.5 + 0.5) * window_size;

        sampleDepth = texture(depth_tex, samplePos.xy / window_size).r;

        float rangeCheck = smoothstep(0.0, 1.0, radius / abs(viewPos.z - sampleDepth));
        occlusion += (sampleDepth <= samplePos.z + bias ? 1.0 : 0.0) * rangeCheck;
    }

    return 1.0 - occlusion / 16.0;
}

vec3 getViewPos(vec2 uv, float depth)
{
    vec3 viewPos = vec3(uv * 2.0 - 1.0, depth);
    vec4 worldPos = p3d_ProjectionMatrixInverse * vec4(viewPos, 1.0);
    worldPos.xyz = worldPos.xyz * 0.0011;
    return worldPos.xyz / worldPos.w;
}

mat3 getNormalMatrix(mat4 viewMatrix) 
{
    return transpose(inverse(mat3(viewMatrix)));
}

vec3 transformNormalToViewSpace(vec3 tangentSpaceNormal) 
{
    return normalize(getNormalMatrix(p3d_ViewMatrix) * tangentSpaceNormal);
}

vec3 getViewNormal(vec3 tbn_tangent, vec3 tbn_bitangent, vec3 tbn_normal) 
{
    vec3 normalTex = texture(normal_tex, texcoord).rgb * 2.0 - 1.0;
    vec3 tangentSpaceNormal = normalize(tbn_tangent * normalTex.x + tbn_bitangent * normalTex.y + tbn_normal * normalTex.z);

    return normalize(transformNormalToViewSpace(tangentSpaceNormal));
}

vec3 rgb2hsv(vec3 c) {
    vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
    
    float d = q.x - min(q.w, q.y);
    float e = 1.0e-10;
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

float brightness(vec3 color)
{
    const vec3 W = vec3(0.2126, 0.7152, 0.0722);
    return dot(color, W);
}

vec3 bloomAA(vec3 color, vec2 uv)
{
    vec3 bloom = vec3(0.0);
    vec3 aa_contrib = vec3(0.0);
    vec2 texelSize = 1.0 / window_size;
    int aaBlurWidth = 10;
    float totalBlurWeight = 0.0;

    if (bloom_intensity > 0)
    {
        for (int i = -bloom_samples; i <= bloom_samples; ++i)
        {
            for (int j = -bloom_samples; j <= bloom_samples; ++j)
            {
                vec2 offset = vec2(i, j) * texelSize;
                vec3 bloom_sample = texture(scene_tex, uv + offset).rgb;

                float brightness_value = brightness(bloom_sample);
                float intensity = brightness_value > bloom_threshold ? brightness_value : 0.0;
                float blur = normalBlur(length(offset), bloom_blur_width);
                bloom += bloom_sample * intensity * bloom_intensity * blur;
                totalBlurWeight += blur;
            }
        }

        // normalize bloom effect
        bloom /= totalBlurWeight;
    }
    
    // AA loop
    mat3 Inter;
    
    for (int i = 0; i < 3; i++)
    {
        for (int j = 0; j < 3; j++)
        {
            vec2 offset = (vec2(i - 1, j - 1) * texelSize);
            vec3 aa_sample = texture(scene_tex, uv + offset).rgb;
            Inter[i][j] = length(aa_sample);
        }
    }

    // calculate AA response
    float fx = dot(vx[0], Inter[0]) + dot(vx[1], Inter[1]) + dot(vx[2], Inter[2]);
    float fy = dot(vy[0], Inter[0]) + dot(vy[1], Inter[1]) + dot(vy[2], Inter[2]);
    float fo = sqrt(pow(fx, 2.) + pow(fy, 2.));
    fo = smoothstep(0.1, 0.7, fo);

    float kern[11];
    for (int w = 0; w <= 5; w++) {
        kern[5 + w] = kern[5 - w] = normalBlur(float(w), aaBlurWidth);
    }

    for (int i = 0; i <= 5; i++) {
        for (int z = 0; z <= 5; z++) {
            aa_contrib += kern[5 + z] * kern[5 + i] * texture(scene_tex, (uv + (vec2(float(i), float(z)) * texelSize))).rgb * vec3(fo);
        }
    }

    // combine bloom and AA contributions
    vec3 combined = color + bloom + aa_contrib;

    return combined;
}

void main() {
    vec3 color = texture(scene_tex, texcoord).rgb;
    vec4 depth = texture(depth_tex, texcoord);
    float depth_fl = 1.0 - depth.r + 0.5;
    vec3 viewPos = getViewPos(texcoord, depth_fl);
    vec3 worldNormal = getViewNormal(tbn_tangent, tbn_bitangent, tbn_normal);
    vec3 viewNormal = transformNormalToViewSpace(worldNormal);

    SSRout ssrOut = screenSpaceReflection(texcoord, depth_fl, viewNormal);
    // blend the object color with the reflection color based on the intensity
    color = mix(color, ssrOut.color, max(ssrOut.intensity - reflection_threshold, 0.0));

    // apply SSAO to the final color
    float occlusion = ssao(texcoord, viewPos, viewNormal);
    color *= occlusion;

    o_color = vec4(bloomAA(color, texcoord), 1.0);
    // o_color = vec4(occlusion, 0, 0, 1.0);

    vec3 hsvColor = rgb2hsv(color);
    hsvColor *= vec3(hsv_r, hsv_g, hsv_b);
    color = hsv2rgb(hsvColor);
}

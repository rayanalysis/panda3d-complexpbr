#version 430
#extension GL_ARB_bindless_texture : require

uniform sampler2D scene_tex;  // albedo
uniform sampler2D depth_tex;  // depth
uniform sampler2D normal_tex;  // normal
uniform vec2 window_size;
uniform mat4 p3d_ViewMatrix;
uniform mat4 p3d_ProjectionMatrixInverse;

uniform samplerBuffer myTBO;
// SSAO parameters with default values
const float radius = 0.5;
const float bias = 0.025;

uniform float cameraNear;
uniform float cameraFar;

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

in vec2 texcoord;

out vec4 o_color;

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

float normal_blur(in float x, in float sig)
{
    return 0.3989*exp(-0.5*x*x/(sig*sig))/sig;
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
    float reflect_intensity = 0.5;

    vec3 reflectedRay = reflect(normalize(viewPos), normal);
    vec3 screenSpaceRay = (p3d_ProjectionMatrixInverse * vec4(reflectedRay, 0.0)).xyz;
    screenSpaceRay.xy /= screenSpaceRay.z;

    float stepSize = 0.5;
    vec2 rayStep = screenSpaceRay.xy * stepSize;
    vec2 rayPosition = uv;

    for (int i = 0; i < 64; i++)
    {
        rayPosition -= rayStep;
        rayPosition = clamp(rayPosition, vec2(0.0), vec2(1.0));

        float depth = 1.0 - texture(depth_tex, rayPosition).r + 0.5;
        vec3 position = vec3(rayPosition * 2.0 - 1.0, depth);
        position = (p3d_ProjectionMatrixInverse * vec4(position, 1.0)).xyz;

        if (abs(viewPos.z - position.z) < stepSize)
        {
            float fresnel = pow(1.0 - dot(normal, normalize(viewPos)), 5.0);
            vec3 color = texture(scene_tex, rayPosition).rgb;
            reflect_color = mix(reflect_color, color, fresnel);
            reflect_intensity = max(reflect_intensity, fresnel);
        }
    }

    SSRout result;
    result.color = reflect_color;
    result.intensity = reflect_intensity;
    return result;
}

float ssao(in vec2 uv, in vec3 viewPos, in vec3 viewNormal)
{
    float occlusion = 0.0;
    float sampleDepth;

    for (int i = 0; i < 32; ++i)
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
    worldPos.xyz = worldPos.xyz * 0.006;
    return worldPos.xyz / worldPos.w;
    // return viewPos.xyz / worldPos.w;
}

vec3 getViewNormal(vec2 uv)
{
    vec3 normalTex = texture(normal_tex, uv).rgb;
    vec3 viewNormal = normalize(normalTex * 2.0 - 1.0);

    return viewNormal;
}

vec3 transformNormalToViewSpace(vec3 worldNormal)
{
    mat3 normalMatrix = transpose(inverse(mat3(p3d_ViewMatrix)));
    return normalMatrix * worldNormal;
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

void main() {
    vec3 color = texture(scene_tex, texcoord).rgb;
    vec4 depth = texture(depth_tex, texcoord);
    float depth_fl = 1.0 - depth.r + 0.5;
    vec3 viewPos = getViewPos(texcoord, depth_fl);
    vec3 worldNormal = getViewNormal(texcoord);
    vec3 viewNormal = transformNormalToViewSpace(worldNormal);

    SSRout ssrOut = screenSpaceReflection(texcoord, depth_fl, viewNormal);
    float reflectionThreshold = 0.4;
    // blend the object color with the reflection color based on the intensity
    color = mix(color, ssrOut.color, max(ssrOut.intensity - reflectionThreshold, 0.0));
    
    float saturationBoost = 1.3; // adjust this value to control the saturation boost
    vec3 hsvColor = rgb2hsv(color);
    hsvColor.g *= saturationBoost;
    color = hsv2rgb(hsvColor);

    // apply SSAO to the final color
    float occlusion = ssao(texcoord, viewPos, viewNormal);
    color *= occlusion;

    mat3 Inter;

    vec2 texelSize = 1.0 / window_size;

    for (int i = 0; i < 3; i++) {
        for (int j = 0; j < 3; j++) {
            vec3 sobel = texture(scene_tex, texcoord + (vec2(i - 1, j - 1) * texelSize)).rgb;
            Inter[i][j] = length(sobel);
        }
    }

    float kern[11];

    vec3 outer = vec3(0.);
    float sig = 10.;
    float zig = 0.;

    for (int w = 0; w <= 5; w++) {
        kern[5 + w] = kern[5 - w] = normal_blur(float(w), sig);
    }

    for (int i = 0; i < 5; i++) {
        zig += kern[i];
    }

    float fx = dot(vx[0], Inter[0]) + dot(vx[1], Inter[1]) + dot(vx[2], Inter[2]);
    float fy = dot(vy[0], Inter[0]) + dot(vy[1], Inter[1]) + dot(vy[2], Inter[2]);
    float fo = sqrt(pow(fx, 2.) + pow(fy, 2.));
    fo = smoothstep(0.1, 0.7, fo);

    for (int i = 0; i <= 5; i++) {
        for (int z = 0; z <= 5; z++) {
            outer += kern[5 + z] * kern[5 + i] * texture(scene_tex, (texcoord + (vec2(float(i), float(z)) * texelSize))).rgb * vec3(fo);
        }
    }

    o_color = vec4(vec3(color.r + outer.r, color.g + outer.g, color.b + outer.b), 1.);
    o_color = vec4(mix(outer, o_color.rgb, 0.7), 1.);
    // o_color = vec4(depth_fl,0,0, 1);
    // o_color = vec4(occlusion, occlusion, occlusion, 1);
    // o_color = vec4(viewNormal, 1);
    // o_color = vec4(viewPos.z,0,0, 1);
    // o_color = vec4(reflection,1);
}
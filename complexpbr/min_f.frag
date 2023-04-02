#version 330

uniform sampler2D p3d_Texture0;
uniform vec2 window_size;

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

float normal_blur(in float x, in float sig)
{
	return 0.3989*exp(-0.5*x*x/(sig*sig))/sig;
}

void main() {
    vec3 color = texture(p3d_Texture0, texcoord).rgb;
    mat3 Inter;

    vec2 texelSize = 1.0 / window_size;

    for (int i = 0; i < 3; i++) {
        for (int j = 0; j < 3; j++) {
            vec3 sobel = texture(p3d_Texture0, texcoord + (vec2(i - 1, j - 1) * texelSize)).rgb;
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
            outer += kern[5 + z] * kern[5 + i] * texture(p3d_Texture0, (texcoord + (vec2(float(i), float(z)) * texelSize))).rgb * vec3(fo);
        }
    }

    o_color = vec4(vec3(color.r + outer.r, color.g + outer.g, color.b + outer.b), 1.);
    o_color = vec4(mix(outer, o_color.rgb, 0.7), 1.);
}
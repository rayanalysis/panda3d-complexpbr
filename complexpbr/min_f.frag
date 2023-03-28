#version 330

uniform sampler2D p3d_Texture0;

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
	return 0.3989*exp(-.5*x*x/(sig*sig))/sig;
}

void main() {
  vec3 color = texture(p3d_Texture0, texcoord).rgb;
  mat3 Inter;
  for (int i=0;i<3;i++) {
	  for (int j=0;j<3;j++) {
		  vec3 sobel = texelFetch(p3d_Texture0,ivec2(gl_FragCoord) + ivec2(i-1,j-1),0).rgb;
		  Inter[i][j] = length(sobel);
	  }
  }
  float kern[10];
  
  vec3 outer = vec3(0.);
  // kernel
  float sig = 10.;
  float zig = 0.;
  
  for (int w=0;w<=10;w++) 
  {
	  kern[10+w] = kern[10-w] = normal_blur(float(w),sig);
  }
  
  for (int i=0;i<10;i++) 
  {
	  zig += kern[i];
  }
  
  float fx = dot(vx[0],Inter[0]) + dot(vx[1],Inter[1]) + dot(vx[2],Inter[2]);
  float fy = dot(vy[0],Inter[0]) + dot(vy[1],Inter[1]) + dot(vy[2],Inter[2]);
  float fo = sqrt(pow(fx,2.)+pow(fy,2.));
  fo = smoothstep(.1,.7,fo);
  
  for (int i=0;i<=10;i++)
  {
	  for (int z=0;z<=10;z++)
	  {
	      outer += kern[10+z]*kern[10+i]*texture(p3d_Texture0,(vec2(gl_FragCoord)+vec2(float(i),float(z))) / vec2(1920,1080)).rgb*vec3(fo);
	  }
  }
  
  o_color = vec4(vec3(color.r+outer.r,color.g+outer.g,color.b+outer.b),1.);
  // o_color = vec4(mix(outer/(zig*zig),color,.7),1.);
  o_color = vec4(mix(outer,o_color.rgb,.7),1.);
  // o_color = sqrt(o_color);
}

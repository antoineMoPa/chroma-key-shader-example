const canvas = document.getElementById('glcanvas');
const gl = canvas.getContext('webgl');

// Resize canvas to fit the window
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  gl.viewport(0, 0, canvas.width, canvas.height);
}

window.addEventListener('resize', resize);
resize();

// Vertex shader
const vertexShaderSrc = `
attribute vec2 a_position;
varying vec2 v_texCoord;
void main() {
  v_texCoord = vec2(a_position.x * 0.5 + 0.5, 1.0 - (a_position.y * 0.5 + 0.5));
  gl_Position = vec4(a_position, 0, 1);
}`;

const fragmentShaderSrc = `
precision mediump float;
uniform sampler2D u_video;
varying vec2 v_texCoord;
uniform vec4 u_chromaKey; // chroma key color rgba (green screen default)
const float similarity = 0.4;
const float smoothness = 0.1;
void main() {
  vec4 color = texture2D(u_video, v_texCoord);
  float Y1 = 0.299 * u_chromaKey.r + 0.587 * u_chromaKey.g + 0.114 * u_chromaKey.b;
  float Y2 = 0.299 * color.r + 0.587 * color.g + 0.114 * color.b;
  float Cr1 = u_chromaKey.r - Y1;
  float Cb1 = u_chromaKey.b - Y1;
  float Cr2 = color.r - Y2;
  float Cb2 = color.b - Y2;
  float blend = smoothstep(similarity, similarity + smoothness, distance(vec2(Cr1, Cb1), vec2(Cr2, Cb2)));
  gl_FragColor = vec4(color.rgb, color.a * blend);
}`;

function createShader(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Shader compile failed', gl.getShaderInfoLog(shader));
  }
  return shader;
}

function createProgram(vsSource, fsSource) {
  const vertexShader = createShader(gl.VERTEX_SHADER, vsSource);
  const fragmentShader = createShader(gl.FRAGMENT_SHADER, fsSource);
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Program link failed', gl.getProgramInfoLog(program));
  }
  return program;
}

const program = createProgram(vertexShaderSrc, fragmentShaderSrc);
gl.useProgram(program);

const positionLoc = gl.getAttribLocation(program, 'a_position');
const chromaKeyLoc = gl.getUniformLocation(program, 'u_chromaKey');
const videoLoc = gl.getUniformLocation(program, 'u_video');

gl.uniform1i(videoLoc, 0); // texture unit 0

const positionBuffer = gl.createBuffer();
gl.enableVertexAttribArray(positionLoc);

let videoAspectRatio = 1;

function updateQuadVertices() {
  const canvasAspect = canvas.width / canvas.height;

  let scaleX = 1;
  let scaleY = 1;

  if (canvasAspect > videoAspectRatio) {
    scaleX = videoAspectRatio / canvasAspect;
  } else {
    scaleY = canvasAspect / videoAspectRatio;
  }

  const positions = new Float32Array([
    -scaleX, -scaleY,
     scaleX, -scaleY,
    -scaleX,  scaleY,
    -scaleX,  scaleY,
     scaleX, -scaleY,
     scaleX,  scaleY
  ]);

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

  gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);
}

const video = document.createElement('video');
video.autoplay = true;
video.loop = true;
video.muted = true;
video.src = 'http://localhost:3333/example.mp4';

video.addEventListener('loadedmetadata', () => {
  videoAspectRatio = video.videoWidth / video.videoHeight;
  updateQuadVertices();
});

window.addEventListener('resize', () => {
  resize();
  updateQuadVertices();
});

resize();
updateQuadVertices();

const chromaKeyColor = [0.0, 1.0, 0.0, 1.0];
gl.uniform4fv(chromaKeyLoc, chromaKeyColor);

const videoTexture = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, videoTexture);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

function render() {
  if (video.readyState >= video.HAVE_CURRENT_DATA) {
    gl.bindTexture(gl.TEXTURE_2D, videoTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
  }

  gl.drawArrays(gl.TRIANGLES, 0, 6);
  requestAnimationFrame(render);
}
requestAnimationFrame(render);

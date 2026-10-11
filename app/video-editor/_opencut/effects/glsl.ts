// =============================================================================
// Lo común de los shaders de color y efectos (pases `ce-*`, GLSL ES 3.00)
// =============================================================================
// Todos los shaders de effects/definitions arrancan con CABECERA: las entradas
// del contrato de pases-ce.ts más unas funciones que comparten.
//
// EL ESPACIO. Un efecto de CapCut puesto como CAPA (en su pista) afecta a todo
// lo que tiene debajo, o sea a la imagen ya compuesta. Acá no hay imagen
// compuesta en TypeScript (la compone el WASM), así que el pase se reparte a
// cada capa de abajo (services/renderer/compositor/repartir-ce.ts). Para que una
// viñeta, un caleidoscopio o una sacudida queden UNA sola vez sobre el cuadro y
// no una por capa, los shaders trabajan en coordenadas del LIENZO:
//
//   p = ceAEspacio(v_uv)   el punto del lienzo (0..1, y hacia arriba) que cae
//                          en este píxel de la capa;
//   ceMuestra(q)           el color de la capa en el punto q del lienzo
//                          (transparente afuera de la capa).
//
// Las deformaciones conmutan con la composición (deformar cada capa igual y
// componer = componer y deformar), así que el resultado es el de CapCut; las
// operaciones de color también, salvo en los bordes semitransparentes.
//
// Sin reparto (un efecto aplicado A UN CLIP, la miniatura), pases-ce.ts pone el
// espacio identidad: el «lienzo» es la propia capa y p == v_uv.

/** Encabezado de todo shader `ce-*` de color/efecto. */
export const CABECERA = `#version 300 es
precision highp float;
precision highp sampler3D;
uniform sampler2D u_textura;
uniform vec2 u_resolucion;
// Centro y tamaño (con signo: negativo = reflejada) de la capa, en px del
// lienzo con y hacia arriba; su giro (radianes, antihorario) y el lienzo.
uniform vec4 u_capa;
uniform float u_giro;
uniform vec2 u_lienzo;
// Segundos desde el inicio del clip o de la capa del efecto.
uniform float u_tiempo;
in vec2 v_uv;
out vec4 colorSalida;

const float PI = 3.14159265;

vec2 ceAEspacio(vec2 uv) {
  vec2 local = (uv - 0.5) * u_capa.zw;
  float c = cos(u_giro);
  float s = sin(u_giro);
  local = vec2(c * local.x - s * local.y, s * local.x + c * local.y);
  return (u_capa.xy + local) / u_lienzo;
}

vec2 ceACapa(vec2 p) {
  vec2 px = p * u_lienzo - u_capa.xy;
  float c = cos(-u_giro);
  float s = sin(-u_giro);
  px = vec2(c * px.x - s * px.y, s * px.x + c * px.y);
  return px / u_capa.zw + 0.5;
}

vec4 ceMuestraUv(vec2 uv) {
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return vec4(0.0);
  return texture(u_textura, uv);
}

vec4 ceMuestra(vec2 p) {
  return ceMuestraUv(ceACapa(p));
}

// Relación de aspecto del lienzo, para medir distancias redondas.
float ceAspecto() {
  return u_lienzo.x / max(u_lienzo.y, 1.0);
}

float luma(vec3 c) {
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float ruido(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x),
             mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
}

vec3 rgbAHsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 hsvARgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

// Un paso de muestra de 1 px de la textura de la capa, en uv.
vec2 ceTexel() {
  return 1.0 / max(u_resolucion, vec2(1.0));
}

// Un radio medido en fracción del ALTO DEL LIENZO, pasado a uv de la capa: así
// un brillo o un desenfoque se ven del mismo tamaño en una capa chica y en una
// que llena el cuadro.
vec2 ceRadioUv(float fraccionAlto) {
  return vec2(fraccionAlto * u_lienzo.y) / max(abs(u_capa.zw), vec2(1.0));
}
`;

/** Un número de los params (pueden llegar como texto de un proyecto viejo). */
export function num(valor: unknown, porDefecto = 0): number {
	const n = typeof valor === "number" ? valor : Number.parseFloat(String(valor));
	return Number.isFinite(n) ? n : porDefecto;
}

/** El tiempo que inyecta resolve.ts (`__tiempo`, segundos locales). */
export function tiempoDe(params: Record<string, unknown>): number {
	return num(params.__tiempo, 0);
}

/** «#00ff00» → [0, 1, 0]. Un color ilegible da verde (el fondo de croma más común). */
export function hexARgb(hex: unknown): [number, number, number] {
	const limpio = String(hex ?? "").replace(/^#/, "").trim();
	const largo = limpio.length === 3 ? limpio.split("").map((c) => c + c).join("") : limpio.slice(0, 6);
	if (!/^[0-9a-f]{6}$/i.test(largo)) return [0, 1, 0];
	const n = Number.parseInt(largo, 16);
	return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

// =============================================================================
// Los shaders de las transiciones (pases `ce-tr-*`, GLSL ES 3.00)
// =============================================================================
// Cada pase tiene UNA entrada: la capa de un clip (pases-ce.ts no compone dos
// capas; la composición la hace el WASM). Una transición entre dos clips se arma
// entonces con lo que le pasa a cada capa por separado —opacidad y
// transformación desde el gancho visual, y estos pases— y el compositor las
// apila como siempre (el de la derecha arriba). Por eso un barrido o un círculo
// son una MÁSCARA DE ALFA animada sobre el clip que entra, y un fundido a negro
// es cada clip yendo y viniendo del color por su lado.
//
// Todos arrancan con CABECERA (effects/glsl.ts) y no redeclaran sus uniforms
// (lo frena tests/video-editor-color.test.ts, que barre TODOS los registrados).
// Los radios van en fracción del lado corto de la capa: la misma transición se
// ve igual en un 4K que en un 720p. Cada pase manda SIEMPRE todos sus uniforms:
// uno que no se manda hereda el valor de la vuelta anterior (hallazgos).
//
// Lo importan el catálogo (./catalogo.ts) y, por él, el gancho.

import { registrarPase } from "@/app/video-editor/_opencut/services/renderer/pases-ce";
import { CABECERA } from "@/app/video-editor/_opencut/effects/glsl";

export const PASE_COLOR = "ce-tr-color";
export const PASE_DESENFOQUE = "ce-tr-desenfoque";
export const PASE_ZOOM = "ce-tr-zoom";
export const PASE_MASCARA = "ce-tr-mascara";
export const PASE_PIXELADO = "ce-tr-pixelado";
export const PASE_GLITCH = "ce-tr-glitch";

/** Modos de PASE_MASCARA. */
export const MASCARA_BARRIDO = 0;
export const MASCARA_CIRCULO = 1;
export const MASCARA_PERSIANAS = 2;

// Hacia un color (fundido a negro, destello blanco).
registrarPase({
	id: PASE_COLOR,
	fragment: `${CABECERA}
uniform vec3 u_color;
uniform float u_cantidad;
void main() {
  vec4 c = texture(u_textura, v_uv);
  colorSalida = vec4(mix(c.rgb, u_color, clamp(u_cantidad, 0.0, 1.0)), c.a);
}`,
});

// Desenfoque de disco: 48 muestras en espiral (ángulo de oro). Un solo pase,
// porque cada capa lleva uno; en el movimiento de la transición no se ve grano.
registrarPase({
	id: PASE_DESENFOQUE,
	fragment: `${CABECERA}
uniform float u_radio;
void main() {
  float lado = min(u_resolucion.x, u_resolucion.y);
  vec2 radio = vec2(u_radio * lado) / max(u_resolucion, vec2(1.0));
  vec4 suma = vec4(0.0);
  for (int i = 0; i < 48; i++) {
    float fi = float(i);
    float r = sqrt((fi + 0.5) / 48.0);
    float a = fi * 2.39996323;
    suma += texture(u_textura, v_uv + vec2(cos(a), sin(a)) * r * radio);
  }
  colorSalida = suma / 48.0;
}`,
});

// Desenfoque radial (hacia el centro): el movimiento de «Acercar», «Alejar» y «Girar».
registrarPase({
	id: PASE_ZOOM,
	fragment: `${CABECERA}
uniform float u_fuerza;
void main() {
  vec2 dir = v_uv - 0.5;
  vec4 suma = vec4(0.0);
  for (int i = 0; i < 20; i++) {
    float t = float(i) / 19.0;
    suma += texture(u_textura, v_uv - dir * (u_fuerza * 0.3 * t));
  }
  colorSalida = suma / 20.0;
}`,
});

// Máscara de alfa: lo que la capa muestra a medida que avanza `u_progreso`.
//   0 barrido   el borde viaja en `u_direccion`;
//   1 círculo   un círculo redondo (con el aspecto de la capa) desde el centro;
//   2 persianas ocho franjas que se abren en el sentido de `u_direccion`.
// `u_direccion` llega en uv de la CAPA (y hacia arriba), ya llevada desde la
// pantalla por el catálogo (`direccionEnCapa`): con un clip girado puede ser
// diagonal, y entonces la posición se mide contra lo que la capa ocupa en esa
// dirección (`extension`), así el borde arranca y termina justo afuera de ella.
// `u_suavidad` es el ancho del borde (en esa medida o en franja); nunca 0:
// smoothstep con los dos bordes iguales no está definido en GLSL.
registrarPase({
	id: PASE_MASCARA,
	fragment: `${CABECERA}
uniform float u_modo;
uniform float u_progreso;
uniform vec2 u_direccion;
uniform float u_suavidad;
void main() {
  vec4 c = texture(u_textura, v_uv);
  float s = max(u_suavidad, 0.0001);
  float p = clamp(u_progreso, 0.0, 1.0);
  vec2 res = max(u_resolucion, vec2(1.0));
  vec2 d = normalize(u_direccion);
  float extension = max(abs(d.x) * res.x + abs(d.y) * res.y, 1.0);
  float x = dot((v_uv - 0.5) * res, d) / extension;
  float m = 1.0;
  if (u_modo < 0.5) {
    float borde = mix(-0.5 - s, 0.5 + s, p);
    m = 1.0 - smoothstep(borde - s, borde + s, x);
  } else if (u_modo < 1.5) {
    float aspecto = res.x / res.y;
    vec2 q = (v_uv - 0.5) * vec2(aspecto, 1.0);
    float r = p * (length(vec2(aspecto, 1.0) * 0.5) + s);
    m = 1.0 - smoothstep(r - s, r, length(q));
  } else {
    float f = fract((x + 0.5) * 8.0);
    float borde = p * (1.0 + s);
    m = 1.0 - smoothstep(borde - s, borde, f);
  }
  colorSalida = vec4(c.rgb, c.a * m);
}`,
});

// Pixelado: bloques de `u_bloque` (fracción del lado corto).
registrarPase({
	id: PASE_PIXELADO,
	fragment: `${CABECERA}
uniform float u_bloque;
void main() {
  float lado = min(u_resolucion.x, u_resolucion.y);
  float b = max(1.0, u_bloque * lado);
  vec2 px = v_uv * u_resolucion;
  vec2 centro = (floor(px / b) + 0.5) * b;
  colorSalida = texture(u_textura, centro / max(u_resolucion, vec2(1.0)));
}`,
});

// Glitch: franjas corridas y los canales separados. `u_semilla` cambia a saltos
// (no cada cuadro) para que el corte se lea como un fallo de señal y no como ruido.
registrarPase({
	id: PASE_GLITCH,
	fragment: `${CABECERA}
uniform float u_intensidad;
uniform float u_semilla;
void main() {
  float sem = floor(u_semilla);
  float fila = floor(v_uv.y * 18.0);
  float h = hash12(vec2(fila, sem));
  float salta = step(0.55, hash12(vec2(fila * 1.7 + 3.1, sem + 7.0)));
  float dx = (h - 0.5) * 0.18 * u_intensidad * salta;
  vec2 uv = vec2(v_uv.x + dx, v_uv.y);
  float sep = 0.025 * u_intensidad;
  vec4 base = texture(u_textura, uv);
  float r = texture(u_textura, uv + vec2(sep, 0.0)).r;
  float b = texture(u_textura, uv - vec2(sep, 0.0)).b;
  colorSalida = vec4(r, base.g, b, base.a);
}`,
});

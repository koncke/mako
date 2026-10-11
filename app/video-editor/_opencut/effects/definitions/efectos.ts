// =============================================================================
// «Efectos de video» de CapCut, en shaders propios (pases `ce-efecto-*`)
// =============================================================================
// Los efectos de CapCut son paquetes descargados de su servidor (shaders,
// texturas y miniaturas de ByteDance): no se copian. Se escriben de cero los
// que más se usan, con los nombres de parámetro del es-LA.po de CapCut
// (`effects_adjust_*`: Intensidad, Velocidad, Intervalo, Brillo, Textura, Giro,
// Monto, Diferencia cromática horizontal/vertical), todos de 0 a 100.
//
// Cada efecto es un tipo `efecto.<id>` con su shader `ce-efecto-<id>`. Los que
// se mueven leen `u_tiempo` (los segundos que inyecta resolve.ts en
// `__tiempo`). Todos trabajan en el ESPACIO del lienzo (../glsl.ts): puestos
// como capa, el reparto a las capas de abajo da un solo efecto sobre el cuadro.
//
// Las categorías imitan las de CapCut («Tendencias» es una selección, los
// demás están en una sola categoría).

import type { NumberParamDefinition } from "@/app/video-editor/_opencut/params";
import { registrarPase } from "@/app/video-editor/_opencut/services/renderer/pases-ce";
import type { EffectDefinition, EffectUniformValue } from "../types";
import { CABECERA, num, tiempoDe } from "../glsl";

export const PREFIJO_EFECTO = "efecto.";

/** Las categorías de «Efectos de video ▾», en orden. */
export const CATEGORIAS_EFECTO = [
	"Tendencias",
	"Básico",
	"Luz",
	"Retro",
	"Distorsión",
	"Lente",
	"Pantalla dividida",
] as const;
export type CategoriaEfecto = Exclude<(typeof CATEGORIAS_EFECTO)[number], "Tendencias">;

/** Los que aparecen en «Tendencias» (además de su categoría). */
export const TENDENCIAS_EFECTO = [
	"efecto.glitch",
	"efecto.sacudida",
	"efecto.zoom-pulsante",
	"efecto.destello",
	"efecto.vhs",
	"efecto.fuga-de-luz",
	"efecto.bordes-neon",
	"efecto.grano",
];

type Param = { key: string; label: string; default: number };

function p(key: string, label: string, valor: number): Param {
	return { key, label, default: valor };
}

const INTENSIDAD = (v: number) => p("intensidad", "Intensidad", v);
const VELOCIDAD = (v: number) => p("velocidad", "Velocidad", v);

type Receta = {
	id: string;
	nombre: string;
	categoria: CategoriaEfecto;
	palabras?: string[];
	params: Param[];
	animado?: boolean;
	/**
	 * Mueve el contenido o lee lejos (zoom, sacudida, espejo, brillo que se
	 * derrama…): como capa, cada capa de abajo pasa primero a una textura del
	 * tamaño del lienzo (services/renderer/compositor/repartir-ce.ts).
	 */
	desplaza?: boolean;
	/** El cuerpo del shader (después de la CABECERA): uniforms propios + main. */
	glsl: string;
	/** params (0..100) → uniforms. Por defecto, cada param `k` → `u_k` en 0..1. */
	uniforms?: (v: Record<string, number>) => Record<string, EffectUniformValue>;
};

const RECETAS: Receta[] = [
	{
		id: "vineta",
		nombre: "Viñeta",
		categoria: "Básico",
		palabras: ["vignette", "bordes oscuros"],
		params: [INTENSIDAD(60), p("intervalo", "Intervalo", 50)],
		glsl: `
uniform float u_intensidad, u_intervalo;
void main() {
  vec4 c = texture(u_textura, v_uv);
  vec2 p = ceAEspacio(v_uv);
  float r = length((p - 0.5) * 2.0) / 1.4142;
  float inicio = mix(0.8, 0.05, u_intervalo);
  c.rgb *= 1.0 - smoothstep(inicio, inicio + 0.6, r) * u_intensidad;
  colorSalida = c;
}`,
	},
	{
		id: "bn",
		nombre: "Blanco y negro",
		categoria: "Básico",
		palabras: ["bn", "gris", "monocromo"],
		params: [INTENSIDAD(100)],
		glsl: `
uniform float u_intensidad;
void main() {
  vec4 c = texture(u_textura, v_uv);
  vec3 bn = vec3(clamp((luma(c.rgb) - 0.5) * 1.1 + 0.5, 0.0, 1.0));
  colorSalida = vec4(mix(c.rgb, bn, u_intensidad), c.a);
}`,
	},
	{
		id: "zoom-pulsante",
		desplaza: true,
		nombre: "Zoom pulsante",
		categoria: "Básico",
		palabras: ["zoom", "latido", "pulso"],
		animado: true,
		params: [INTENSIDAD(50), VELOCIDAD(50)],
		glsl: `
uniform float u_intensidad, u_velocidad;
void main() {
  vec2 p = ceAEspacio(v_uv);
  float f = mix(0.6, 3.0, u_velocidad);
  float pulso = pow(0.5 + 0.5 * sin(u_tiempo * f * 2.0 * PI - PI * 0.5), 2.0);
  float s = 1.0 + u_intensidad * 0.3 * pulso;
  colorSalida = ceMuestra(0.5 + (p - 0.5) / s);
}`,
	},
	{
		id: "sacudida",
		desplaza: true,
		nombre: "Sacudida",
		categoria: "Básico",
		palabras: ["temblor", "shake", "cámara"],
		animado: true,
		params: [INTENSIDAD(50), VELOCIDAD(50)],
		glsl: `
uniform float u_intensidad, u_velocidad;
void main() {
  vec2 p = ceAEspacio(v_uv);
  float asp = ceAspecto();
  float t = u_tiempo * mix(4.0, 18.0, u_velocidad);
  vec2 sac = vec2(ruido(vec2(t, 0.0)), ruido(vec2(0.0, t + 7.3))) - 0.5;
  float giro = (ruido(vec2(t + 3.1, t * 0.7)) - 0.5) * 0.06 * u_intensidad;
  float amp = 0.06 * u_intensidad;
  vec2 d = (p - 0.5 - sac * amp) * vec2(asp, 1.0);
  float c0 = cos(giro);
  float s0 = sin(giro);
  d = vec2(c0 * d.x - s0 * d.y, s0 * d.x + c0 * d.y) / (1.0 + amp * 1.5);
  colorSalida = ceMuestra(d / vec2(asp, 1.0) + 0.5);
}`,
	},
	{
		id: "resplandor",
		desplaza: true,
		nombre: "Brillo",
		categoria: "Luz",
		palabras: ["glow", "resplandor", "luz"],
		params: [INTENSIDAD(50), p("intervalo", "Intervalo", 50)],
		glsl: `
uniform float u_intensidad, u_intervalo;
vec3 luces(vec2 uv) {
  vec4 c = texture(u_textura, uv);
  return max(c.rgb - 0.55, 0.0) / 0.45 * c.a;
}
void main() {
  vec4 c = texture(u_textura, v_uv);
  vec2 r = ceRadioUv(mix(0.006, 0.05, u_intervalo));
  vec3 suma = vec3(0.0);
  for (int i = 0; i < 12; i++) {
    float a = float(i) * PI / 6.0;
    vec2 d = vec2(cos(a), sin(a));
    suma += luces(v_uv + d * r) + luces(v_uv + d * r * 0.45);
  }
  suma /= 24.0;
  c.rgb = 1.0 - (1.0 - c.rgb) * (1.0 - clamp(suma * u_intensidad * 1.8, 0.0, 1.0));
  colorSalida = c;
}`,
	},
	{
		id: "destello",
		nombre: "Destello",
		categoria: "Luz",
		palabras: ["flash", "parpadeo", "estrobo"],
		animado: true,
		params: [INTENSIDAD(70), VELOCIDAD(50)],
		glsl: `
uniform float u_intensidad, u_velocidad;
void main() {
  vec4 c = texture(u_textura, v_uv);
  float periodo = mix(1.6, 0.25, u_velocidad);
  float f = exp(-fract(u_tiempo / periodo) * 7.0) * u_intensidad;
  c.rgb = mix(c.rgb, vec3(1.0), f * 0.85);
  colorSalida = c;
}`,
	},
	{
		id: "fuga-de-luz",
		nombre: "Fuga de luz",
		categoria: "Luz",
		palabras: ["light leak", "luz cálida"],
		animado: true,
		params: [INTENSIDAD(60), VELOCIDAD(40)],
		glsl: `
uniform float u_intensidad, u_velocidad;
void main() {
  vec4 c = texture(u_textura, v_uv);
  vec2 p = ceAEspacio(v_uv);
  float asp = ceAspecto();
  float t = u_tiempo * mix(0.15, 0.8, u_velocidad);
  vec3 luz = vec3(0.0);
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    vec2 centro = vec2(fract(0.2 + fi * 0.37 + t * (0.3 + fi * 0.13)) * 1.6 - 0.3,
                       0.5 + 0.45 * sin(t * (1.0 + fi) + fi * 2.0));
    vec2 d = (p - centro) * vec2(asp, 1.0);
    float g = exp(-dot(d, d) * (3.0 + fi * 2.0));
    vec3 col = i == 0 ? vec3(1.0, 0.45, 0.1) : (i == 1 ? vec3(1.0, 0.2, 0.3) : vec3(1.0, 0.8, 0.3));
    luz += col * g;
  }
  c.rgb = 1.0 - (1.0 - c.rgb) * (1.0 - clamp(luz * u_intensidad, 0.0, 1.0));
  colorSalida = c;
}`,
	},
	{
		id: "bordes-neon",
		desplaza: true,
		nombre: "Bordes de neón",
		categoria: "Luz",
		palabras: ["neón", "contorno", "bordes"],
		animado: true,
		params: [INTENSIDAD(80), p("brillo", "Brillo", 50)],
		glsl: `
uniform float u_intensidad, u_brillo;
float lu(vec2 uv) { vec4 c = texture(u_textura, uv); return luma(c.rgb) * c.a; }
void main() {
  vec4 c = texture(u_textura, v_uv);
  vec2 t = ceTexel() * max(1.0, u_resolucion.y / 720.0);
  float tl = lu(v_uv + vec2(-t.x, t.y));
  float tc = lu(v_uv + vec2(0.0, t.y));
  float tr = lu(v_uv + vec2(t.x, t.y));
  float ml = lu(v_uv + vec2(-t.x, 0.0));
  float mr = lu(v_uv + vec2(t.x, 0.0));
  float bl = lu(v_uv + vec2(-t.x, -t.y));
  float bc = lu(v_uv + vec2(0.0, -t.y));
  float br = lu(v_uv + vec2(t.x, -t.y));
  float gx = (tr + 2.0 * mr + br) - (tl + 2.0 * ml + bl);
  float gy = (tl + 2.0 * tc + tr) - (bl + 2.0 * bc + br);
  float e = clamp(length(vec2(gx, gy)) * 2.0, 0.0, 1.0);
  vec2 p = ceAEspacio(v_uv);
  vec3 neon = hsvARgb(vec3(fract(p.x * 0.6 + p.y * 0.4 + u_tiempo * 0.15), 0.85, 1.0));
  vec3 base = c.rgb * (1.0 - 0.8 * u_intensidad);
  colorSalida = vec4(clamp(base + neon * e * (0.6 + 1.6 * u_brillo) * u_intensidad, 0.0, 1.0), c.a);
}`,
	},
	{
		id: "grano",
		nombre: "Grano de película",
		categoria: "Retro",
		palabras: ["grano", "ruido", "film"],
		animado: true,
		params: [INTENSIDAD(50), p("textura", "Textura", 30)],
		uniforms: (v) => ({ u_intensidad: v.intensidad / 100, u_tamano: v.textura / 100 }),
		glsl: `
uniform float u_intensidad, u_tamano;
void main() {
  vec4 c = texture(u_textura, v_uv);
  vec2 p = ceAEspacio(v_uv);
  float escala = max(1.0, u_lienzo.y / 720.0) * mix(1.0, 4.0, u_tamano);
  vec2 celda = floor(p * u_lienzo / escala);
  float f = floor(u_tiempo * 24.0);
  float n = (hash12(celda + f * vec2(37.0, 17.0)) + hash12(celda * 1.7 + f * vec2(11.0, 53.0))) * 0.5 - 0.5;
  float L = luma(c.rgb);
  float peso = 0.5 + 0.5 * (1.0 - abs(L * 2.0 - 1.0));
  vec3 rgb = c.rgb + n * u_intensidad * 0.35 * peso;
  rgb = mix(rgb, rgb * 0.95 + 0.03, u_intensidad * 0.5);
  colorSalida = vec4(clamp(rgb, 0.0, 1.0), c.a);
}`,
	},
	{
		id: "vhs",
		desplaza: true,
		nombre: "VHS",
		categoria: "Retro",
		palabras: ["video casero", "cinta", "retro"],
		animado: true,
		params: [INTENSIDAD(70)],
		glsl: `
uniform float u_intensidad;
void main() {
  vec2 p = ceAEspacio(v_uv);
  float f = floor(u_tiempo * 30.0);
  float linea = floor(p.y * u_lienzo.y / max(1.0, u_lienzo.y / 480.0));
  float jit = (hash12(vec2(linea, f)) - 0.5) * 0.004 * u_intensidad;
  float banda = fract(u_tiempo * 0.15);
  float enBanda = 1.0 - smoothstep(0.0, 0.05, abs(p.y - (1.0 - banda)));
  jit += enBanda * (hash12(vec2(f, linea)) - 0.5) * 0.04 * u_intensidad;
  vec2 q = vec2(p.x + jit, p.y);
  float sep = 0.006 * u_intensidad;
  vec4 cg = ceMuestra(q);
  vec3 c = vec3(ceMuestra(q + vec2(sep, 0.0)).r, cg.g, ceMuestra(q - vec2(sep, 0.0)).b);
  c = mix(c, vec3(luma(c)), 0.2 * u_intensidad);
  c *= 1.0 - 0.18 * u_intensidad * step(0.5, fract(p.y * u_lienzo.y / max(2.0, u_lienzo.y / 360.0)));
  c += (hash12(p * u_lienzo + f) - 0.5) * 0.12 * u_intensidad;
  c += enBanda * 0.2 * u_intensidad * hash12(vec2(p.x * 300.0, f));
  colorSalida = vec4(clamp(c, 0.0, 1.0), cg.a);
}`,
	},
	{
		id: "pelicula-antigua",
		desplaza: true,
		nombre: "Película antigua",
		categoria: "Retro",
		palabras: ["sepia", "cine mudo", "rayas", "viejo"],
		animado: true,
		params: [INTENSIDAD(80)],
		glsl: `
uniform float u_intensidad;
void main() {
  vec2 p = ceAEspacio(v_uv);
  float f = floor(u_tiempo * 18.0);
  vec2 q = p + vec2(0.0, (hash12(vec2(f, 1.0)) - 0.5) * 0.006 * u_intensidad);
  vec4 c4 = ceMuestra(q);
  vec3 c = c4.rgb;
  float L = luma(c);
  c = mix(c, vec3(L * 1.07 + 0.04, L * 0.95 + 0.02, L * 0.75), 0.85 * u_intensidad);
  c *= 1.0 - (hash12(vec2(f, 7.0)) - 0.5) * 0.15 * u_intensidad;
  float x0 = hash12(vec2(f, 3.0));
  float raya = 1.0 - smoothstep(0.0, 0.0015, abs(p.x - x0));
  c = mix(c, vec3(0.9), raya * step(0.5, hash12(vec2(f, 5.0))) * u_intensidad * 0.6);
  float polvo = step(0.9985, hash12(floor(p * u_lienzo / 3.0) + f * 13.0));
  c = mix(c, vec3(0.1), polvo * u_intensidad);
  float r = length((p - 0.5) * 2.0) / 1.4142;
  c *= 1.0 - smoothstep(0.45, 1.1, r) * 0.6 * u_intensidad;
  c += (hash12(p * u_lienzo + f * 7.0) - 0.5) * 0.1 * u_intensidad;
  colorSalida = vec4(clamp(c, 0.0, 1.0), c4.a);
}`,
	},
	{
		id: "glitch",
		desplaza: true,
		nombre: "Glitch",
		categoria: "Distorsión",
		palabras: ["falla", "error", "interferencia"],
		animado: true,
		params: [INTENSIDAD(60), VELOCIDAD(50)],
		glsl: `
uniform float u_intensidad, u_velocidad;
void main() {
  vec2 p = ceAEspacio(v_uv);
  float t = floor(u_tiempo * mix(6.0, 24.0, u_velocidad));
  float rafaga = step(0.55, hash12(vec2(t, 3.1)));
  float filas = mix(8.0, 40.0, hash12(vec2(t, 9.7)));
  float banda = floor(p.y * filas);
  float r = hash12(vec2(banda, t));
  float corre = (r - 0.5) * 0.18 * u_intensidad * step(0.65, r) * rafaga;
  vec2 q = vec2(p.x + corre, p.y);
  float sep = (0.004 + 0.02 * rafaga) * u_intensidad;
  vec4 cr = ceMuestra(q + vec2(sep, 0.0));
  vec4 cg = ceMuestra(q);
  vec4 cb = ceMuestra(q - vec2(sep, 0.0));
  vec4 c = vec4(cr.r, cg.g, cb.b, max(cg.a, max(cr.a, cb.a)));
  float b = hash12(floor(p * vec2(10.0, 18.0)) + t);
  if (b > 1.0 - 0.06 * u_intensidad * rafaga) c.rgb = c.gbr;
  c.rgb *= 1.0 - 0.12 * u_intensidad * step(0.5, fract(p.y * u_lienzo.y * 0.25));
  colorSalida = c;
}`,
	},
	{
		id: "aberracion",
		desplaza: true,
		nombre: "Aberración cromática",
		categoria: "Distorsión",
		palabras: ["rgb", "separación", "cromática"],
		params: [p("horizontal", "Diferencia cromática horizontal", 40), p("vertical", "Diferencia cromática vertical", 0)],
		uniforms: (v) => ({ u_h: v.horizontal / 100, u_v: v.vertical / 100 }),
		glsl: `
uniform float u_h, u_v;
void main() {
  vec2 p = ceAEspacio(v_uv);
  vec2 d = vec2(u_h / ceAspecto(), u_v) * 0.025;
  vec4 r = ceMuestra(p + d);
  vec4 g = ceMuestra(p);
  vec4 b = ceMuestra(p - d);
  colorSalida = vec4(r.r, g.g, b.b, max(g.a, max(r.a, b.a)));
}`,
	},
	{
		id: "ondas",
		desplaza: true,
		nombre: "Ondas",
		categoria: "Distorsión",
		palabras: ["agua", "ondulación", "olas"],
		animado: true,
		params: [INTENSIDAD(50), VELOCIDAD(50)],
		glsl: `
uniform float u_intensidad, u_velocidad;
void main() {
  vec2 p = ceAEspacio(v_uv);
  float t = u_tiempo * mix(1.0, 6.0, u_velocidad);
  float amp = 0.012 * u_intensidad;
  vec2 q = p + vec2(sin(p.y * 22.0 + t * 2.0), cos(p.x * 18.0 + t * 1.7)) * amp;
  colorSalida = ceMuestra(0.5 + (q - 0.5) * (1.0 - amp * 2.0));
}`,
	},
	{
		id: "remolino",
		desplaza: true,
		nombre: "Remolino",
		categoria: "Distorsión",
		palabras: ["espiral", "torbellino", "giro"],
		animado: true,
		params: [p("giro", "Giro", 50), p("intervalo", "Intervalo", 50)],
		// `u_giro` es el giro de la CAPA (el espacio de glsl.ts): el del remolino va aparte.
		uniforms: (v) => ({ u_torsion: v.giro / 100, u_intervalo: v.intervalo / 100 }),
		glsl: `
uniform float u_torsion, u_intervalo;
void main() {
  vec2 p = ceAEspacio(v_uv);
  float asp = ceAspecto();
  vec2 d = (p - 0.5) * vec2(asp, 1.0);
  float R = mix(0.2, 0.9, u_intervalo);
  float w = 1.0 - smoothstep(0.0, R, length(d));
  float ang = u_torsion * 2.0 * PI * 1.2 * w * w * (0.75 + 0.25 * sin(u_tiempo * 1.5));
  float c0 = cos(ang);
  float s0 = sin(ang);
  d = vec2(c0 * d.x - s0 * d.y, s0 * d.x + c0 * d.y);
  colorSalida = ceMuestra(d / vec2(asp, 1.0) + 0.5);
}`,
	},
	{
		id: "pixeles",
		desplaza: true,
		nombre: "Píxeles",
		categoria: "Distorsión",
		palabras: ["pixelar", "pixel", "censura", "mosaico"],
		params: [INTENSIDAD(40)],
		glsl: `
uniform float u_intensidad;
void main() {
  vec2 p = ceAEspacio(v_uv);
  float lado = mix(4.0, 80.0, u_intensidad * u_intensidad) * max(1.0, u_lienzo.y / 1080.0);
  vec2 q = (floor(p * u_lienzo / lado) + 0.5) * lado / u_lienzo;
  colorSalida = ceMuestra(q);
}`,
	},
	{
		id: "ojo-de-pez",
		desplaza: true,
		nombre: "Ojo de pez",
		categoria: "Lente",
		palabras: ["fisheye", "lente", "abombado"],
		params: [INTENSIDAD(60)],
		glsl: `
uniform float u_intensidad;
void main() {
  vec2 p = ceAEspacio(v_uv);
  float asp = ceAspecto();
  vec2 d = (p - 0.5) * vec2(asp, 1.0);
  vec2 q = d * mix(1.0, dot(d, d) * 1.6 + 0.35, u_intensidad);
  colorSalida = ceMuestra(q / vec2(asp, 1.0) + 0.5);
}`,
	},
	{
		id: "desenfoque-radial",
		desplaza: true,
		nombre: "Desenfoque radial",
		categoria: "Lente",
		palabras: ["zoom", "velocidad", "movimiento", "blur"],
		params: [INTENSIDAD(50)],
		glsl: `
uniform float u_intensidad;
void main() {
  vec2 p = ceAEspacio(v_uv);
  vec4 s = vec4(0.0);
  float k = 0.12 * u_intensidad;
  for (int i = 0; i < 16; i++) {
    s += ceMuestra(0.5 + (p - 0.5) * (1.0 - k * float(i) / 15.0));
  }
  colorSalida = s / 16.0;
}`,
	},
	{
		id: "caleidoscopio",
		desplaza: true,
		nombre: "Caleidoscopio",
		categoria: "Pantalla dividida",
		palabras: ["espejos", "simetría", "kaleidoscope"],
		animado: true,
		params: [p("monto", "Monto", 40), VELOCIDAD(20)],
		uniforms: (v) => ({ u_lados: Math.round(2 + (v.monto / 100) * 10), u_velocidad: v.velocidad / 100 }),
		glsl: `
uniform float u_lados, u_velocidad;
void main() {
  vec2 p = ceAEspacio(v_uv);
  float asp = ceAspecto();
  vec2 d = (p - 0.5) * vec2(asp, 1.0);
  float r = length(d);
  float a = atan(d.y, d.x) + u_tiempo * u_velocidad * 1.5;
  float seg = 2.0 * PI / max(u_lados, 2.0);
  a = mod(a, seg);
  a = min(a, seg - a);
  vec2 q = vec2(cos(a), sin(a)) * r / vec2(asp, 1.0) + 0.5;
  q = 1.0 - abs(1.0 - mod(q, 2.0));
  colorSalida = ceMuestra(q);
}`,
	},
	{
		id: "mosaico",
		desplaza: true,
		nombre: "Mosaico",
		categoria: "Pantalla dividida",
		palabras: ["cuadrícula", "copias", "pantallas"],
		params: [p("monto", "Monto", 0)],
		uniforms: (v) => ({ u_n: 2 + Math.round((v.monto / 100) * 2) }),
		glsl: `
uniform float u_n;
void main() {
  vec2 p = ceAEspacio(v_uv);
  colorSalida = ceMuestra(fract(p * u_n));
}`,
	},
	{
		id: "espejo",
		desplaza: true,
		nombre: "Espejo",
		categoria: "Pantalla dividida",
		palabras: ["reflejo", "simetría", "mirror"],
		params: [],
		glsl: `
void main() {
  vec2 p = ceAEspacio(v_uv);
  if (p.x > 0.5) p.x = 1.0 - p.x;
  colorSalida = ceMuestra(p);
}`,
	},
];

function definicionDe(receta: Receta): EffectDefinition {
	const shader = `ce-efecto-${receta.id}`;
	registrarPase({ id: shader, fragment: `${CABECERA}${receta.glsl}`, desplaza: receta.desplaza });
	const params: NumberParamDefinition[] = receta.params.map((x) => ({
		key: x.key,
		label: x.label,
		type: "number",
		default: x.default,
		min: 0,
		max: 100,
		step: 1,
	}));
	return {
		type: `${PREFIJO_EFECTO}${receta.id}`,
		name: receta.nombre,
		keywords: ["efecto", receta.nombre.toLowerCase(), receta.categoria.toLowerCase(), ...(receta.palabras ?? [])],
		clase: "efecto",
		categoria: receta.categoria,
		animado: receta.animado,
		params,
		renderer: {
			passes: [],
			buildPasses: ({ effectParams: e }) => {
				const valores: Record<string, number> = {};
				for (const x of receta.params) valores[x.key] = num(e[x.key], x.default);
				const propios = receta.uniforms
					? receta.uniforms(valores)
					: Object.fromEntries(receta.params.map((x) => [`u_${x.key}`, valores[x.key] / 100]));
				// El tiempo sólo a los que se mueven: un uniform que cambia en cada cuadro
				// obliga a redibujar el texto y el fondo que están debajo de la capa.
				return [{ shader, uniforms: receta.animado ? { ...propios, u_tiempo: tiempoDe(e) } : propios }];
			},
		},
	};
}

export const efectoEffectDefinitions: EffectDefinition[] = RECETAS.map(definicionDe);

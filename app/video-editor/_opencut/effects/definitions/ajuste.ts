// =============================================================================
// «Ajustar» de CapCut: el efecto `ajuste` (pase `ce-ajuste`)
// =============================================================================
// Un solo efecto con todos los deslizadores de Ajustar › Básico, la LUT y el
// HSL. Vive en dos lugares, como en CapCut:
//
//   · en un CLIP (video o imagen): `element.effects` tiene a lo sumo un `ajuste`
//     (grupoUnico), que escribe la pestaña «Ajustar» del panel derecho;
//   · como CAPA: un elemento `effect` con `effectType: "ajuste"` en su pista
//     («Ajuste personalizado» de la biblioteca), que afecta a todo lo de abajo.
//
// Contrato (docs/diseno-editor-video.md §4.1): las claves de abajo. Rangos: los
// de CapCut, −50…50 los que van para los dos lados y 0…100 los que sólo suman
// (Enfocar, Granulado, Desvanecer, Viñeta); el HSL −100…100. Todo en 0 = sin
// cambio, y entonces el efecto no corre ningún pase (buildPasses devuelve []).
//
// Rótulos: es-LA.po de CapCut 9.3 («Iluminar» es Highlights, «Enfocar» es
// Sharpen, «Luminosidad» es Brilliance, «Tinte» es Tint, «Claridad» es Clarity;
// la clave `matiz` del contrato es el Tinte verde↔magenta, no un giro de tono).
//
// El orden de las operaciones imita a un revelado: LUT (la base), detalle
// (Enfocar, Claridad, sobre el original), exposición en lineal, balance de
// blancos, brillo, contraste, tonos (Iluminar, Sombras, Blancos, Negros,
// Luminosidad), saturación, HSL, Desvanecer, Viñeta y Granulado al final.

import type { NumberParamDefinition, ParamDefinition } from "@/app/video-editor/_opencut/params";
import { registrarPase, numeroLut } from "@/app/video-editor/_opencut/services/renderer/pases-ce";
import type { EffectDefinition } from "../types";
import { CABECERA, num, tiempoDe } from "../glsl";

export const TIPO_AJUSTE = "ajuste";
export const PASE_AJUSTE = "ce-ajuste";

function bipolar(key: string, label: string): NumberParamDefinition {
	return { key, label, type: "number", default: 0, min: -50, max: 50, step: 1 };
}
function unipolar(key: string, label: string): NumberParamDefinition {
	return { key, label, type: "number", default: 0, min: 0, max: 100, step: 1 };
}

/** Los deslizadores de Ajustar › Básico, en el orden de CapCut. */
export const PARAMS_BASICO: NumberParamDefinition[] = [
	bipolar("temperatura", "Temp"),
	bipolar("matiz", "Tinte"),
	bipolar("saturacion", "Saturación"),
	bipolar("brillo", "Brillo"),
	bipolar("contraste", "Contraste"),
	bipolar("exposicion", "Exposición"),
	bipolar("luminosidad", "Luminosidad"),
	bipolar("resaltados", "Iluminar"),
	bipolar("sombras", "Sombras"),
	bipolar("blancos", "Blancos"),
	bipolar("negros", "Negros"),
	bipolar("claridad", "Claridad"),
	unipolar("nitidez", "Enfocar"),
	unipolar("grano", "Granulado"),
	unipolar("desvanecer", "Desvanecer"),
	unipolar("vineta", "Viñeta"),
];

/** Los 8 colores del HSL de CapCut: tono central (0..1) y rótulo. */
export const COLORES_HSL = [
	{ id: "rojo", etiqueta: "Rojo", tono: 0 / 360, muestra: "#e5484d" },
	{ id: "naranja", etiqueta: "Naranja", tono: 30 / 360, muestra: "#f08c2e" },
	{ id: "amarillo", etiqueta: "Amarillo", tono: 58 / 360, muestra: "#f1d33f" },
	{ id: "verde", etiqueta: "Verde", tono: 120 / 360, muestra: "#3fbf5a" },
	{ id: "cian", etiqueta: "Cian", tono: 180 / 360, muestra: "#38c6d4" },
	{ id: "azul", etiqueta: "Azul", tono: 225 / 360, muestra: "#3f6fe0" },
	{ id: "morado", etiqueta: "Morado", tono: 275 / 360, muestra: "#8a52d9" },
	{ id: "magenta", etiqueta: "Magenta", tono: 315 / 360, muestra: "#d64fb4" },
] as const;

export const COMPONENTES_HSL = [
	{ id: "matiz", etiqueta: "Matiz" },
	{ id: "saturacion", etiqueta: "Saturación" },
	{ id: "claridad", etiqueta: "Claridad" },
] as const;

export function claveHsl(color: string, componente: string): string {
	return `hsl.${color}.${componente}`;
}

export const PARAMS_HSL: NumberParamDefinition[] = COLORES_HSL.flatMap((color) =>
	COMPONENTES_HSL.map((comp) => ({
		key: claveHsl(color.id, comp.id),
		label: comp.etiqueta,
		type: "number" as const,
		default: 0,
		min: -100,
		max: 100,
		step: 1,
	})),
);

/** La LUT: el id de la biblioteca (effects/lut) y su intensidad. */
export const PARAM_LUT: ParamDefinition = {
	key: "lut",
	label: "LUT",
	type: "text",
	default: "",
	keyframable: false,
};
export const PARAM_LUT_INTENSIDAD: NumberParamDefinition = {
	key: "lutIntensidad",
	label: "Intensidad",
	type: "number",
	default: 100,
	min: 0,
	max: 100,
	step: 1,
};

export const PARAMS_AJUSTE: ParamDefinition[] = [
	...PARAMS_BASICO,
	PARAM_LUT,
	PARAM_LUT_INTENSIDAD,
	...PARAMS_HSL,
];

const FRAGMENT = `${CABECERA}
uniform float u_temp, u_tinte, u_sat, u_brillo, u_contraste, u_expo, u_lumin;
uniform float u_ilum, u_sombras, u_blancos, u_negros, u_claridad, u_enfocar;
uniform float u_grano, u_desvanecer, u_vineta;
uniform float u_hsl[24];
uniform float u_usaHsl;
uniform highp sampler3D u_lutTex;
uniform float u_lutTamano;
uniform float u_lutIntensidad;

vec3 desenfoqueCruz(vec2 uv, float radio) {
  vec2 d = ceTexel() * radio;
  vec3 s = texture(u_textura, uv + vec2(d.x, 0.0)).rgb
         + texture(u_textura, uv - vec2(d.x, 0.0)).rgb
         + texture(u_textura, uv + vec2(0.0, d.y)).rgb
         + texture(u_textura, uv - vec2(0.0, d.y)).rgb
         + texture(u_textura, uv + d * 0.7071).rgb
         + texture(u_textura, uv - d * 0.7071).rgb
         + texture(u_textura, uv + vec2(d.x, -d.y) * 0.7071).rgb
         + texture(u_textura, uv + vec2(-d.x, d.y) * 0.7071).rgb;
  return s / 8.0;
}

float distanciaTono(float a, float b) {
  float d = abs(a - b);
  return min(d, 1.0 - d);
}

void main() {
  vec4 orig = texture(u_textura, v_uv);
  vec3 c = orig.rgb;

  if (u_lutIntensidad > 0.0) {
    float n = max(u_lutTamano, 2.0);
    vec3 coord = clamp(c, 0.0, 1.0) * ((n - 1.0) / n) + 0.5 / n;
    c = mix(c, texture(u_lutTex, coord).rgb, u_lutIntensidad);
  }

  // Detalle: Enfocar (radio de 1 px) y Claridad (contraste local, radio grande),
  // medidos sobre el original y sumados al color ya corregido.
  if (u_enfocar > 0.0) {
    c += (orig.rgb - desenfoqueCruz(v_uv, 1.0)) * u_enfocar * 2.5;
  }
  if (u_claridad != 0.0) {
    float radio = max(2.0, u_resolucion.y / 140.0);
    float L0 = luma(clamp(c, 0.0, 1.0));
    float medios = 1.0 - abs(L0 * 2.0 - 1.0);
    c += (orig.rgb - desenfoqueCruz(v_uv, radio)) * u_claridad * 1.6 * medios;
  }

  // Exposición: en luz lineal, en pasos (±1,5 EV en los extremos).
  c = max(c, 0.0);
  c = pow(pow(c, vec3(2.2)) * exp2(u_expo * 1.5), vec3(1.0 / 2.2));

  // Balance de blancos: Temp (azul↔ámbar) y Tinte (verde↔magenta).
  c *= vec3(1.0 + 0.16 * u_temp, 1.0 + 0.02 * u_temp, 1.0 - 0.16 * u_temp);
  c *= vec3(1.0 + 0.07 * u_tinte, 1.0 - 0.12 * u_tinte, 1.0 + 0.07 * u_tinte);

  // Brillo: una curva de gama (no un desplazamiento: no lava los negros).
  c = pow(max(c, 0.0), vec3(exp2(-u_brillo * 0.75)));

  // Contraste alrededor del gris medio.
  c = (c - 0.5) * (1.0 + u_contraste * 0.55) + 0.5;

  // Tonos, por la luminancia.
  float L = luma(clamp(c, 0.0, 1.0));
  c += u_sombras * 0.28 * (1.0 - smoothstep(0.0, 0.55, L));
  c += u_ilum * 0.28 * smoothstep(0.45, 1.0, L);
  c += u_negros * 0.12 * (1.0 - smoothstep(0.0, 0.3, L));
  c += u_blancos * 0.12 * smoothstep(0.7, 1.0, L);
  c += u_lumin * 0.16 * (4.0 * L * (1.0 - L));

  // Saturación.
  float gris = luma(c);
  c = mix(vec3(gris), c, 1.0 + u_sat);

  // HSL: cada color mueve su tono, su saturación y su claridad; el peso cae con
  // la distancia de tono y es nulo en los grises.
  if (u_usaHsl > 0.5) {
    vec3 hsv = rgbAHsv(clamp(c, 0.0, 1.0));
    float dh = 0.0;
    float ds = 0.0;
    float dl = 0.0;
    float centros[8] = float[8](0.0, 0.0833, 0.1611, 0.3333, 0.5, 0.625, 0.7639, 0.875);
    for (int i = 0; i < 8; i++) {
      float w = 1.0 - smoothstep(0.0, 0.09, distanciaTono(hsv.x, centros[i]));
      dh += w * u_hsl[i * 3];
      ds += w * u_hsl[i * 3 + 1];
      dl += w * u_hsl[i * 3 + 2];
    }
    float enColor = smoothstep(0.04, 0.2, hsv.y);
    hsv.x = fract(hsv.x + dh * 0.0833 * enColor);
    hsv.y = clamp(hsv.y * (1.0 + ds * enColor), 0.0, 1.0);
    hsv.z = clamp(hsv.z * (1.0 + dl * 0.6 * enColor), 0.0, 1.0);
    c = hsvARgb(hsv);
  }

  // Desvanecer: levanta los negros y aplana, como una copia lavada.
  if (u_desvanecer > 0.0) {
    vec3 lavado = c * 0.78 + 0.14;
    c = mix(c, mix(vec3(luma(lavado)), lavado, 0.85), u_desvanecer);
  }

  vec2 p = ceAEspacio(v_uv);
  if (u_vineta > 0.0) {
    float r = length((p - 0.5) * 2.0) / 1.4142;
    c *= 1.0 - smoothstep(0.35, 1.05, r) * u_vineta * 0.85;
  }
  if (u_grano > 0.0) {
    float escala = max(1.0, u_lienzo.y / 720.0);
    vec2 celda = floor(p * u_lienzo / escala);
    float n = hash12(celda + floor(u_tiempo * 24.0) * vec2(37.0, 17.0)) - 0.5;
    c += n * u_grano * 0.22;
  }

  colorSalida = vec4(clamp(c, 0.0, 1.0), orig.a);
}
`;

registrarPase({ id: PASE_AJUSTE, fragment: FRAGMENT });

/** ¿Este conjunto de params no cambia nada? (todo en 0 y sin LUT). */
export function ajusteEsNeutro(params: Record<string, unknown>): boolean {
	if (PARAMS_BASICO.some((p) => num(params[p.key]) !== 0)) return false;
	if (PARAMS_HSL.some((p) => num(params[p.key]) !== 0)) return false;
	if (params.lut && num(params.lutIntensidad, 100) > 0) return false;
	return true;
}

export const ajusteEffectDefinition: EffectDefinition = {
	type: TIPO_AJUSTE,
	name: "Ajuste personalizado",
	keywords: ["ajuste", "ajustar", "color", "brillo", "contraste", "saturación", "lut", "hsl"],
	params: PARAMS_AJUSTE,
	clase: "ajuste",
	grupoUnico: "ajuste",
	renderer: {
		passes: [],
		buildPasses: ({ effectParams: e }) => {
			if (ajusteEsNeutro(e)) return [];
			const b = (k: string) => num(e[k]) / 50;
			const u = (k: string) => num(e[k]) / 100;
			const hsl = PARAMS_HSL.map((p) => num(e[p.key]) / 100);
			const lut = numeroLut(typeof e.lut === "string" ? e.lut : "");
			return [
				{
					shader: PASE_AJUSTE,
					uniforms: {
						u_temp: b("temperatura"),
						u_tinte: b("matiz"),
						u_sat: b("saturacion"),
						u_brillo: b("brillo"),
						u_contraste: b("contraste"),
						u_expo: b("exposicion"),
						u_lumin: b("luminosidad"),
						u_ilum: b("resaltados"),
						u_sombras: b("sombras"),
						u_blancos: b("blancos"),
						u_negros: b("negros"),
						u_claridad: b("claridad"),
						u_enfocar: u("nitidez"),
						u_grano: u("grano"),
						u_desvanecer: u("desvanecer"),
						u_vineta: u("vineta"),
						u_hsl: hsl,
						u_usaHsl: hsl.some((v) => v !== 0) ? 1 : 0,
						// Siempre: el sampler3D tiene que tener SU unidad (ver pases-ce.ts).
						u_lut: lut,
						u_lutIntensidad: lut > 0 ? u("lutIntensidad") : 0,
						// Sólo si hay grano: un uniform que cambia en cada cuadro invalida
						// el caché de las texturas dibujadas (texto, fondo) bajo una capa.
						...(num(e.grano) > 0 ? { u_tiempo: tiempoDe(e) } : {}),
					},
				},
			];
		},
	},
};

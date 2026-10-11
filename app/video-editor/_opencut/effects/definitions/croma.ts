// =============================================================================
// «Chroma key» de CapCut: el efecto `croma` (pase `ce-croma`)
// =============================================================================
// La UI (Video › Eliminar fondo › Chroma key: Selector de colores, Intensidad,
// Sombra, Borde de plumas, Limpiar borde) la dibuja el paquete de fondo (M);
// acá está el efecto que esa UI escribe en `element.effects` del clip. A lo
// sumo uno por clip (grupoUnico).
//
// Contrato (docs/diseno-editor-video.md §4.1): `color` (hex), `intensidad`,
// `sombra`, `borde`, `limpiarBorde` (0–100). Como CapCut («Elige el color y,
// luego, ajusta la intensidad»), la intensidad arranca en 0: con 0 sólo se va
// el color exacto, y se sube hasta que el fondo desaparece.
//
// Cómo: se compara el CROMA (Cb/Cr, sin la luz) del píxel con el del color
// elegido, así una sombra sobre el verde sigue siendo «verde». `sombra`
// conserva, en negro semitransparente, lo que es más oscuro que el fondo (la
// sombra de la persona sobre la tela); `borde` difumina el corte; `limpiarBorde`
// le saca al sujeto el reflejo del color de fondo (el halo verde del pelo).

import type { ParamDefinition } from "@/app/video-editor/_opencut/params";
import { registrarPase } from "@/app/video-editor/_opencut/services/renderer/pases-ce";
import type { EffectDefinition } from "../types";
import { CABECERA, hexARgb, num } from "../glsl";

export const TIPO_CROMA = "croma";
export const PASE_CROMA = "ce-croma";

export const PARAMS_CROMA: ParamDefinition[] = [
	{ key: "color", label: "Selector de colores", type: "color", default: "#00ff00", keyframable: false },
	{ key: "intensidad", label: "Intensidad", type: "number", default: 0, min: 0, max: 100, step: 1 },
	{ key: "sombra", label: "Sombra", type: "number", default: 0, min: 0, max: 100, step: 1 },
	{ key: "borde", label: "Borde de plumas", type: "number", default: 0, min: 0, max: 100, step: 1 },
	{ key: "limpiarBorde", label: "Limpiar borde", type: "number", default: 0, min: 0, max: 100, step: 1 },
];

const FRAGMENT = `${CABECERA}
uniform vec3 u_clave;
uniform float u_intensidad;
uniform float u_sombra;
uniform float u_borde;
uniform float u_limpiar;

vec2 croma(vec3 c) {
  return vec2(-0.1687 * c.r - 0.3313 * c.g + 0.5 * c.b,
               0.5 * c.r - 0.4187 * c.g - 0.0813 * c.b);
}

void main() {
  vec4 orig = texture(u_textura, v_uv);
  vec3 c = orig.rgb;
  vec2 kc = croma(u_clave);
  vec2 pc = croma(c);
  float dist = distance(pc, kc);

  // Umbral y calado, en distancia de croma (0 = el mismo color).
  float umbral = 0.015 + u_intensidad * 0.33;
  float calado = 0.006 + u_borde * 0.16;
  float alfa = smoothstep(umbral, umbral + calado, dist);

  // Limpiar borde: se le resta al píxel la parte de su croma que va hacia el
  // color de fondo, más fuerte cerca del corte.
  if (u_limpiar > 0.0) {
    vec2 dir = length(kc) > 1e-4 ? normalize(kc) : vec2(0.0);
    float hacia = max(dot(pc, dir), 0.0);
    float cerca = 1.0 - smoothstep(umbral, umbral + calado + 0.25, dist);
    float quitar = hacia * u_limpiar * mix(0.35, 1.0, cerca);
    float Y = luma(c);
    vec2 nuevo = pc - dir * quitar;
    c = clamp(vec3(Y + 1.402 * nuevo.y,
                   Y - 0.344136 * nuevo.x - 0.714136 * nuevo.y,
                   Y + 1.772 * nuevo.x), 0.0, 1.0);
  }

  // Sombra: lo quitado que es más oscuro que el fondo queda como sombra negra.
  vec3 salida = c;
  float a = alfa;
  if (u_sombra > 0.0 && alfa < 1.0) {
    float oscuro = clamp((luma(u_clave) - luma(orig.rgb)) * 3.0, 0.0, 1.0);
    float sombra = oscuro * u_sombra * (1.0 - alfa);
    a = alfa + sombra;
    salida = a > 1e-4 ? c * (alfa / a) : c;
  }

  colorSalida = vec4(salida, orig.a * clamp(a, 0.0, 1.0));
}
`;

registrarPase({ id: PASE_CROMA, fragment: FRAGMENT });

export const cromaEffectDefinition: EffectDefinition = {
	type: TIPO_CROMA,
	name: "Chroma key",
	keywords: ["chroma", "croma", "fondo verde", "pantalla verde"],
	params: PARAMS_CROMA,
	clase: "croma",
	grupoUnico: "croma",
	renderer: {
		passes: [],
		buildPasses: ({ effectParams: e }) => [
			{
				shader: PASE_CROMA,
				uniforms: {
					u_clave: hexARgb(e.color),
					u_intensidad: num(e.intensidad) / 100,
					u_sombra: num(e.sombra) / 100,
					u_borde: num(e.borde) / 100,
					u_limpiar: num(e.limpiarBorde) / 100,
				},
			},
		],
	},
};

// =============================================================================
// «Filtros» de CapCut: un pase (`ce-filtro`) y un preset por filtro
// =============================================================================
// En CapCut un filtro es una LUT descargada con su miniatura; las dos son de
// ByteDance y no se copian (docs/diseno-editor-video.md, decisión 2). Acá cada
// filtro es un PRESET de un único shader: matriz de color, lift/gamma/gain por
// canal, contraste, saturación, virado de sombras y luces, desvanecido, viñeta
// y grano. Con eso salen los «looks» de las categorías de CapCut (Destacado,
// Vida, Paisaje, Películas, Retro, Mono, Retrato) sin un solo binario ajeno.
//
// Cada filtro es un tipo de efecto `filtro.<id>` (el «filtro» en el id es lo que
// usa la línea de tiempo para el color del clip y para la vinculación) con un
// solo parámetro, «Intensidad» 0–100 y 100 por defecto, como CapCut.
// Los nombres son nuestros: los de CapCut vienen del servidor, no del .po.

import type { EffectDefinition } from "../types";
import { registrarPase } from "@/app/video-editor/_opencut/services/renderer/pases-ce";
import { CABECERA, num, tiempoDe } from "../glsl";

export const PASE_FILTRO = "ce-filtro";
export const PREFIJO_FILTRO = "filtro.";

type V3 = [number, number, number];

export type PresetFiltro = {
	id: string;
	nombre: string;
	categoria: CategoriaFiltro;
	/** Matriz de color 3×3 por filas (salida = M · entrada). */
	matriz?: [number, number, number, number, number, number, number, number, number];
	lift?: V3;
	gamma?: V3;
	gain?: V3;
	contraste?: number;
	saturacion?: number;
	tonoSombras?: V3;
	tonoLuces?: V3;
	desvanecer?: number;
	vineta?: number;
	grano?: number;
	/** Para buscar. */
	palabras?: string[];
};

/** Las categorías de «Filtros ▾», en el orden de CapCut. */
export const CATEGORIAS_FILTRO = [
	"Destacado",
	"Vida",
	"Paisaje",
	"Películas",
	"Retro",
	"Mono",
	"Retrato",
] as const;
export type CategoriaFiltro = (typeof CATEGORIAS_FILTRO)[number];

// Una matriz que mezcla hacia el gris (saturación por matriz, pesos Rec.709).
function gris(f: number): PresetFiltro["matriz"] {
	const r = 0.2126 * (1 - f);
	const g = 0.7152 * (1 - f);
	const b = 0.0722 * (1 - f);
	return [r + f, g, b, r, g + f, b, r, g, b + f];
}

export const PRESETS_FILTRO: PresetFiltro[] = [
	// ── Destacado ──
	{ id: "vivido", nombre: "Vívido", categoria: "Destacado", saturacion: 1.35, contraste: 1.12, gain: [1.02, 1.01, 1.0], palabras: ["vivo", "intenso"] },
	{ id: "brillante", nombre: "Brillante", categoria: "Destacado", gamma: [1.15, 1.15, 1.12], saturacion: 1.1, lift: [0.02, 0.02, 0.03] },
	{ id: "natural", nombre: "Natural", categoria: "Destacado", contraste: 1.05, saturacion: 1.08, gain: [1.01, 1.0, 0.99] },
	{ id: "nitido", nombre: "Nítido", categoria: "Destacado", contraste: 1.22, saturacion: 1.05, lift: [-0.02, -0.02, -0.02] },
	// ── Vida ──
	{ id: "calido", nombre: "Cálido", categoria: "Vida", gain: [1.08, 1.02, 0.9], tonoLuces: [0.04, 0.02, -0.03], saturacion: 1.08, palabras: ["calor", "naranja"] },
	{ id: "fresco", nombre: "Fresco", categoria: "Vida", gain: [0.93, 1.0, 1.08], tonoSombras: [-0.02, 0.0, 0.03], saturacion: 1.05, palabras: ["frío", "azul"] },
	{ id: "comida", nombre: "Comida", categoria: "Vida", saturacion: 1.3, gain: [1.06, 1.02, 0.94], contraste: 1.08, gamma: [1.05, 1.05, 1.0] },
	{ id: "cafe", nombre: "Café", categoria: "Vida", gain: [1.04, 0.98, 0.88], saturacion: 0.85, lift: [0.04, 0.02, 0.0], desvanecer: 0.15 },
	// ── Paisaje ──
	{ id: "atardecer", nombre: "Atardecer", categoria: "Paisaje", gain: [1.12, 0.98, 0.82], tonoLuces: [0.06, 0.02, -0.04], tonoSombras: [0.02, -0.01, 0.03], saturacion: 1.2 },
	{ id: "cielo-azul", nombre: "Cielo azul", categoria: "Paisaje", gain: [0.96, 1.0, 1.1], saturacion: 1.25, contraste: 1.08 },
	{ id: "bosque", nombre: "Bosque", categoria: "Paisaje", gain: [0.95, 1.07, 0.95], saturacion: 1.18, tonoSombras: [-0.01, 0.02, 0.0], contraste: 1.06 },
	{ id: "otono", nombre: "Otoño", categoria: "Paisaje", matriz: [1.05, 0.08, -0.05, 0.05, 0.92, 0.0, -0.05, 0.05, 0.85], saturacion: 1.15, gain: [1.05, 1.0, 0.9] },
	// ── Películas ──
	{ id: "cine", nombre: "Cine", categoria: "Películas", tonoSombras: [-0.04, 0.02, 0.06], tonoLuces: [0.06, 0.02, -0.05], contraste: 1.15, saturacion: 0.92, vineta: 0.25, palabras: ["teal", "naranja"] },
	{ id: "noche", nombre: "Noche", categoria: "Películas", gain: [0.85, 0.95, 1.12], gamma: [0.9, 0.92, 1.0], saturacion: 0.8, contraste: 1.1, vineta: 0.35 },
	{ id: "bruma", nombre: "Bruma", categoria: "Películas", desvanecer: 0.4, saturacion: 0.8, gain: [1.0, 1.0, 1.03], contraste: 0.9 },
	{ id: "drama", nombre: "Drama", categoria: "Películas", contraste: 1.35, saturacion: 0.7, lift: [-0.03, -0.03, -0.02], vineta: 0.4 },
	// ── Retro ──
	{ id: "anos-70", nombre: "Años 70", categoria: "Retro", matriz: [1.0, 0.1, 0.0, 0.05, 0.95, 0.05, 0.0, 0.1, 0.8], lift: [0.06, 0.04, 0.0], saturacion: 0.9, desvanecer: 0.25, grano: 0.25 },
	{ id: "instantanea", nombre: "Instantánea", categoria: "Retro", lift: [0.05, 0.05, 0.08], gain: [1.02, 1.0, 0.92], contraste: 0.92, saturacion: 0.9, desvanecer: 0.2, vineta: 0.3 },
	{ id: "sepia", nombre: "Sepia", categoria: "Retro", matriz: [0.393, 0.769, 0.189, 0.349, 0.686, 0.168, 0.272, 0.534, 0.131], contraste: 1.05, grano: 0.15 },
	{ id: "pelicula-vieja", nombre: "Película vieja", categoria: "Retro", matriz: gris(0.55), gain: [1.04, 1.0, 0.88], lift: [0.04, 0.03, 0.02], desvanecer: 0.3, grano: 0.45, vineta: 0.45 },
	// ── Mono ──
	{ id: "blanco-negro", nombre: "Blanco y negro", categoria: "Mono", matriz: gris(0), palabras: ["bn", "byn", "gris"] },
	{ id: "contraste-alto", nombre: "Contraste alto", categoria: "Mono", matriz: gris(0), contraste: 1.45, lift: [-0.03, -0.03, -0.03] },
	{ id: "plata", nombre: "Plata", categoria: "Mono", matriz: gris(0), gain: [0.98, 1.0, 1.04], desvanecer: 0.2, contraste: 1.05 },
	{ id: "carbon", nombre: "Carbón", categoria: "Mono", matriz: gris(0), gamma: [0.85, 0.85, 0.85], contraste: 1.2, grano: 0.3, vineta: 0.35 },
	// ── Retrato ──
	{ id: "piel-suave", nombre: "Piel suave", categoria: "Retrato", gamma: [1.08, 1.05, 1.04], gain: [1.03, 1.0, 0.98], contraste: 0.94, saturacion: 0.95 },
	{ id: "rosado", nombre: "Rosado", categoria: "Retrato", gain: [1.06, 0.98, 1.02], tonoLuces: [0.04, 0.0, 0.02], saturacion: 1.05, gamma: [1.04, 1.02, 1.03] },
	{ id: "porcelana", nombre: "Porcelana", categoria: "Retrato", gamma: [1.12, 1.12, 1.15], saturacion: 0.82, gain: [1.0, 1.0, 1.03], contraste: 0.95 },
	{ id: "dorado", nombre: "Dorado", categoria: "Retrato", gain: [1.08, 1.03, 0.9], tonoLuces: [0.05, 0.03, -0.04], saturacion: 1.1, vineta: 0.15 },
];

const FRAGMENT = `${CABECERA}
uniform vec3 u_filaR, u_filaG, u_filaB;
uniform vec3 u_lift, u_gamma, u_gain;
uniform float u_contraste, u_sat;
uniform vec3 u_tonoSombras, u_tonoLuces;
uniform float u_desvanecer, u_vineta, u_grano;
uniform float u_intensidad;

void main() {
  vec4 orig = texture(u_textura, v_uv);
  vec3 c = vec3(dot(u_filaR, orig.rgb), dot(u_filaG, orig.rgb), dot(u_filaB, orig.rgb));
  // Lift / gamma / gain por canal (como un corrector de color de tres vías).
  c = c * u_gain + u_lift * (1.0 - c);
  c = pow(max(c, 0.0), 1.0 / max(u_gamma, vec3(0.01)));
  c = (c - 0.5) * u_contraste + 0.5;
  float L = luma(clamp(c, 0.0, 1.0));
  c = mix(vec3(L), c, u_sat);
  c += u_tonoSombras * (1.0 - smoothstep(0.0, 0.6, L)) + u_tonoLuces * smoothstep(0.4, 1.0, L);
  if (u_desvanecer > 0.0) c = mix(c, c * 0.8 + 0.13, u_desvanecer);
  vec2 p = ceAEspacio(v_uv);
  if (u_vineta > 0.0) {
    float r = length((p - 0.5) * 2.0) / 1.4142;
    c *= 1.0 - smoothstep(0.4, 1.05, r) * u_vineta * 0.8;
  }
  if (u_grano > 0.0) {
    float escala = max(1.0, u_lienzo.y / 720.0);
    float n = hash12(floor(p * u_lienzo / escala) + floor(u_tiempo * 24.0) * vec2(41.0, 23.0)) - 0.5;
    c += n * u_grano * 0.18;
  }
  colorSalida = vec4(mix(orig.rgb, clamp(c, 0.0, 1.0), u_intensidad), orig.a);
}
`;

registrarPase({ id: PASE_FILTRO, fragment: FRAGMENT });

const IDENTIDAD = [1, 0, 0, 0, 1, 0, 0, 0, 1] as const;

function definicionDe(preset: PresetFiltro): EffectDefinition {
	const m = preset.matriz ?? IDENTIDAD;
	return {
		type: `${PREFIJO_FILTRO}${preset.id}`,
		name: preset.nombre,
		keywords: ["filtro", preset.nombre.toLowerCase(), preset.categoria.toLowerCase(), ...(preset.palabras ?? [])],
		clase: "filtro",
		categoria: preset.categoria,
		grupoUnico: "filtro",
		animado: (preset.grano ?? 0) > 0,
		params: [
			{ key: "intensidad", label: "Intensidad", type: "number", default: 100, min: 0, max: 100, step: 1 },
		],
		renderer: {
			passes: [],
			buildPasses: ({ effectParams: e }) => {
				const intensidad = num(e.intensidad, 100) / 100;
				if (intensidad <= 0) return [];
				return [
					{
						shader: PASE_FILTRO,
						uniforms: {
							u_filaR: [m[0], m[1], m[2]],
							u_filaG: [m[3], m[4], m[5]],
							u_filaB: [m[6], m[7], m[8]],
							u_lift: preset.lift ?? [0, 0, 0],
							u_gamma: preset.gamma ?? [1, 1, 1],
							u_gain: preset.gain ?? [1, 1, 1],
							u_contraste: preset.contraste ?? 1,
							u_sat: preset.saturacion ?? 1,
							u_tonoSombras: preset.tonoSombras ?? [0, 0, 0],
							u_tonoLuces: preset.tonoLuces ?? [0, 0, 0],
							u_desvanecer: preset.desvanecer ?? 0,
							u_vineta: preset.vineta ?? 0,
							u_grano: preset.grano ?? 0,
							u_intensidad: intensidad,
							...((preset.grano ?? 0) > 0 ? { u_tiempo: tiempoDe(e) } : {}),
						},
					},
				];
			},
		},
	};
}

export const filtroEffectDefinitions: EffectDefinition[] = PRESETS_FILTRO.map(definicionDe);

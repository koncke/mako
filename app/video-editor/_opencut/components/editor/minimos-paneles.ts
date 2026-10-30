// =============================================================================
// Hasta dónde se puede achicar cada panel de arriba: en PÍXELES, no en porcentaje
// =============================================================================
// Martín, 30/10/2026 («revisa bien todo», con los paneles en su mínimo). Los mínimos eran 15 % / 18 % / 15 % del ancho del
// editor (`editor-page.tsx`): con el chat abierto a 1280 eso es ~130 px, y con la barra lateral fija ~103. Medido en el
// banco (los paneles reales, el motor reemplazado): la biblioteca aplasta «Importar» y la zona para arrastrar de 240 px para
// abajo y las corta de 160; en propiedades, de 160 para abajo no se lee nada. react-resizable-panels 2 sólo entiende %:
// los píxeles se pasan a % con el ancho MEDIDO del grupo, y la librería agranda al mínimo el panel que quedó más chico
// (`reevaluatePanelConstraints`).
//
// Sin imports: lo carga el test en node.

/** El ancho mínimo de cada panel de arriba, en píxeles. */
export const MINIMOS_PX = { tools: 280, preview: 160, properties: 280 } as const;

/** Los de antes, que siguen como piso: un editor muy ancho no deja un panel más chico que esto. */
const PISO = { tools: 15, preview: 18, properties: 15 } as const;
/** Los `maxSize` de la biblioteca y de propiedades: un mínimo no puede pasarlos. */
const TECHO = 55;
/** Lo que pueden sumar los mínimos: queda lugar para mover los divisores. */
const TOPE = 96;

export type MinimosPaneles = { tools: number; preview: number; properties: number };

/** Los mínimos en % para un grupo de `ancho` px. Si no suman, se achican parejo hasta el tope. Sin medir (0), los de antes. */
export function minimosDePaneles(ancho: number): MinimosPaneles {
	if (!(ancho > 0)) return { ...PISO };
	const pct = (px: number) => (px / ancho) * 100;
	let m: MinimosPaneles = {
		tools: Math.max(PISO.tools, pct(MINIMOS_PX.tools)),
		preview: Math.max(PISO.preview, pct(MINIMOS_PX.preview)),
		properties: Math.max(PISO.properties, pct(MINIMOS_PX.properties)),
	};
	const suma = m.tools + m.preview + m.properties;
	if (suma > TOPE) {
		const k = TOPE / suma;
		m = { tools: m.tools * k, preview: m.preview * k, properties: m.properties * k };
	}
	return { tools: Math.min(m.tools, TECHO), preview: m.preview, properties: Math.min(m.properties, TECHO) };
}

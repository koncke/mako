// La distribución por defecto es la de CapCut medida («Predeterminado» de
// components/editor/diseno-paneles.ts): biblioteca 35 · reproductor 35,4 ·
// propiedades 29,6, y arriba 67,6 / línea de tiempo 32,4.
export const PANEL_CONFIG = {
	panels: {
		tools: 35,
		preview: 35.4,
		properties: 29.6,
		mainContent: 67.6,
		timeline: 32.4,
	},
} as const;

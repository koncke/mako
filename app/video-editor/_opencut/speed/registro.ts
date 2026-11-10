// =============================================================================
// La pestaña «Velocidad» del panel derecho (video y audio)
// =============================================================================
// Orden 30: después de «Video» (10) y «Audio» (20), antes de «Animación» (40),
// como CapCut (ver components/editor/panels/properties/registry.tsx). Las
// sub-pestañas «Estándar · Curva» las dibuja la cáscara con su control
// segmentado; el audio sólo tiene «Estándar», así que ahí no hay segmentado.
//
// Lo importa commands/timeline/element/operaciones-clip.tsx.

import { pestanasInspector, subpestanasInspector } from "@/app/video-editor/ce/ranuras";
import { VelocidadCurva, VelocidadEstandar } from "./components/speed-tab";
// Los ids los usan también Ctrl+R y Shift+B (./abrir.ts).
import { PESTANA_VELOCIDAD, SUBPESTANA_CURVA, SUBPESTANA_ESTANDAR } from "./abrir";

pestanasInspector.registrar({
	id: PESTANA_VELOCIDAD,
	etiqueta: "Velocidad",
	orden: 30,
	aplica: ({ element }) => element.type === "video" || element.type === "audio",
});

subpestanasInspector.registrar({
	pestana: PESTANA_VELOCIDAD,
	id: SUBPESTANA_ESTANDAR,
	etiqueta: "Estándar",
	orden: 10,
	aplica: () => true,
	Contenido: VelocidadEstandar,
});

subpestanasInspector.registrar({
	pestana: PESTANA_VELOCIDAD,
	id: SUBPESTANA_CURVA,
	etiqueta: "Curva",
	orden: 20,
	aplica: ({ element }) => element.type === "video",
	Contenido: VelocidadCurva,
});

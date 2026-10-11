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

pestanasInspector.registrar({
	id: "velocidad",
	etiqueta: "Velocidad",
	orden: 30,
	aplica: ({ element }) => element.type === "video" || element.type === "audio",
});

subpestanasInspector.registrar({
	pestana: "velocidad",
	id: "velocidad-estandar",
	etiqueta: "Estándar",
	orden: 10,
	aplica: () => true,
	Contenido: VelocidadEstandar,
});

subpestanasInspector.registrar({
	pestana: "velocidad",
	id: "velocidad-curva",
	etiqueta: "Curva",
	orden: 20,
	aplica: ({ element }) => element.type === "video",
	Contenido: VelocidadCurva,
});

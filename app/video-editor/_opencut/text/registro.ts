// =============================================================================
// Lo que registra el paquete de TEXTO en las ranuras del editor
// =============================================================================
// Panel derecho › «Texto» (orden 10: la primera del texto, la que se abre al
//   elegirlo; reemplaza al respaldo del panel, que se oculta solo por el rótulo)
//   con «Básico · Efectos». «Burbuja» no está: no hay catálogo de burbujas.
// Biblioteca › Texto › «Efectos de texto» (20) y «Plantilla de texto» (30),
//   después de «Agregar texto» (10, paquete de la biblioteca) y antes de los
//   subtítulos (60, 70).
//
// Lo importa ce/extensiones.ts.

import {
	pestanasInspector,
	seccionesBiblioteca,
	subpestanasInspector,
} from "@/app/video-editor/ce/ranuras";
import { TextoBasico, TextoEfectos } from "./components/pestana-texto";
import { EfectosDeTextoView, PlantillasDeTextoView } from "./components/biblioteca-estilos";

pestanasInspector.registrar({
	id: "texto",
	etiqueta: "Texto",
	orden: 10,
	aplica: ({ element }) => element.type === "text",
});

subpestanasInspector.registrar({
	pestana: "texto",
	id: "texto-basico",
	etiqueta: "Básico",
	orden: 10,
	aplica: () => true,
	Contenido: TextoBasico,
});

subpestanasInspector.registrar({
	pestana: "texto",
	id: "texto-efectos",
	etiqueta: "Efectos",
	orden: 30,
	aplica: () => true,
	Contenido: TextoEfectos,
});

// `cc_pc_material_text_effects_entrance` / `pc_template_text_template`.
seccionesBiblioteca.registrar({
	categoria: "texto",
	id: "texto.efectos",
	etiqueta: "Efectos de texto",
	orden: 20,
	Contenido: EfectosDeTextoView,
});

seccionesBiblioteca.registrar({
	categoria: "texto",
	id: "texto.plantillas",
	etiqueta: "Plantilla de texto",
	orden: 30,
	Contenido: PlantillasDeTextoView,
});

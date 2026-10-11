// =============================================================================
// Lo que registra el paquete de subtítulos y voz en las ranuras del editor
// =============================================================================
// Biblioteca › Subtítulos: Subtítulos automáticos · Plantillas · Subtítulos
//   locales · Agregar subtítulos (y en Texto, como en CapCut, «Subtítulos
//   automáticos» y «Subtítulos locales» después de lo del paquete de texto).
// Panel derecho: «Subtítulos» (un subtítulo elegido) y «Texto a voz» (texto).
// Barra de la línea de tiempo: «Generar subtítulos» (centena 300, la de la IA),
//   que abre la biblioteca en Subtítulos automáticos.
//
// Lo importa ce/extensiones.ts.

import { Captions } from "lucide-react";
import {
	herramientasLinea,
	pestanasInspector,
	seccionesBiblioteca,
} from "@/app/video-editor/ce/ranuras";
import { useAssetsPanelStore } from "@/app/video-editor/_opencut/components/editor/panels/assets/assets-panel-store";
import {
	AgregarSubtitulosView,
	PlantillasSubtitulosView,
	SECCIONES_SUBTITULOS,
	SubtitulosAutomaticosView,
	SubtitulosLocalesView,
} from "./components/assets-view";
import { PestanaSubtitulos } from "./components/pestana-subtitulos";
import { PestanaTextoAVoz } from "./components/texto-a-voz";
import { esSubtitulo } from "./insert";

// ── Biblioteca ───────────────────────────────────────────────────────────────

seccionesBiblioteca.registrar({
	categoria: "subtitulos",
	id: SECCIONES_SUBTITULOS.automaticos,
	etiqueta: "Subtítulos automáticos",
	orden: 10,
	Contenido: SubtitulosAutomaticosView,
});
seccionesBiblioteca.registrar({
	categoria: "subtitulos",
	id: SECCIONES_SUBTITULOS.plantillas,
	etiqueta: "Plantillas",
	orden: 20,
	Contenido: PlantillasSubtitulosView,
});
seccionesBiblioteca.registrar({
	categoria: "subtitulos",
	id: SECCIONES_SUBTITULOS.locales,
	etiqueta: "Subtítulos locales",
	orden: 30,
	Contenido: SubtitulosLocalesView,
});
seccionesBiblioteca.registrar({
	categoria: "subtitulos",
	id: SECCIONES_SUBTITULOS.agregar,
	etiqueta: "Agregar subtítulos",
	orden: 40,
	Contenido: AgregarSubtitulosView,
});

// En Texto, después de «Agregar texto», «Efectos de texto» y «Plantilla de texto».
seccionesBiblioteca.registrar({
	categoria: "texto",
	id: "texto.subtitulos-automaticos",
	etiqueta: "Subtítulos automáticos",
	orden: 60,
	Contenido: SubtitulosAutomaticosView,
});
seccionesBiblioteca.registrar({
	categoria: "texto",
	id: "texto.subtitulos-locales",
	etiqueta: "Subtítulos locales",
	orden: 70,
	Contenido: SubtitulosLocalesView,
});

// ── Panel derecho ────────────────────────────────────────────────────────────

// Antes de «Texto» (10): con un subtítulo elegido, CapCut abre la lista.
pestanasInspector.registrar({
	id: "subtitulos",
	etiqueta: "Subtítulos",
	orden: 5,
	aplica: ({ element }) => esSubtitulo(element),
	Contenido: PestanaSubtitulos,
});

pestanasInspector.registrar({
	id: "texto-a-voz",
	etiqueta: "Texto a voz",
	orden: 60,
	aplica: ({ element }) => element.type === "text",
	Contenido: PestanaTextoAVoz,
});

// ── Barra de la línea de tiempo ──────────────────────────────────────────────

herramientasLinea.registrar({
	id: "linea-generar-subtitulos",
	etiqueta: "Generar subtítulos",
	orden: 310,
	lado: "izquierda",
	Icono: Captions,
	habilitada: ({ editor }) => editor.timeline.getTotalDuration() > 0,
	ejecutar: () =>
		useAssetsPanelStore.getState().irA({
			categoria: "subtitulos",
			seccion: SECCIONES_SUBTITULOS.automaticos,
		}),
});

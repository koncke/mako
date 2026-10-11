// =============================================================================
// Lo que registra el paquete de COLOR en las ranuras del editor
// =============================================================================
// Biblioteca (columna de subcategorías, rótulos del es-LA.po de CapCut 9.3):
//
//   Efectos  › Efectos de video ▾ (Tendencias, Básico, Luz, Retro, Distorsión,
//              Lente, Pantalla dividida) · Efectos corporales (apagado)
//   Filtros  › Filtros ▾ (Destacado, Vida, Paisaje, Películas, Retro, Mono, Retrato)
//   Ajuste   › Agregar ajuste · LUT · Mis elementos predefinidos
//
// Panel derecho (el orden sigue la tabla de properties/registry.tsx):
//
//   «Ajustar» (50) en clips de video/imagen y en la capa de ajuste, con las
//   sub-pestañas «Básico» y «HSL»; «Filtros» / «Efectos de video» (10) en una
//   capa de filtro / de efecto; «Efectos» (55) en un clip con filtros o
//   efectos aplicados (para editarlos, ocultarlos o sacarlos).
//
// Lo importa ce/extensiones.ts.

import { pestanasInspector, seccionesBiblioteca, subpestanasInspector } from "@/app/video-editor/ce/ranuras";
import { effectsRegistry, registerDefaultEffects } from "./index";
import { CATEGORIAS_EFECTO } from "./definitions/efectos";
import { CATEGORIAS_FILTRO } from "./definitions/filtros";
import { TIPO_AJUSTE } from "./definitions/ajuste";
import { asegurarLuts } from "./lut/biblioteca-luts";
import {
	AgregarAjuste,
	EfectosCorporales,
	MisPredefinidos,
	SeccionLut,
	vistaEfectos,
	vistaFiltros,
} from "./components/biblioteca";
import { AjustarBasico, AjustarHsl, EfectosDelClip, PanelCapa, efectosListables } from "./components/panel-color";
import type { TimelineElement } from "@/app/video-editor/_opencut/timeline";

registerDefaultEffects();
// Las LUT de la biblioteca se cargan ya: un proyecto que las usa las necesita
// en el primer cuadro (y en el export).
if (typeof window !== "undefined") void asegurarLuts();

function slug(texto: string): string {
	return texto
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase()
		.replace(/\s+/g, "-");
}

// ── Biblioteca › Efectos ─────────────────────────────────────────────────────
const EFECTOS_VIDEO = "efectos.video";
seccionesBiblioteca.registrar({
	categoria: "efectos",
	id: EFECTOS_VIDEO,
	etiqueta: "Efectos de video",
	orden: 10,
	Contenido: vistaEfectos(),
});
CATEGORIAS_EFECTO.forEach((categoria, i) =>
	seccionesBiblioteca.registrar({
		categoria: "efectos",
		padre: EFECTOS_VIDEO,
		id: `${EFECTOS_VIDEO}.${slug(categoria)}`,
		etiqueta: categoria,
		orden: 11 + i,
		Contenido: vistaEfectos(categoria),
	}),
);
seccionesBiblioteca.registrar({
	categoria: "efectos",
	id: "efectos.corporales",
	etiqueta: "Efectos corporales",
	orden: 50,
	Contenido: EfectosCorporales,
});

// ── Biblioteca › Filtros ─────────────────────────────────────────────────────
const FILTROS = "filtros.todos";
seccionesBiblioteca.registrar({
	categoria: "filtros",
	id: FILTROS,
	etiqueta: "Filtros",
	orden: 10,
	Contenido: vistaFiltros(),
});
CATEGORIAS_FILTRO.forEach((categoria, i) =>
	seccionesBiblioteca.registrar({
		categoria: "filtros",
		padre: FILTROS,
		id: `filtros.${slug(categoria)}`,
		etiqueta: categoria,
		orden: 11 + i,
		Contenido: vistaFiltros(categoria),
	}),
);

// ── Biblioteca › Ajuste ──────────────────────────────────────────────────────
seccionesBiblioteca.registrar({
	categoria: "ajuste",
	id: "ajuste.agregar",
	etiqueta: "Agregar ajuste",
	orden: 10,
	Contenido: AgregarAjuste,
});
seccionesBiblioteca.registrar({
	categoria: "ajuste",
	id: "ajuste.lut",
	etiqueta: "LUT",
	orden: 20,
	Contenido: SeccionLut,
});
seccionesBiblioteca.registrar({
	categoria: "ajuste",
	id: "ajuste.mios",
	etiqueta: "Mis elementos predefinidos",
	orden: 30,
	Contenido: MisPredefinidos,
});

// ── Panel derecho ────────────────────────────────────────────────────────────

function claseDeCapa(element: TimelineElement): string | null {
	if (element.type !== "effect" || !effectsRegistry.has(element.effectType)) return null;
	return effectsRegistry.get(element.effectType).clase ?? "efecto";
}

pestanasInspector.registrar({
	id: "ajustar",
	etiqueta: "Ajustar",
	orden: 50,
	aplica: ({ element }) =>
		element.type === "video" ||
		element.type === "image" ||
		(element.type === "effect" && element.effectType === TIPO_AJUSTE),
});
subpestanasInspector.registrar({
	pestana: "ajustar",
	id: "ajustar-basico",
	etiqueta: "Básico",
	orden: 10,
	aplica: () => true,
	Contenido: AjustarBasico,
});
subpestanasInspector.registrar({
	pestana: "ajustar",
	id: "ajustar-hsl",
	etiqueta: "HSL",
	orden: 20,
	aplica: () => true,
	Contenido: AjustarHsl,
});

pestanasInspector.registrar({
	id: "capa-filtro",
	etiqueta: "Filtros",
	orden: 10,
	aplica: ({ element }) => claseDeCapa(element) === "filtro",
	Contenido: PanelCapa,
});
pestanasInspector.registrar({
	id: "capa-efecto",
	etiqueta: "Efectos de video",
	orden: 10,
	aplica: ({ element }) => claseDeCapa(element) === "efecto",
	Contenido: PanelCapa,
});

pestanasInspector.registrar({
	id: "efectos-clip",
	etiqueta: "Efectos",
	orden: 55,
	aplica: ({ element }) =>
		"effects" in element && efectosListables(element.effects).length > 0,
	Contenido: EfectosDelClip,
});

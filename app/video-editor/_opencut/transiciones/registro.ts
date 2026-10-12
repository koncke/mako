// =============================================================================
// Lo que registra el paquete de TRANSICIONES en las ranuras del editor
// =============================================================================
// Biblioteca › Transiciones: «Transiciones ▾» (todas, por categoría) y una
// subcategoría por categoría de CapCut (Básico, Cámara, Deslizar, Máscara,
// Efecto). Panel derecho: «Transición» (orden 70, ver properties/registry.tsx)
// en el clip que tiene una transición a su derecha que rige.
//
// El gancho del render se registra al importar ./gancho (también lo importa
// ./escena, que usa el scene-builder: la escena nunca arma una transición sin él).
// Lo importa ce/extensiones.ts.

import { pestanasInspector, seccionesBiblioteca } from "@/app/video-editor/ce/ranuras";
import { CATEGORIAS_TRANSICION, transicionPorId } from "./catalogo";
import { PESTANA_TRANSICION } from "./acciones";
import { idTransicion, transicionVigente } from "./reglas";
import { vistaTransiciones } from "./components/biblioteca";
import { PanelTransicion } from "./components/panel";
import "./gancho";

const TODAS = "transiciones.todas";

const SLUG: Record<(typeof CATEGORIAS_TRANSICION)[number], string> = {
	Básico: "basico",
	Cámara: "camara",
	Deslizar: "deslizar",
	Máscara: "mascara",
	Efecto: "efecto",
};

seccionesBiblioteca.registrar({
	categoria: "transiciones",
	id: TODAS,
	etiqueta: "Transiciones",
	orden: 10,
	Contenido: vistaTransiciones(),
});
CATEGORIAS_TRANSICION.forEach((categoria, i) =>
	seccionesBiblioteca.registrar({
		categoria: "transiciones",
		padre: TODAS,
		id: `${TODAS}.${SLUG[categoria]}`,
		etiqueta: categoria,
		orden: 11 + i,
		Contenido: vistaTransiciones(categoria),
	}),
);

pestanasInspector.registrar({
	id: PESTANA_TRANSICION,
	etiqueta: "Transición",
	orden: 70,
	// La misma regla que el ⧓ de la línea de tiempo y la escena: un id que el
	// catálogo no conoce (de otra versión) no se dibuja, y tampoco se edita.
	aplica: ({ element, track }) =>
		transicionVigente(track, element) && transicionPorId(idTransicion(element)) !== null,
	Contenido: PanelTransicion,
});

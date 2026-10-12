// =============================================================================
// Audio (paquete J): lo que se enchufa en las ranuras
// =============================================================================
// Panel derecho, como CapCut 9.3 (relevamiento-capcut-armazon §5):
//
//   Clip de AUDIO    pestañas «Básico» (10) · «Modificador de voz» (20) ·
//                    «Velocidad» (30, del paquete de clips).
//   Clip de VIDEO    pestaña «Audio» (20, después de «Video») con las
//                    sub-pestañas «Básico» · «Modificador de voz», si el archivo
//                    tiene sonido. Los respaldos del panel (properties/registry)
//                    se ocultan solos al ver estos rótulos.
//
// Barra de la línea de tiempo:
//   «Grabar» a la derecha, primero (centena 0); «Marcar ritmos
//   automáticamente ◢» a la izquierda con las operaciones de clip (centena 2),
//   sólo con un clip de audio elegido.
//
// Lo importa ce/extensiones.ts.

import { Drum, Mic } from "lucide-react";
import {
	herramientasLinea,
	pestanasInspector,
	subpestanasInspector,
	type ContextoInspector,
} from "@/app/video-editor/ce/ranuras";
import { AudioBasico } from "./components/basico";
import { ModificadorVoz } from "./components/modificador-voz";
import { ControlGrabar } from "./components/grabar";
import { ControlRitmos, audioElegido, marcarAutomaticos } from "./components/ritmos";
import { AudioVideoBasico, AudioVideoVoz } from "./components/audio-de-video";

const tieneSonido = ({ element, mediaAssets }: ContextoInspector) =>
	element.type === "video" && mediaAssets.find((a) => a.id === element.mediaId)?.hasAudio !== false;

// ── Clip de audio ────────────────────────────────────────────────────────────

pestanasInspector.registrar({
	id: "audio-basico",
	etiqueta: "Básico",
	orden: 10,
	aplica: ({ element }) => element.type === "audio",
	Contenido: AudioBasico,
});

pestanasInspector.registrar({
	id: "audio-voz",
	etiqueta: "Modificador de voz",
	orden: 20,
	aplica: ({ element }) => element.type === "audio",
	Contenido: ModificadorVoz,
});

// ── Clip de video con sonido ─────────────────────────────────────────────────

pestanasInspector.registrar({
	id: "audio",
	etiqueta: "Audio",
	orden: 20,
	aplica: tieneSonido,
});

subpestanasInspector.registrar({
	pestana: "audio",
	id: "audio-video-basico",
	etiqueta: "Básico",
	orden: 10,
	aplica: () => true,
	Contenido: AudioVideoBasico,
});

subpestanasInspector.registrar({
	pestana: "audio",
	id: "audio-video-voz",
	etiqueta: "Modificador de voz",
	orden: 20,
	aplica: () => true,
	Contenido: AudioVideoVoz,
});

// ── Barra de la línea de tiempo ──────────────────────────────────────────────

herramientasLinea.registrar({
	id: "audio-grabar",
	etiqueta: "Grabar",
	orden: 10,
	lado: "derecha",
	Icono: Mic,
	habilitada: () => true,
	ejecutar: () => {},
	Control: ControlGrabar,
});

herramientasLinea.registrar({
	id: "audio-ritmos",
	etiqueta: "Marcar ritmos automáticamente",
	orden: 290,
	lado: "izquierda",
	Icono: Drum,
	visible: (ctx) => audioElegido(ctx) !== null,
	habilitada: (ctx) => audioElegido(ctx) !== null,
	ejecutar: (ctx) => void marcarAutomaticos(ctx, "1"),
	Control: ControlRitmos,
});

// =============================================================================
// Las pestañas del panel derecho que registra ESTE paquete
// =============================================================================
// La cáscara (./index.tsx) dibuja lo que haya en las ranuras de ce/ranuras.ts.
// Acá se registran:
//
//   «Video» (video, imagen, sticker, forma) con las sub-pestañas «Básico» y
//   «Máscara» (la máscara sólo donde el motor la admite: video, imagen, forma).
//   «Formas» (forma): relleno, trazo y radio, el panel de formas de CapCut.
//   Los RESPALDOS (./respaldo.ts): «Texto», «Básico» del audio, «Audio» del
//   clip de video y «Efectos», que se ocultan solos cuando el paquete dueño
//   registra la pestaña con ese rótulo.
//
// El ORDEN sigue al de CapCut. Para que las pestañas de los demás paquetes
// caigan en su lugar sin coordinar:
//   Formas 5 · Video 10 · Audio 20 · Velocidad 30 · Animación 40 · Ajustar 50 ·
//   Texto a voz 60 · Transición 70 (y «Texto» 10 para el elemento de texto).
//   Sub-pestañas de «Video»: Básico 10 · Eliminar fondo 20 · Máscara 30 · Retoque 40.
//
// Lo importa ce/extensiones.ts (y la cáscara, por las dudas).

import { pestanasInspector, subpestanasInspector } from "@/app/video-editor/ce/ranuras";
import { isMaskableElement } from "@/app/video-editor/_opencut/timeline/element-utils";
import { MascaraCe } from "@/app/video-editor/_opencut/masks/components/masks-tab";
import { FormaCe } from "@/app/video-editor/_opencut/graphics/components/graphic-tab";
import { VideoBasico } from "./video/basico";
import { marcarRespaldo } from "./respaldo";
import { RespaldoAudio, RespaldoEfecto, RespaldoTexto } from "./respaldo-contenido";

const TIPOS_VIDEO = new Set(["video", "image", "sticker", "graphic"]);

pestanasInspector.registrar({
	id: "video",
	etiqueta: "Video",
	orden: 10,
	aplica: ({ element }) => TIPOS_VIDEO.has(element.type),
});

subpestanasInspector.registrar({
	pestana: "video",
	id: "video-basico",
	etiqueta: "Básico",
	orden: 10,
	aplica: () => true,
	Contenido: VideoBasico,
});

// El id "masks" es el que lee el overlay del reproductor para entrar en modo
// máscara (stores/properties-store.ts). No cambiarlo.
subpestanasInspector.registrar({
	pestana: "video",
	id: "masks",
	etiqueta: "Máscara",
	orden: 30,
	aplica: ({ element }) => isMaskableElement(element),
	Contenido: MascaraCe,
});

pestanasInspector.registrar({
	id: "formas",
	etiqueta: "Formas",
	orden: 5,
	aplica: ({ element }) => element.type === "graphic",
	Contenido: FormaCe,
});

// ── Respaldos ────────────────────────────────────────────────────────────────
// Van en el orden de la pestaña que reemplazan: la primera de la fila es la que
// se abre al elegir el elemento, y un texto o un audio tienen que abrir en
// «Texto» / «Básico» (no en «Texto a voz» o «Velocidad», que llegaron antes).

pestanasInspector.registrar({
	id: "respaldo-texto",
	etiqueta: "Texto",
	orden: 10,
	aplica: ({ element }) => element.type === "text",
	Contenido: RespaldoTexto,
});
marcarRespaldo("respaldo-texto", { reemplazadaPor: ["Texto"] });

pestanasInspector.registrar({
	id: "respaldo-audio",
	etiqueta: "Básico",
	orden: 10,
	aplica: ({ element }) => element.type === "audio",
	Contenido: RespaldoAudio,
});
marcarRespaldo("respaldo-audio", { reemplazadaPor: ["Básico", "Audio"] });

// El «Audio» de un clip de video va donde lo pone CapCut (después de «Video»), y
// sólo si el archivo tiene sonido.
pestanasInspector.registrar({
	id: "respaldo-audio-video",
	etiqueta: "Audio",
	orden: 20,
	aplica: ({ element, mediaAssets }) =>
		element.type === "video" &&
		mediaAssets.find((a) => a.id === element.mediaId)?.hasAudio !== false,
	Contenido: RespaldoAudio,
});
marcarRespaldo("respaldo-audio-video", { reemplazadaPor: ["Audio"] });

pestanasInspector.registrar({
	id: "respaldo-efecto",
	etiqueta: "Efectos",
	orden: 900,
	aplica: ({ element }) => element.type === "effect",
	Contenido: RespaldoEfecto,
});
marcarRespaldo("respaldo-efecto", { reemplazadaPor: null });

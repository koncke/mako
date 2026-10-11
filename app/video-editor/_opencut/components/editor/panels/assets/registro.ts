// =============================================================================
// Las secciones de la biblioteca que trae el paquete de la biblioteca
// =============================================================================
// Multimedia, Audio, Texto › Agregar texto y Stickers. Efectos, Filtros y Ajuste
// los registra effects/; Transiciones, transiciones/; Subtítulos, subtitles/; los
// estilos de texto, text/. Rótulos del es-LA.po de CapCut 9.3.
//
// `orden` deja huecos para que los demás paquetes intercalen las suyas: en Texto,
// «Agregar texto» es 10 y lo que sigue en CapCut (Efectos de texto, Plantilla de
// texto, Subtítulos automáticos) va de 20 en adelante.

import { seccionesBiblioteca } from "@/app/video-editor/ce/ranuras";
import { SECCION_IMPORTAR_MEDIOS } from "./assets-panel-store";
import { MediaView } from "./views/assets";
import {
	AudioImportarView,
	EfectosDeSonidoView,
	ExtraerAudioView,
	MusicaView,
	SECCION_AUDIO_IMPORTAR,
} from "@/app/video-editor/_opencut/sounds/components/assets-view";
import { TextView } from "@/app/video-editor/_opencut/text/components/assets-view";
import {
	SECCIONES_STICKERS,
	StickersBanderasView,
	StickersEmojisView,
	StickersFormasView,
	StickersTendenciasView,
	StickersView,
} from "@/app/video-editor/_opencut/stickers/components/assets-view";

// ── Multimedia ───────────────────────────────────────────────────────────────
seccionesBiblioteca.registrar({
	categoria: "multimedia",
	id: SECCION_IMPORTAR_MEDIOS,
	etiqueta: "Importar",
	orden: 10,
	Contenido: MediaView,
});

// ── Audio ────────────────────────────────────────────────────────────────────
seccionesBiblioteca.registrar({
	categoria: "audio",
	id: SECCION_AUDIO_IMPORTAR,
	etiqueta: "Importar",
	orden: 10,
	Contenido: AudioImportarView,
});
seccionesBiblioteca.registrar({
	categoria: "audio",
	id: "audio.extraer",
	etiqueta: "Extraer audio",
	orden: 20,
	Contenido: ExtraerAudioView,
});
seccionesBiblioteca.registrar({
	categoria: "audio",
	id: "audio.musica",
	etiqueta: "Música",
	orden: 30,
	Contenido: MusicaView,
});
seccionesBiblioteca.registrar({
	categoria: "audio",
	id: "audio.efectos-de-sonido",
	etiqueta: "Efectos de sonido",
	orden: 40,
	Contenido: EfectosDeSonidoView,
});

// ── Texto ────────────────────────────────────────────────────────────────────
seccionesBiblioteca.registrar({
	categoria: "texto",
	id: "texto.agregar",
	etiqueta: "Agregar texto",
	orden: 10,
	Contenido: TextView,
});

// ── Stickers ▾ (Tendencias · Emojis · Formas · Banderas) ─────────────────────
seccionesBiblioteca.registrar({
	categoria: "stickers",
	id: SECCIONES_STICKERS.todos,
	etiqueta: "Stickers",
	orden: 10,
	Contenido: StickersView,
});
const hijosStickers = [
	{ id: SECCIONES_STICKERS.tendencias, etiqueta: "Tendencias", Contenido: StickersTendenciasView },
	{ id: SECCIONES_STICKERS.emojis, etiqueta: "Emojis", Contenido: StickersEmojisView },
	{ id: SECCIONES_STICKERS.formas, etiqueta: "Formas", Contenido: StickersFormasView },
	{ id: SECCIONES_STICKERS.banderas, etiqueta: "Banderas", Contenido: StickersBanderasView },
];
hijosStickers.forEach((hijo, i) =>
	seccionesBiblioteca.registrar({
		categoria: "stickers",
		padre: SECCIONES_STICKERS.todos,
		orden: 11 + i,
		...hijo,
	}),
);

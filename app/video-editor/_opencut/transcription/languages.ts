// =============================================================================
// «Idioma de origen» de Subtítulos automáticos
// =============================================================================
// Los 17 idiomas que reconoce CapCut (`Resources/icon/cc_caption_duration_info_
// <idioma>.json`, relevamiento-capcut-funciones §5.1), con su nombre del es-LA.po
// (`cc_language_*`) y el código que entiende Whisper. Whisper reconoce ~100: la
// lista es la de CapCut, no la del modelo.
//
// «Chino tradicional» va con `zh`: Whisper no separa tradicional de simplificado
// (escribe el que más vio para ese audio).

export const LANGUAGES = [
	{ code: "es", name: "Español" },
	{ code: "en", name: "Inglés" },
	{ code: "pt", name: "Portugués" },
	{ code: "fr", name: "Francés" },
	{ code: "de", name: "Alemán" },
	{ code: "it", name: "Italiano" },
	{ code: "ar", name: "Árabe" },
	{ code: "zh", name: "Chino tradicional" },
	{ code: "ko", name: "Coreano" },
	{ code: "tl", name: "Filipino" },
	{ code: "id", name: "Indonesio" },
	{ code: "ja", name: "Japonés" },
	{ code: "ms", name: "Malayo" },
	{ code: "ru", name: "Ruso" },
	{ code: "th", name: "Tailandés" },
	{ code: "tr", name: "Turco" },
	{ code: "vi", name: "Vietnamita" },
] as const;

export type Language = (typeof LANGUAGES)[number];
export type LanguageCode = Language["code"];

/** `pc_caption_menu_auto_identify_language`. */
export const ROTULO_DETECTAR = "Detectar automáticamente";

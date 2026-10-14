// =============================================================================
// editor-landing/lectura-tipos — una página LEÍDA EN EL NAVEGADOR de la persona (tanda 6, tipos)
// =============================================================================
// Pedido de Martín (14/10/2026): «El mimso error que nos saltaba con Mauricio "No pude leer el texto
// de esa página". Soluciona eso...». Y su decisión del mismo día sobre CÓMO: leer la landing «como un
// visitante» (abrir los desplegables, anotar a dónde lleva cada botón SIN seguirlo, ver si el
// calendario carga SIN reservar) se hace en el navegador de la persona: «Haz ambas opciones
// disponibles, si detecta que tenes el pixel instalado, que lo haga desde allí y sino desde la
// ventana emergente».
//
// Acá viven sólo los TIPOS del contrato entre el lector (que corre en la página, en el navegador) y
// las tres entradas del server que aceptan su lectura en vez de bajar la página: el esquema de
// «Importar» (lib/editor-landing/ia.ts), el análisis del Diagnóstico (diagnostico-server.ts →
// lib/landing-analyst.ts) y «Replicar» (replicar.ts). Puro, sin server-only: lo importan la
// pantalla, las rutas y los tests. El saneo de lo que llega vive en lectura-reglas.ts.
//
// ⚠️ LO QUE MANDA EL NAVEGADOR ES DE LA PÁGINA DE UN TERCERO: texto e interacciones son contenido no
//    confiable (van al prompt adentro de `contenidoNoConfiable`) y llegan con topes.
// =============================================================================

/**
 * Una cosa que el lector PROBÓ en la página, sin consecuencias (un clic con preventDefault, nada que
 * se envíe ni se reserve). `tipo` es libre a propósito (el lector puede sumar uno sin tocar el
 * server); los que el análisis reconoce y cómo los dice están en `lineaDeInteraccion`
 * (lectura-reglas.ts):
 *   · 'boton'       un botón o link de acción: `texto` su rótulo, `destino` a dónde lleva (sin seguirlo);
 *   · 'desplegable' un desplegable que se abrió: `texto` su pregunta;
 *   · 'calendario'  un calendario embebido (Calendly, Cal.com, GHL): `texto` «cargó» o «no cargó»
 *                   (con el proveedor), `destino` su dirección;
 *   · 'formulario'  un formulario: `texto` su botón de enviar, `destino` a dónde manda;
 *   · 'video'       un video: `texto` el proveedor o «no cargó».
 */
export type InteraccionLectura = { tipo: string; texto: string; destino?: string };

/**
 * La página como la leyó el navegador. `texto`: el copy en el orden de lectura, una cosa por línea, con
 * las marcas del extractor del server (`textoDeBloques`, lib/landing-extraer.ts: `# título`,
 * `[BOTÓN] rótulo`, `• renglón`, `[PREGUNTA] pregunta`) o las del lector, que sabe más porque abrió
 * los desplegables (`armarTextoLectura`, lector.ts: `[DESPLEGABLE] pregunta → respuesta`,
 * `[BOTÓN] rótulo → destino`). El server no las interpreta: van tal cual al modelo, como texto de la
 * página.
 */
export type Lectura = { texto: string; interacciones: InteraccionLectura[]; fuente: 'navegador' };

/**
 * Por qué el server no pudo leer una página que en el navegador de la persona SÍ se lee:
 *   · 'se-arma-en-navegador'  el HTML llega sin texto (una app de React/Vite/Lovable, Framer…);
 *   · 'bloquea-lectura'       la página le contesta 401/403/406/429 a nuestro servidor (un antibots).
 */
export const MOTIVOS_EN_NAVEGADOR = ['se-arma-en-navegador', 'bloquea-lectura'] as const;
export type MotivoEnNavegador = (typeof MOTIVOS_EN_NAVEGADOR)[number];

/**
 * La parte de una falla que dice «léela en el navegador o pega el texto». La suman las respuestas de
 * las tres rutas (ia en modo importar, diagnóstico, replicar) al `{ ok: false, error }` de siempre:
 * `pegable` sigue siendo lo que la pantalla ya entendía (ofrecer pegar el texto) y `enNavegador`
 * suma la otra salida (el lector).
 */
export type SeLeeEnNavegador = { pegable: true; enNavegador: true; motivo: MotivoEnNavegador };
export type FallaEnNavegador = { ok: false; error: string } & SeLeeEnNavegador;

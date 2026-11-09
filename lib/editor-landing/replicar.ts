// =============================================================================
// editor-landing/replicar — «Replicar en el editor» una landing de AFUERA (tanda 2, puntos 8 y 9)
// =============================================================================
// Pedido de Martín (11/10/2026, tanda 2): «si traigo una landing de afuera […] me gustaría si es una
// landing de afuera tener la opción de replicarla con nuestro editor» y «Si se tiene que poder editar
// libremente con "HTML personalizado", esto permitirá copiar otras landing». Decisiones T5/T6 en
// docs/diseno-editor-landing.md. Lo puro (cómo se parte el HTML, qué se saca, el contenido, la receta
// de cada formato) vive en replicar-reglas.ts, con test; acá está lo que baja, llama a la IA y crea la
// landing.
//
// Tanda 6 (14/10/2026), decisión de Martín: «Replicar» pregunta 3 FORMATOS — Presentación
// (diapositivas), Landing (secciones editables) y Página web (la copia idéntica de hoy) — y ninguno
// pone fotos de stock al azar (`configDeReplica`). Los tres van por dos caminos:
//
//   · por bloques (Presentación y Landing): el esquema en modo «importar» (el extractor, con su guarda
//     anti-SSRF, la URL TAL CUAL) y las secciones de la IA en tandas de 3 (`secciones`, ia.ts).
//     Landing usa «Conservar» (el texto tal cual, sin IA en el esquema); Presentación, «Condensar» en
//     diapositivas 16:9. Las tandas van de a DOS en paralelo (una sola key de Gemini no aguanta más:
//     AGENTS.md, «N llamadas grandes en paralelo… 429») y con un plazo total: la que no entra queda
//     armada desde el esquema (`tarjetaDesdeEsquema`) y el aviso lo dice — nunca con secciones de menos.
//     Si la página no se lee desde el server (se arma en el navegador, o nos rechaza), la falla trae
//     `enNavegador` y la pantalla vuelve con la `lectura` del navegador o el `texto` pegado.
//   · fiel (Página web): baja el HTML con `htmlDePagina` (lib/landing-fetch.ts: IP clavada,
//     redirecciones revalidadas, tope de tamaño y de tiempo; la URL tal cual) y arma una sección «HTML
//     personalizado» por parte de la página (`copiaFiel`). Necesita el HTML: una lectura del navegador
//     no le sirve.
//
// Todas crean la landing con `crear` (server.ts): el saneo, el workspace de la sesión y el autor son
// los de siempre, y nacen con el formato y el origen de su receta. Devuelven su id; la pantalla la abre
// en el editor. La usan la ruta (app/api/landing-generator/replicar) y la API de MaKo
// (`replicar_landing`, lib/api-mako/areas/landing.run.ts).
//
// Tanda 6 (14/10/2026), la otra mitad de la decisión (d): «Al replicar como landing se COPIA el estilo
// (colores y fuentes leídos en el navegador → tema propio; imágenes al bucket), nada de fotos de stock».
// Por bloques (Presentación y Landing), mientras la IA arma las secciones:
//   · el ESTILO de la original sale de la lectura del navegador (`lectura.estilo`, los estilos
//     computados) o, si no vino, del HTML y las hojas que baja el server (`estiloDeLaPagina`);
//   · se guarda como un TEMA PROPIO del workspace («Estilo de <sitio>», `temaDeEstilo`) y la landing nace
//     con él; el mismo estilo replicado dos veces reusa el tema (su id sale del contenido);
//   · las imágenes de la original se copian a NUESTRO bucket (`subirImagenes`) y van a las secciones que
//     las tenían, con los fondos de sección distintos (`aplicarEstilo`). La que no se copia deja el
//     marcador de hoy. La Página web (copia fiel) no cambia: ya lleva el HTML y los estilos de la original.
//
// Tanda 8 (Martín, 14/10/2026: «poder replicarlas al copiar una web»; el aviso, decidido el 15/10): las ANIMACIONES.
//   · Landing: las señales de la original viajan en el estilo (`estilo.animaciones`, replicar-animaciones.ts) y la
//     landing nace con su estilo de animación y el efecto propio de las secciones que no lo siguen;
//   · Página web: el HTML ya trae lo suyo; lo atado al scroll no corre en la copia y se avisa (`scrollDeLaPagina`);
//   · Presentación: nada (las diapositivas no se recorren con el scroll).
// Si la original seguía al scroll, el resultado lo dice en UNA línea (`AVISO_SCROLL`, en `aviso` y `avisoScroll`).
//
// 28/10/2026 (Martín: «una cosa es replicar el branding, otra cosa es replicar la estructura, otra cosa es replicar los
// ángulos de comunicación, los copies»): QUÉ se replica, por PARTES (replicar-partes.ts): diseño, estructura, ángulos y
// texto. `partes` en el pedido; sin el campo, lo de siempre (`adaptar` → diseño + estructura + ángulos; si no, todo).
//   · sin el diseño: ni el tema de la original, ni sus imágenes, ni sus animaciones: la landing nace con el TEMA que
//     eligió la persona (`tema`: uno del catálogo o uno propio del negocio; `temaDeLaPersona`);
//   · con la estructura y sin el texto: el esquema es el de la página y la tanda de secciones lo escribe de nuevo con el
//     MOLDE de cada sección (la cantidad de títulos, párrafos, viñetas y botones) y los ÁNGULOS;
//   · sin la estructura: la IA arma el esquema para la oferta del negocio, con los ángulos si se pidieron;
//   · los ángulos llegan de la lectura que vio la persona (`angulos`, replicar-lectura.ts) o se leen acá.
// La fidelidad de la estructura (las secciones, los títulos y los párrafos contra la original) va al log.
// =============================================================================

import 'server-only';
import { esDesafioDeBot, paginaConDireccion } from '../landing-fetch';
import { getWorkspaceActual } from '../workspace';
import { conMemoriaDelPedido } from '../ia-saturacion';
import { crear, guardarTema, temasPropiosDe } from './server';
import { esquema as pedirEsquema, secciones as pedirSecciones } from './ia';
import { quitarPruebaDeLaOriginal, tandasDe, tarjetaDesdeEsquema } from './ia-reglas';
import { TOPES, nuevoId, textoDe, type JsonNodo, type LandingContenido } from './doc';
import { sanearEnvoltorios, sanearHtmlEditable } from './html-editable-seguro';
import { textoDeHtmlEditable } from './html-editable';
import {
  clasesDe, contenidoDeCopiaIdentica, fichasDeHtml, hojaDeLaFoto, partirParaCopia, podarCss, sanearInstantanea, sinDestinosAjenos,
} from './copia-identica';
import { CONFIG_DEFAULT, terminoTarjeta, type ConfigLanding, type Esquema, type TemaPropio } from './api-tipos';
import { motivoDeError, seLeeEnNavegador } from './lectura-reglas';
import {
  ERROR_ADAPTAR_WEB, baseDeDocumento, configDeReplica, contenidoDeCopiaFiel, copiaFiel, formatoReplicar, urlParaReplicar,
  type ConfigReplica, type FormatoReplicar, type RespuestaReplicar,
} from './replicar-reglas';
import { estiloDeLectura, hojasDeHtml, temaDeEstilo, type EstiloOriginal } from './estilo-original';
import { TOPES_IMAGENES_REPLICA, aplicarEstilo, asignarSecciones, imagenesParaSubir, imagenesQueFaltan, partesDeCadaSeccion } from './estilo-aplicar';
import { bajarHoja, estiloDeLaPagina, subirImagenes } from './estilo-server';
import { colorDeRelleno, temaPorId } from './temas';
import { AVISO_SCROLL, animacionesDeReplica, conAnimaciones, scrollEnCss, scrollEnHtml } from './replicar-animaciones';
import {
  ERROR_WEB_PARCIAL, PEDIDO_SIN_ESTRUCTURA, TOPE_OFERTA, formatoConPartes, instruccionDePartes, listaDePartes, marcaDeUrl, mencionesDe,
  nombreDeCopia, partesDePedido, recetaDePartes, enlacesDeLaOriginal, sinDestinoDeBoton, sinEnlacesALaOriginal, type PartesReplica,
} from './replicar-partes';
import {
  acomodoDeSeccion, esquemaDeReplica, fidelidadDeEstructura, imagenesPorSeccion, lineaDeFidelidad, moldeDeEsquema, notaDeSeccion,
} from './replicar-estructura';
import { NOMBRE_TIPO_SECCION, sanearAngulos, textoDeAngulos, type Angulos } from './replicar-angulos';
import { angulosDePagina, textoDePagina } from './replicar-lectura';
import { TEMAS } from './temas';
import type { AlProgreso, EventoReplica } from './replicar-progreso';

export type ResultadoReplicar = RespuestaReplicar & { status?: number };

/** Lo que se espera a los ángulos cuando no vinieron con el pedido (la lectura de la pantalla ya los trae). */
const PLAZO_ANGULOS_MS = 60_000;
/** Plazo total por bloques: por debajo del `maxDuration` de la ruta (300 s), con aire para crear. */
const PLAZO_BLOQUES_MS = 240_000;
/** Lo que tarda como mucho una tanda (`PLAZOS.secciones.total` de ia.ts, 57 s, con margen). */
const TANDA_MS = 60_000;
/** Tandas a la vez. */
const EN_PARALELO = 2;
/** El texto pegado que se acepta (el de un esquema, `MAX_TEXTO_ENTRADA`: ia.ts lo vuelve a cortar). */
const MAX_TEXTO = 60_000;
/**
 * Hasta cuándo se copian imágenes de la original: después de las tandas, con aire para guardar el tema
 * y crear antes del `maxDuration` de la ruta (300 s). `subirImagenes` no empieza una que no termina.
 */
const PLAZO_IMAGENES_MS = 265_000;

/** `probar`: el formato que sí puede andar, cuando el error lo propone (la pantalla lo ofrece como botón). */
const falla = (error: string, status = 400, probar?: FormatoReplicar): ResultadoReplicar => ({ ok: false, error, status, ...(probar ? { probar } : {}) });

/**
 * Lo que llega del pedido, sin forma confiable. `formato` manda; sin él, el `modo` viejo (tanda 2).
 * `lectura` / `texto` reemplazan la bajada (sólo por bloques).
 */
export type EntradaReplicar = {
  url: unknown; formato?: unknown; modo?: unknown; lectura?: unknown; texto?: unknown; adaptar?: unknown;
  /** 28/10/2026: qué se replica (replicar-partes.ts); el tema de la persona cuando el diseño no se copia; los ángulos ya leídos. */
  partes?: unknown; tema?: unknown; angulos?: unknown;
  /** «Tu oferta» (28/10/2026): de qué habla la copia cuando el texto se escribe de nuevo. Manda sobre el perfil. */
  oferta?: unknown;
  /**
   * La FOTO de la página ya armada (28/10/2026, copia-identica-script.ts): la sacó el lector en el navegador de la persona.
   * Con ella, la «Página web» es la copia idéntica EDITABLE; sin ella (la API de MaKo, que no tiene navegador), la de antes.
   */
  foto?: unknown;
};

/**
 * Replica la landing de `url` en una landing nueva del workspace de la sesión. `alProgreso` (28/10/2026, «se ve
 * CONSTRUYÉNDOSE»): recibe una línea por cosa armada, en el orden en que se armó (replicar-progreso.ts). Un error al
 * avisar nunca corta la réplica.
 */
export async function replicar(p: EntradaReplicar, alProgreso?: AlProgreso): Promise<ResultadoReplicar> {
  const avisar = (e: EventoReplica) => { try { alProgreso?.(e); } catch { /* mostrar no frena el trabajo */ } };
  const url = urlParaReplicar(p.url);
  if (!url) return falla('Pega un enlace válido.');
  const formato = formatoReplicar(p.formato, p.modo);
  if (!formato) return falla('Elige el formato: Presentación, Landing o Página web.');
  // «Replicar y adaptar» (27/10/2026): sólo por bloques; la copia idéntica ofrece «Landing».
  if (p.adaptar === true && formato === 'web') return falla(ERROR_ADAPTAR_WEB, 400, 'landing');
  const partes = partesDePedido(p.partes, p.adaptar === true);
  if (!partes) return falla('Elige qué replicar: diseño, estructura, ángulos o texto.');
  if (!formatoConPartes(formato, partes)) return falla(ERROR_WEB_PARCIAL, 400, 'landing');
  const receta = configDeReplica(formato, url, { adaptar: p.adaptar === true });
  if (receta.via === 'fiel') return p.foto !== undefined && p.foto !== null ? replicarIdentica(url, p.foto, receta, avisar) : replicarFiel(url, receta);
  const texto = typeof p.texto === 'string' ? p.texto.trim().slice(0, MAX_TEXTO) : '';
  // Con memoria de cuelgues PROPIA (lib/ia-saturacion.ts): el modelo que se colgó en una tanda va al final de la lista en las
  // tandas que siguen y en la segunda vuelta de ESTA réplica, sin degradar a ningún otro pedido.
  const oferta = typeof p.oferta === 'string' ? p.oferta.trim().slice(0, TOPE_OFERTA) : '';
  return conMemoriaDelPedido(() => replicarComoBloques(url, receta, partes, { lectura: p.lectura, texto, angulos: p.angulos, tema: p.tema, oferta }, avisar));
}

/** El dominio de la página, sin `www.` (el nombre de una copia adaptada). */
const hostDe = (url: string): string => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } };

async function crearLanding(titulo: string, contenido: LandingContenido, config: Partial<ConfigLanding>): Promise<{ id: number; titulo: string } | ResultadoReplicar> {
  const r = await crear({ accion: 'crear', titulo, contenido, config });
  if (!r.ok) return falla(r.error, r.status);
  return { id: r.doc.id, titulo: r.doc.titulo };
}

// ─────────────────────────────────────────────────────────────────────────────
// Página web (la copia fiel)
// ─────────────────────────────────────────────────────────────────────────────

async function replicarFiel(url: string, receta: ConfigReplica): Promise<ResultadoReplicar> {
  let html: string;
  // La dirección FINAL, para lo relativo (`baseDeDocumento`); `url` sigue siendo la que pegó la persona.
  let final: string;
  try {
    // TAL CUAL: `claveDeLanding` le saca el www, y hay hosts que sólo existen con www.
    ({ html, final } = await paginaConDireccion(url, { talCual: true }));
  } catch (e) {
    // Una página que nos rechaza se lee en el navegador de la persona, pero la copia idéntica necesita
    // su HTML: la salida es el formato que copia el texto.
    if (motivoDeError(e)) return falla('Esta página no deja que MaKo la copie tal cual. Prueba el formato «Landing».', 422, 'landing');
    // landing-fetch ya escribe el motivo para una persona («La página respondió 404…»).
    return falla(e instanceof Error ? e.message : 'No pude abrir esa página.', 502);
  }
  const copia = copiaFiel(html, final);
  // `probar`: el formato que sí puede (una app de Vite o Lovable, un login, una página que no entra); la
  // pantalla lo ofrece como botón.
  if (!copia.ok) return falla(copia.error, 422, copia.probar);
  // Tanda 8: el HTML original ya trae sus animaciones, pero lo atado al scroll NO corre en la copia (medido: el
  // iframe de alto ajustado no scrollea). Se mira en su HTML y sus hojas MIENTRAS se crea, y el resultado lo dice.
  const scrollP = scrollDeLaPagina(html, final);
  const creada = await crearLanding(copia.titulo, contenidoDeCopiaFiel(copia.documentos, copia.partida), receta.config);
  if ('ok' in creada) return creada;
  const scroll = await scrollP;
  console.log(`[editor-landing/replicar] copia fiel de ${url} → #${creada.id} (${copia.documentos.length} sección(es)${scroll ? ', con efectos de scroll' : ''})`);
  const avisos = [copia.partida ? '' : 'Quedó en una sola sección.', scroll ? AVISO_SCROLL : ''].filter(Boolean);
  return {
    ok: true, id: creada.id, titulo: creada.titulo, secciones: copia.documentos.length, formato: receta.formato,
    ...(avisos.length ? { aviso: avisos.join(' ') } : {}),
    ...(scroll ? { avisoScroll: true as const } : {}),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// La copia idéntica (la foto del navegador → secciones «Diseño editable»)
// ─────────────────────────────────────────────────────────────────────────────

/** El nombre de una sección de la copia para verla armarse: su primer título, o su primer texto. */
function rotuloDeCopia(html: string, i: number): string {
  const h = /<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]>/i.exec(html)?.[1];
  const t = (h ? textoDeHtmlEditable(h) : '') || textoDeHtmlEditable(html);
  const corto = t.replace(/\s+/g, ' ').trim().slice(0, 70);
  return corto || `Sección ${i + 1}`;
}

/**
 * La copia idéntica (28/10/2026, Martín: «Enfocate primero en replicar tal cual, tanto en diseño como copy»): el DOM que armó
 * la página, sin su JavaScript, con SUS hojas podadas, partido en secciones «Diseño editable» que se tocan a la vista. El
 * texto es el de la página, palabra por palabra y en su idioma: nada pasa por una IA. Las imágenes y las fuentes quedan en
 * SU sitio (por su URL): la política de la página publicada deja pasar esos orígenes (`origenesDeMedios`).
 */
async function replicarIdentica(url: string, fotoCruda: unknown, receta: ConfigReplica, avisar: (e: EventoReplica) => void): Promise<ResultadoReplicar> {
  const t0 = Date.now();
  avisar({ fase: 'leer' });
  const foto = sanearInstantanea(fotoCruda);
  if (!foto) return falla('No llegó la foto de la página. Vuelve a intentar.', 400);
  // La foto de la extensión sale en la pestaña real (9/11/2026, replica-extension-script.ts): si lo que se veía era la
  // verificación de un antibots («Just a moment...»), eso no es la página. La pantalla ya lo mira antes de mandarla
  // (`juzgarEntrega`); esto es la red por si llega igual. La ventana del lector nunca la trae: el servidor no la baja.
  if (esDesafioDeBot(`<title>${foto.titulo}</title>${foto.cuerpo.slice(0, 30_000)}`)) return falla('Lo que se copió era la verificación de la página, no la página. Pásala y vuelve a copiarla.', 422);
  const hoja = await hojaDeLaFoto(foto, bajarHoja);
  const crudas = partirParaCopia(foto);
  // Una sección que pasa el tope de un «Diseño editable» no entra entera: se dice, no se corta a medias.
  // Y lo que llevaría a la otra (sus enlaces, su agenda) pasa a «#» o se va (`sinDestinosAjenos`, verificación de 5004dba08).
  let enlacesAjenos = 0;
  let agendasAjenas = 0;
  const secciones = crudas.map((s) => {
    const limpio = s.html.length > TOPES.htmlEditable ? '' : sanearHtmlEditable(s.html);
    const d = sinDestinosAjenos(limpio);
    enlacesAjenos += d.enlaces;
    agendasAjenas += d.agendas;
    return { html: d.html, envoltorios: sanearEnvoltorios(s.envoltorios) ?? [] };
  });
  const fuera = secciones.filter((s) => !s.html).length;
  const quedan = secciones.filter((s) => s.html);
  if (!quedan.length) return falla('La página pesa demasiado para copiarla tal cual.', 422);
  const rotulos = quedan.map((s, i) => rotuloDeCopia(s.html, i));
  avisar({ fase: 'esquema', secciones: rotulos });
  const fichas = fichasDeHtml(quedan.map((s) => s.envoltorios.join('') + s.html).join(''));
  const podada = podarCss(hoja.css, fichas, clasesDe(foto.html.clase), clasesDe(foto.body.clase));
  if (podada.despues > TOPES.cssDiseno) return falla('Los estilos de esta página pesan demasiado para copiarla tal cual.', 422);
  rotulos.forEach((titulo, indice) => avisar({ fase: 'seccion', indice, titulo }));
  avisar({ fase: 'diseno' });
  const titulo = (foto.titulo || hostDe(url)).replace(/\s+/g, ' ').trim().slice(0, TOPES.titulo);
  const creada = await crearLanding(titulo, contenidoDeCopiaIdentica(quedan), { ...receta.config, diseno: { css: podada.css, sinBase: true } });
  if ('ok' in creada) return creada;
  const m = foto.medidas;
  console.log(`[editor-landing/replicar] copia idéntica de ${url} → #${creada.id} (${quedan.length} secciones, ${fuera} fuera de tope; hoja ${podada.antes} → ${podada.despues}, ${hoja.bajadas} bajadas, ${hoja.fallidas.length} fallidas; ${m.imagenes} imágenes, ${m.campos} campos, ${m.marcos} marcos, ${m.lienzos} lienzos; ${Math.round((Date.now() - t0) / 1000)} s)`);
  const avisos = [
    fuera ? (fuera === 1 ? 'Una sección pesaba demasiado y no se copió.' : `${fuera} secciones pesaban demasiado y no se copiaron.`) : '',
    m.campos ? 'Los formularios se copiaron como dibujo: no envían nada. Pon el tuyo.' : '',
    enlacesAjenos ? (enlacesAjenos === 1 ? 'Un enlace llevaba a la original: ahora va a «#», pon el tuyo.' : `${enlacesAjenos} enlaces llevaban a la original: ahora van a «#», pon los tuyos.`) : '',
    agendasAjenas ? 'La agenda de la original se sacó (quedó su lugar vacío): pon la tuya.' : '',
    hoja.fallidas.length ? 'Una hoja de estilos de la original no se pudo bajar: algo puede verse distinto.' : '',
  ].filter(Boolean);
  return {
    ok: true, id: creada.id, titulo: creada.titulo, secciones: quedan.length, formato: receta.formato,
    ...(avisos.length ? { aviso: avisos.join(' ') } : {}),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Presentación y Landing (por bloques)
// ─────────────────────────────────────────────────────────────────────────────

/** Lo que llega del pedido para armar la réplica por bloques (lo pegado, la lectura del navegador, lo de las partes). */
type EntradaBloques = { lectura: unknown; texto: string; angulos?: unknown; tema?: unknown; oferta?: string };

async function replicarComoBloques(url: string, recetaFormato: ConfigReplica, partes: PartesReplica, entrada: EntradaBloques, avisar: (e: EventoReplica) => void = () => {}): Promise<ResultadoReplicar> {
  const t0 = Date.now();
  avisar({ fase: 'leer' });
  const base = recetaFormato.params ?? {};
  // El estilo de la original, EN PARALELO con el esquema: el de la lectura del navegador si vino (los estilos computados
  // de la página armada), o el del HTML y sus hojas. `estiloDeLaPagina` nunca tira. Se lee con el diseño (el tema, las
  // imágenes, las animaciones) y también con la estructura escrita de nuevo: ahí sólo dice DÓNDE van las imágenes (el
  // acomodo de cada sección, en el molde), y nada de su diseño pasa a la copia.
  const usaEstilo = partes.diseno || (partes.estructura && !partes.texto && recetaFormato.formato === 'landing');
  const leido = usaEstilo ? estiloDeLectura(entrada.lectura) : null;
  const estiloP: Promise<EstiloOriginal | null> = !usaEstilo ? Promise.resolve(null) : leido ? Promise.resolve(leido) : estiloDeLaPagina(url);
  // Los ÁNGULOS (cuando el texto se escribe de nuevo): los de la lectura que vio la persona. Se leen acá SÓLO sin la
  // estructura, porque ahí el esquema los necesita (la IA no ve la página). Con la estructura, el texto de la original ya
  // los trae sección por sección: leerlos acá era una llamada de IA más, ANTES del esquema y comiéndose el plazo de las
  // tandas («Replicar y adaptar» por la API, que no trae la lectura; revisión del 28/10/2026).
  let angulos: Angulos | null = null;
  if (partes.angulos && !partes.texto) {
    angulos = sanearAngulos(entrada.angulos);
    if (!angulos && !partes.estructura) {
      const t = await textoDePagina({ url, lectura: entrada.lectura, texto: entrada.texto });
      if (!t.ok) return { ok: false, error: t.error, status: t.status, ...(t.enNavegador && t.motivo ? seLeeEnNavegador(t.motivo) : {}) };
      angulos = (await angulosDePagina(esquemaDeReplica(t.texto, t.titulo), url, t0 + PLAZO_ANGULOS_MS)).angulos;
    }
  }
  // La receta por partes: la del esquema va sin el molde (sale del esquema); la de las secciones se completa después.
  const marca = marcaDeUrl(url);
  const instruccionEsquema = instruccionDePartes(partes, { angulos: angulos ? textoDeAngulos(angulos) : undefined, oferta: entrada.oferta, marca: marca ?? undefined });
  const inicial = recetaDePartes(recetaFormato.formato, base, partes, { esquema: instruccionEsquema, secciones: instruccionEsquema });
  const params = inicial.paramsEsquema;
  // El esquema: con la estructura, el de la página (lo pegado entra como «Pegar texto»; la lectura del navegador, como
  // «Importar» sin bajar nada); sin ella, el que arma la IA para la oferta del negocio.
  const e = inicial.esquema === 'generar'
    ? await pedirEsquema({ modo: 'generar', prompt: PEDIDO_SIN_ESTRUCTURA, params })
    : entrada.texto
      ? await pedirEsquema({ modo: 'pegar', texto: entrada.texto, params, corte: 'pagina' })
      : await pedirEsquema({ modo: 'importar', url, lectura: entrada.lectura, params });
  if (!e.ok) {
    // `enNavegador` viaja tal cual: la pantalla ofrece el lector o pegar el texto y vuelve con eso.
    return { ok: false, error: e.error, status: e.status, ...(e.enNavegador && e.motivo ? seLeeEnNavegador(e.motivo) : {}) };
  }
  const esq: Esquema = e.esquema;
  avisar({ fase: 'esquema', secciones: esq.secciones.map((s) => s.titulo) });
  // Con la estructura de una Landing, la réplica tiene las MISMAS secciones que la página: el molde de cada una y su
  // ángulo van en la tanda de secciones. `adaptar`: la sección que no pasa por la IA queda con el texto de la ORIGINAL.
  const mismasSecciones = partes.estructura && recetaFormato.formato === 'landing';
  const moldes = mismasSecciones ? moldeDeEsquema(esq) : null;
  // Cómo está acomodada cada sección (dónde lleva imágenes, si sus subtítulos son tarjetas): con el estilo leído.
  const estiloLeido = await estiloP;
  const acomodos = moldes
    ? (() => {
      const asigM = estiloLeido ? asignarSecciones(esq.secciones, estiloLeido.secciones) : [];
      const imgs = estiloLeido ? imagenesPorSeccion(partesDeCadaSeccion(asigM, estiloLeido.secciones.length), estiloLeido.imagenes) : [];
      return moldes.map((m, i) => acomodoDeSeccion(m, imgs[i] ?? null));
    })()
    : [];
  // El molde, el ángulo y el acomodo de cada sección viajan CON la sección (`nota`, en su tanda): en la instrucción común
  // (5.000 caracteres) una lista de 20 secciones no entraba. La instrucción lleva las reglas y los ángulos generales.
  const notas = moldes
    ? moldes.map((m, i) => {
      const a = angulos?.secciones.find((s) => s.n === i + 1);
      return notaDeSeccion(m, acomodos[i], a ? `${NOMBRE_TIPO_SECCION[a.tipo]}${a.angulo ? `: ${a.angulo}` : ''}` : '');
    })
    : null;
  // Con el texto escrito de nuevo, la IA no ve a dónde llevaban los botones de la otra (los copiaba como destino).
  const esqTandas: Esquema = {
    ...esq,
    secciones: esq.secciones.map((s, i) => ({
      ...s,
      ...(partes.texto ? {} : { puntos: s.puntos.map(sinDestinoDeBoton) }),
      ...(notas ? { nota: notas[i] } : {}),
    })),
  };
  const instruccionSecciones = instruccionDePartes(partes, { angulos: angulos ? textoDeAngulos(angulos) : undefined, oferta: entrada.oferta, marca: marca ?? undefined });
  // El `adaptar` del formato (el pedido viejo) no manda: lo deciden las partes.
  const { adaptar: _adaptarDelFormato, ...delFormato } = recetaFormato;
  void _adaptarDelFormato;
  const receta: ConfigReplica = {
    ...delFormato,
    // Sólo con las MISMAS secciones (Landing): en una Presentación el esquema ya lo escribió la IA para el negocio, y ni el
    // chequeo de lo copiado ni el aviso de «el texto de la original» tienen sentido contra él.
    ...(mismasSecciones && !partes.texto ? { adaptar: true as const } : {}),
    paramsSecciones: recetaDePartes(recetaFormato.formato, base, partes, { esquema: instruccionEsquema, secciones: instruccionSecciones }).paramsSecciones,
  };
  const estilo = partes.diseno ? estiloLeido : null;
  // Qué sección de la réplica es cuál de la original (por el título), y la primera imagen de cada una
  // a NUESTRO bucket mientras la IA arma las secciones.
  const asig = estilo ? asignarSecciones(esq.secciones, estilo.secciones) : [];
  const ws = estilo?.imagenes.length ? await getWorkspaceActual().catch(() => null) : null;
  const primeras = estilo && ws != null ? imagenesParaSubir(asig, estilo).primeras : [];
  const subidasP = ws != null && primeras.length ? subirImagenes(primeras, ws, t0 + PLAZO_IMAGENES_MS) : Promise.resolve(new Map<string, string>());
  const tandas = tandasDe(esq.secciones.length);
  const porIndice = new Map<number, JsonNodo>();
  let sinIA = 0;

  // Las tandas, de a EN_PARALELO, mientras quede plazo para una entera.
  const correr = async (lista: readonly number[][], vuelta: string) => {
    let siguiente = 0;
    const trabajador = async () => {
      while (siguiente < lista.length) {
        const indices = lista[siguiente++];
        if (Date.now() - t0 + TANDA_MS > PLAZO_BLOQUES_MS) continue;
        try {
          const r = await pedirSecciones({ esquema: esqTandas, indices, params: receta.paramsSecciones ?? params });
          if (r.ok) r.tarjetas.forEach((t, k) => { porIndice.set(indices[k], t); avisar({ fase: 'seccion', indice: indices[k], titulo: esq.secciones[indices[k]]?.titulo ?? '' }); });
          else console.warn(`[editor-landing/replicar] ${vuelta} tanda ${indices.join(',')} de ${url}: ${r.error}`);
        } catch (err) {
          console.warn(`[editor-landing/replicar] ${vuelta} tanda ${indices.join(',')} de ${url}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(EN_PARALELO, lista.length) }, trabajador));
  };
  await correr(tandas, '1ª vuelta');
  // ⚠️ UNA SEGUNDA VUELTA para lo que quedó sin IA, mientras quede plazo para una tanda entera (26/10/2026). El caso: la réplica
  // del ws9 dejó 17 de 20 secciones sin IA en 135 s con un plazo de 240, porque `gemini-flash-latest` estaba saturado. La
  // cascada ya lo anotó (lib/ia-saturacion.ts: el 503 para el proceso, el cuelgue para esta réplica): esta vuelta empieza
  // por el modelo de respaldo. Una sola: lo que vuelva a
  // fallar queda con el texto de la original, como siempre, y lo dice el aviso.
  const faltan = tandas.map((t) => t.filter((i) => !porIndice.has(i))).filter((t) => t.length > 0);
  if (faltan.length) await correr(faltan, '2ª vuelta');

  // Con el texto escrito de nuevo, lo que la IA dejó TEXTUAL de la original (sus citas y sus cifras) se vacía, y las frases
  // iguales se cuentan (28/10/2026, `quitarPruebaDeLaOriginal`): «de la referencia no pasa nada propio» no es sólo un prompt.
  const original = receta.adaptar ? esq.secciones.flatMap((s) => [s.titulo, ...s.puntos]).join(' ') : '';
  let pruebaQuitada = 0;
  let frasesIguales = 0;
  let enlacesAjenos = 0;
  // Los destinos que aparecen en la original (su agenda, su WhatsApp): con las mismas secciones, el esquema ES su texto.
  // La IA no los ve en los botones, pero sí en un renglón como «[CALENDARIO] Calendly (https://…)».
  const destinosOriginal = mismasSecciones && !partes.texto ? enlacesDeLaOriginal(esq.secciones.flatMap((s) => s.puntos).join('\n')) : new Set<string>();
  const tarjetasCrudas = esq.secciones.map((s, i) => {
    const t = porIndice.get(i);
    if (t) {
      if (!original) return t;
      const f = quitarPruebaDeLaOriginal(t, original);
      pruebaQuitada += f.quitados;
      frasesIguales += f.copiadas;
      return f.tarjeta;
    }
    sinIA++;
    avisar({ fase: 'seccion', indice: i, titulo: s.titulo, respaldo: true });
    return tarjetaDesdeEsquema(s, i === 0);
  });
  const tarjetas = partes.texto ? tarjetasCrudas : tarjetasCrudas.map((t) => {
    const r = sinEnlacesALaOriginal(t, url, destinosOriginal);
    enlacesAjenos += r.cambiados;
    return r.tarjeta;
  });
  avisar({ fase: 'diseno' });
  // La marca de la original que quedó nombrada en una copia escrita de nuevo: se cuenta y se dice (no se adivina el reemplazo).
  const menciones = partes.texto ? 0 : mencionesDe(tarjetas.map((t) => textoDe(t, ' ')).join(' '), marca);
  if (!tarjetas.length) return falla('No encontré secciones en esa página.', 422);

  // Las imágenes que faltan para los huecos que dejó la IA (una galería, las caras de un equipo), si
  // queda plazo y tope; después el tema propio y lo de la original puesto en las secciones.
  const subidas = await subidasP;
  const intentadas = new Set(primeras);
  if (estilo && ws != null) {
    const faltan = imagenesQueFaltan(tarjetas, asig, estilo, subidas).slice(0, Math.max(0, TOPES_IMAGENES_REPLICA.total - primeras.length));
    for (const u of faltan) intentadas.add(u);
    if (faltan.length) for (const [k, v] of await subirImagenes(faltan, ws, t0 + PLAZO_IMAGENES_MS)) subidas.set(k, v);
  }
  // Sin el diseño de la original, el tema que eligió la persona (el suyo); con él, el tema propio armado con su estilo.
  const tema = partes.diseno ? await temaParaLaCopia(estilo, url) : { ok: false as const, error: 'sin el diseño de la original' };
  const temaPersona = partes.diseno ? null : await temaDeLaPersona(entrada.tema);
  // Las animaciones de la original (tanda 8), SÓLO como «Landing»: el estilo de la landing y el efecto propio de las
  // secciones que no siguen ese estilo (por el título, como las imágenes: `asig`). La Presentación no: sus
  // diapositivas pasan con Presentar, no con el scroll. Sin señales, `estilo` null y nada propio (queda el default).
  const anim = receta.formato === 'landing' && estilo ? animacionesDeReplica(estilo.animaciones, partesDeCadaSeccion(asig, estilo.secciones.length)) : null;
  const config: Partial<ConfigLanding> = {
    ...(tema.ok ? { ...receta.config, tema: `ws:${tema.tema.id}` } : temaPersona ? { ...receta.config, tema: temaPersona } : receta.config),
    ...(anim?.estilo ? { pagina: { ...CONFIG_DEFAULT.pagina, estiloAnimacion: anim.estilo } } : {}),
  };
  // El fondo de la tarjeta del tema que quedó (el guardado: si la persona ya lo había tocado, el suyo).
  const fondoTema = tema.ok ? colorDeRelleno(temaPorId(`ws:${tema.tema.id}`, [tema.tema]).tarjeta.fondo) : null;
  const puesto = estilo ? aplicarEstilo(tarjetas, asig, estilo, subidas, { fondoTema }) : { tarjetas, imagenes: 0, fondos: 0 };
  const animadas = anim ? conAnimaciones(puesto.tarjetas, anim.porSeccion) : { tarjetas: puesto.tarjetas, propias: 0 };

  const contenido: LandingContenido = { v: 1, paginas: [{ id: nuevoId('p'), titulo: 'Inicio', ruta: '', doc: { type: 'doc', content: animadas.tarjetas } }] };
  // Sin el texto de la original ya no es la de la original: no lleva su nombre («Adaptada de …», «Basada en …»).
  const creada = await crearLanding(nombreDeCopia(partes, hostDe(url), esq.titulo), contenido, config);
  if ('ok' in creada) return creada;
  const fidelidad = moldes ? `, fidelidad: ${lineaDeFidelidad(fidelidadDeEstructura(moldes, tarjetas))}` : '';
  const noCopiadas = Math.max(0, intentadas.size - subidas.size);
  const resumenAnim = anim ? `${anim.estilo ?? 'sin estilo'} + ${animadas.propias} propias${anim.avisoScroll ? ', con scroll' : ''}` : 'no';
  console.log(`[editor-landing/replicar] ${receta.formato} [${listaDePartes(partes).join('+')}] ${url}${entrada.texto ? ' (texto pegado)' : entrada.lectura ? ' (leída en el navegador)' : ''} → #${creada.id} (${tarjetas.length} secciones, ${sinIA} sin IA, estilo ${estilo ? (leido ? 'del navegador' : 'del HTML') : 'no'}, tema ${tema.ok ? tema.tema.id : tema.error}, ${puesto.imagenes} imágenes y ${puesto.fondos} fondos de la original, ${noCopiadas} sin copiar, animaciones ${resumenAnim}, ángulos ${angulos ? 'sí' : 'no'}, oferta ${entrada.oferta ? 'sí' : 'no'}, menciones de ${marca ?? '?'} ${menciones}, enlaces a la original ${enlacesAjenos}${original ? `, ${pruebaQuitada} citas o cifras de la original vaciadas, ${frasesIguales} frases iguales` : ''}${fidelidad}, ${Math.round((Date.now() - t0) / 1000)} s)`);
  const una = terminoTarjeta(receta.config);
  const varias = terminoTarjeta(receta.config, { plural: true });
  const avisos = [
    // Adaptada, la que no pasó por la IA quedó con el texto de la ORIGINAL: eso es lo que hay que decir.
    sinIA && receta.adaptar
      ? (sinIA === 1 ? `Una ${una} quedó con el texto de la original: adáptala con MaKo.` : `${sinIA} ${varias} quedaron con el texto de la original: adáptalas con MaKo.`)
      : sinIA ? (sinIA === 1 ? `Una ${una} quedó sin diseño.` : `${sinIA} ${varias} quedaron sin diseño.`) : '',
    partes.diseno && !estilo ? 'Sin el estilo de la original.' : !tema.ok && 'tope' in tema && tema.tope ? 'Llegaste al tope de temas.' : '',
    noCopiadas ? (noCopiadas === 1 ? 'Una imagen no se copió.' : `${noCopiadas} imágenes no se copiaron.`) : '',
    pruebaQuitada ? (pruebaQuitada === 1 ? 'Una cita o cifra de la original quedó vacía: pon la tuya.' : `${pruebaQuitada} citas o cifras de la original quedaron vacías: pon las tuyas.`) : '',
    frasesIguales ? (frasesIguales === 1 ? 'Una frase quedó igual a la original: revísala.' : `${frasesIguales} frases quedaron iguales a la original: revísalas.`) : '',
    menciones ? `${marca} quedó nombrada ${menciones === 1 ? 'una vez' : `${menciones} veces`}: cámbialo por lo tuyo.` : '',
    enlacesAjenos ? (enlacesAjenos === 1 ? 'Un enlace llevaba a la original: ahora va a «#», pon el tuyo.' : `${enlacesAjenos} enlaces llevaban a la original: ahora van a «#», pon los tuyos.`) : '',
    anim?.avisoScroll ? AVISO_SCROLL : '',
  ].filter(Boolean);
  return {
    ok: true, id: creada.id, titulo: creada.titulo, secciones: tarjetas.length, formato: receta.formato, partes: listaDePartes(partes),
    ...(avisos.length ? { aviso: avisos.join(' ') } : {}),
    ...(anim && (anim.estilo || animadas.propias) ? { animaciones: { estilo: anim.estilo, propias: animadas.propias } } : {}),
    ...(anim?.avisoScroll ? { avisoScroll: true as const } : {}),
  };
}

/**
 * El tema que eligió la persona para la réplica SIN el diseño de la original (28/10/2026: «yo tengo definido un estilo de
 * diseño de landing»): uno del catálogo (`pewter`) o uno propio del negocio (`ws:<id>`, que tiene que existir en ESTE
 * workspace). Nunca tira: null = el de fábrica.
 */
async function temaDeLaPersona(raw: unknown): Promise<string | null> {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const id = raw.trim();
  if (TEMAS.some((t) => t.id === id)) return id;
  if (!id.startsWith('ws:')) return null;
  try {
    const ws = await getWorkspaceActual();
    if (ws == null) return null;
    return (await temasPropiosDe(ws)).some((t) => `ws:${t.id}` === id) ? id : null;
  } catch {
    return null;
  }
}

/**
 * El tema propio con el estilo de la original, guardado en el workspace. Si ya hay uno con el mismo id
 * (el mismo estilo, replicado antes) se REUSA tal como está: no se pisa lo que la persona le haya cambiado.
 * Nunca tira: sin tema, la réplica nace con el de fábrica (`tope` cuando no entra uno más).
 */
async function temaParaLaCopia(estilo: EstiloOriginal | null, url: string): Promise<{ ok: true; tema: TemaPropio } | { ok: false; error: string; tope?: boolean }> {
  const tema = temaDeEstilo(estilo, url);
  if (!tema) return { ok: false, error: 'sin estilo' };
  try {
    const ws = await getWorkspaceActual();
    if (ws == null) return { ok: false, error: 'sin negocio' };
    const ya = (await temasPropiosDe(ws)).find((t) => t.id === tema.id);
    if (ya) return { ok: true, tema: ya };
    const r = await guardarTema(tema);
    if (r.ok) return { ok: true, tema: r.tema };
    return { ok: false, error: r.error, tope: r.status === 409 && /tope/i.test(r.error) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Lo que se espera a las hojas de la copia fiel para el aviso del scroll (corre mientras se crea la landing). */
const PLAZO_HOJAS_SCROLL_MS = 5_000;

/**
 * ¿La página tiene efectos atados al scroll? Para la copia fiel, que ya bajó su HTML: se mira ahí y, si no alcanza, en
 * sus hojas (las mismas que miraría el estilo: `hojasDeHtml`, con la baranda de `bajarHoja` y un plazo corto, porque el
 * `animation-timeline` suele vivir en la hoja y no en el HTML). Nunca tira: sin hojas, lo que diga el HTML.
 */
async function scrollDeLaPagina(html: string, url: string): Promise<boolean> {
  try {
    if (scrollEnHtml(html)) return true;
    const hojas = hojasDeHtml(html, baseDeDocumento(html, url));
    if (!hojas.length) return false;
    let plazo: ReturnType<typeof setTimeout> | undefined;
    const css = await Promise.race([
      Promise.all(hojas.map((h) => bajarHoja(h).catch(() => ''))),
      new Promise<string[]>((ok) => { plazo = setTimeout(() => ok([]), PLAZO_HOJAS_SCROLL_MS); }),
    ]);
    clearTimeout(plazo);
    return scrollEnCss(css.join('\n'));
  } catch {
    return false;
  }
}

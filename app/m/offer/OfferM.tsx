'use client';

// =============================================================================
// /m/offer — la pantalla: el selector arriba, el hilo con MaKo y la franja de abajo
// =============================================================================
// Destila app/offer/OfferApp.tsx con las MISMAS acciones (/api/offer por `llamarOffer`, la subida directa a
// Storage, el PDF por `descargarPdf`) y las MISMAS reglas puras de escritorio (app/offer/ayudas.ts, arbol.ts,
// adjuntos-envio.ts). Lo que cambia es el dibujo:
//   · el desplegable en árbol → una píldora con el camino («Funnel › Oferta») que abre la hoja del selector;
//   · el riel «Tu oferta» → una franja pegada arriba del composer (el conteo y la barra) que abre su hoja;
//   · las vistas Generando y Conclusión → una hoja alta (con «atrás» vuelve al chat, y lo que se arma sigue).
//
// ⚠️ ESTA ORQUESTACIÓN ES LA DE OfferApp, ESCRITA OTRA VEZ (está adentro de ese componente y no se puede
//    importar). Las reglas que costaron una revisión adversarial siguen acá, con el mismo nombre:
//    `epoca` (cambiar de conversación descarta lo que estaba en vuelo), `quedoGuardado` (un corte sin
//    respuesta relee antes de devolver el texto: si ya quedó, reenviarlo lo duplica), `esRechazoDefinitivo`
//    (413/415/422 no se reintentan, y un audio así se tira), `pasoTrasFalloDeOferta` (un 409 de 'generar'
//    reintenta desde el diagnóstico), los links y los documentos leídos UNA vez por conversación, el `path`
//    de una nota ya subida (reintentar no la vuelve a subir) y 'descartar-subida' de la que no va a salir.
//    tests/m-offer.test.ts exige que sigan acá. Lo correcto es que las dos pantallas monten un hook común
//    (docs/hallazgos-mobile.md, «Offer»).
// ⚠️ LO QUE CORRE MIENTRAS SE GRABA UNA NOTA usa las props del render en que se apretó el mic: `mandar` y
//    `enviarAudio` deciden con REFS (`sesionRef`, `enviando`, `leyendoRef`), nunca con el estado de su render.
// ⚠️ TIRAR PARA REFRESCAR trae lo nuevo sin cambiarle la conversación a nadie (modelo.ts → trasRefrescar).
// =============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@/app/_components/icons';
import { MAX_ARCHIVO_BYTES, ACCEPT_IMPORTAR, porQueNoPuedo, puedeLeerse } from '@/lib/formatos-archivo';
import type { AdjuntoVista, ArbolOffer, OfferMensaje, OfferSesionVista } from '@/lib/offer-marco';
import { useListaAdjuntos } from '@/app/whatsapp/_shared/VistaAdjuntos';
import { MAX_ADJUNTOS, type ItemAdjunto } from '@/app/whatsapp/_shared/adjuntos-vista';
import { leerAdjuntos } from '@/app/offer/adjuntos-envio';
import { arbolSeguro, arbolVacio, caminoDeSesion, conSesionEnArbol } from '@/app/offer/arbol';
import {
  TOPE_MENSAJE, bienvenidaDe, esOpcionArmar, etiquetaArmar, linksDe, pasoTrasFalloDeOferta, quedoGuardado, reemplaza, resumenDe,
  vistaDeEntrada, type AvisoGuardado,
} from '@/app/offer/ayudas';
import { ErrorOfferApi, TOPE, esRechazoDefinitivo, llamarOffer, mensajeDeError, subirArchivo } from '@/app/offer/offer-api';
import { ErrorM, VacioM, useConexion } from '@/app/m/_ui';
import { VistaAdjuntosM } from '@/app/m/mako/VistaAdjuntosM';
import { ComposerOfferM } from './ComposerOfferM';
import { HiloOfferM } from './HiloOfferM';
import { HojaOferta, HojaPiezas, HojaSelector, type GenM } from './HojasOfferM';
import {
  ROTULOS, caminoEnUnaLinea, cuantosArchivos, fuenteDelTexto, opcionesRapidas, progresoDePiezas, sinContestar, trasRefrescar,
  type PasoGeneracion,
} from './modelo';

const GEN_QUIETA: GenM = { paso: 'diagnostico', corriendo: false, error: null };

/** Una nota de voz: el binario, cuánto dura, su URL `blob:` y, ya subida, dónde quedó (un reintento no la resube). */
type AudioGrabado = { blob: Blob; secs: number; url: string; path?: string };

/** Lo que se manda en un turno. */
type Envio = { texto: string; docs: AdjuntoVista[]; respuesta?: { preguntaId: string; idx: number }; audio?: AudioGrabado; fuente: string };

/** 'salio' (no se devuelve nada) · 'volver' (vale reintentar: vuelve al composer) · 'tirar' (lo mismo no entra). */
type Resultado = 'salio' | 'volver' | 'tirar';

/** Los topes de lo que entra a la vista previa (los de escritorio): que se pueda leer y hasta 25 MB. */
const TOPES_OFFER = {
  maxBytes: MAX_ARCHIVO_BYTES,
  maxArchivos: MAX_ADJUNTOS,
  validar: (f: { name: string; type: string }): string | null => (puedeLeerse(f.name, f.type) ? null : `«${f.name}» ${porQueNoPuedo(f.name) || 'no se puede leer.'}`),
};

/** Un audio que no se puede convertir no se arregla reintentando: es la MISMA grabación. */
class AudioInservible extends Error {}

/** La nota en MP3: lo que el transcriptor y cualquier navegador aceptan (el de escritorio, OfferApp `aMp3`). */
async function aMp3(blob: Blob): Promise<Blob> {
  if (blob.type === 'audio/mpeg') return blob;
  try {
    // Perezoso: el codificador (lamejs) sólo se baja al mandar una nota de voz.
    const { blobToMp3 } = await import('@/app/whatsapp/audio');
    return await blobToMp3(blob);
  } catch {
    throw new AudioInservible('No se pudo procesar el audio. Grábalo de nuevo.');
  }
}

type Hoja = 'funnel' | 'piezas' | 'oferta' | null;

export function OfferM({ arbolInicial, arbolFallo, sesionInicial, opcionArmar, opcionActualizar, analizarAlAbrir }: {
  arbolInicial: ArbolOffer;
  /** El server no pudo leer el árbol (la pantalla igual abre). */
  arbolFallo: boolean;
  /** La conversación más reciente (o la del link), abierta. null = la bienvenida. */
  sesionInicial: OfferSesionVista | null;
  /** La respuesta rápida que arma la oferta (lib/offer-reglas.ts → OPCION_ARMAR). */
  opcionArmar: string;
  opcionActualizar: string;
  /** Un link que nombra una oferta sin conversación: se abre una para analizarla. */
  analizarAlAbrir: { funnelId: number; ofertaBaseId: number | null } | null;
}) {
  const { enLinea } = useConexion();
  const [arbol, setArbol] = useState<ArbolOffer>(arbolInicial);
  const [arbolLeido, setArbolLeido] = useState(!arbolFallo);
  const [sesion, setSesion] = useState<OfferSesionVista | null>(sesionInicial);
  const [hoja, setHoja] = useState<Hoja>(null);
  /** Qué muestra la hoja de la oferta: el armado en curso (o fallido) o la conclusión. */
  const [vistaOferta, setVistaOferta] = useState<'generando' | 'conclusion'>('conclusion');
  const [texto, setTexto] = useState('');
  const lista = useListaAdjuntos(TOPES_OFFER);
  const [leyendo, setLeyendo] = useState(false);
  const [estadoVista, setEstadoVista] = useState<string | null>(null);
  const [errorVista, setErrorVista] = useState<string | null>(null);
  const [falloId, setFalloId] = useState<string | null>(null);
  const [pendiente, setPendiente] = useState<OfferMensaje | null>(null);
  const [fuente, setFuente] = useState('tu respuesta');
  const [errorChat, setErrorChat] = useState<string | null>(null);
  const [reintentando, setReintentando] = useState(false);
  const [gen, setGen] = useState<GenM>(GEN_QUIETA);
  const [cambiando, setCambiando] = useState(false);
  const [errorSelector, setErrorSelector] = useState<string | null>(null);
  const [recargando, setRecargando] = useState(false);
  const [audioEnEspera, setAudioEnEspera] = useState<AudioGrabado | null>(null);
  const [altoDock, setAltoDock] = useState(120);
  const [capaPie, setCapaPie] = useState<HTMLElement | null>(null);

  const sesionRef = useRef<OfferSesionVista | null>(sesionInicial);
  const sesionId = useRef<number | null>(sesionInicial?.id ?? null);
  const epoca = useRef(0);
  const generando = useRef(false);
  const enviando = useRef(false);
  const leyendoRef = useRef(false);
  const cambiandoRef = useRef(false);
  /** Los links ya leídos en ESTA conversación: reenviar el mismo mensaje no lo vuelve a leer. */
  const linksLeidos = useRef(new Map<string, AdjuntoVista>());
  /** Los archivos de la vista YA leídos (por el id de la vista): reintentar no los vuelve a subir ni a leer. */
  const docsLeidos = useRef(new Map<string, AdjuntoVista>());

  // La franja va por portal a #m-pie (fuera de la columna, que se corre al tirar para refrescar).
  useEffect(() => { setCapaPie(document.getElementById('m-pie')); }, []);

  // ── Las URL `blob:` de las notas de voz: se sueltan al sacarlas y al salir ──
  const urls = useRef(new Set<string>());
  const crearUrl = (b: Blob): string => { const u = URL.createObjectURL(b); urls.current.add(u); return u; };
  const soltarUrl = (u: string | null | undefined) => {
    if (!u || !urls.current.has(u)) return;
    urls.current.delete(u);
    try { URL.revokeObjectURL(u); } catch { /* ya no estaba */ }
  };
  useEffect(() => {
    const todas = urls.current;
    return () => { for (const u of todas) { try { URL.revokeObjectURL(u); } catch { /* noop */ } } todas.clear(); };
  }, []);

  // ── El scroll del documento: abajo al abrir y con cada cosa nueva ──
  const alFondo = useCallback((suave = true) => {
    requestAnimationFrame(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: suave ? 'smooth' : 'auto' }));
  }, []);
  useEffect(() => { alFondo(false); }, [alFondo]);
  const cuantos = (sesion?.mensajes.length ?? 0) + (pendiente ? 1 : 0);
  const respondiendo = pendiente != null || reintentando;
  useEffect(() => { if (cuantos) alFondo(); }, [cuantos, alFondo]);
  useEffect(() => { if (respondiendo) alFondo(); }, [respondiendo, alFondo]);

  // ── La conversación que vuelve del servidor ────────────────────────────────
  const ponerSesion = (s: OfferSesionVista | null) => { sesionRef.current = s; setSesion(s); };
  const aplicarSesion = useCallback((nueva: OfferSesionVista, e: number) => {
    if (e !== epoca.current) return;
    if (!reemplaza(sesionRef.current, nueva)) return;
    sesionId.current = nueva.id;
    sesionRef.current = nueva;
    setSesion(nueva);
    setArbol((a) => conSesionEnArbol(a, nueva, resumenDe(nueva)));
  }, []);

  /** Deja la pantalla limpia para otra conversación. */
  const reiniciar = () => {
    epoca.current += 1;
    sesionId.current = null;
    enviando.current = false;
    linksLeidos.current = new Map();
    lista.vaciar();
    docsLeidos.current = new Map();
    leyendoRef.current = false;
    setLeyendo(false);
    setEstadoVista(null);
    setErrorVista(null);
    setFalloId(null);
    setAudioEnEspera((a) => { if (a) soltarUrl(a.url); return null; });
    setPendiente(null);
    setTexto('');
    setErrorChat(null);
    setReintentando(false);
    setGen(GEN_QUIETA);
  };

  const refrescarArbol = useCallback(async (): Promise<boolean> => {
    try {
      const r = await llamarOffer<{ arbol: unknown }>({ action: 'arbol' }, TOPE.corto);
      setArbol(arbolSeguro(r.arbol));
      setArbolLeido(true);
      return true;
    } catch {
      return false; // queda el árbol que había: sigue sirviendo para elegir
    }
  }, []);

  const recargarArbol = async () => {
    if (recargando) return;
    setRecargando(true);
    setErrorSelector(null);
    try {
      if (!(await refrescarArbol())) setErrorSelector('No cargaron tus funnels. Prueba de nuevo en un momento.');
    } finally {
      setRecargando(false);
    }
  };

  // Otra pestaña (o la computadora) pudo haber creado una conversación: al volver, el árbol se vuelve a pedir.
  useEffect(() => {
    const alVolver = () => { if (document.visibilityState === 'visible') void refrescarArbol(); };
    document.addEventListener('visibilitychange', alVolver);
    return () => document.removeEventListener('visibilitychange', alVolver);
  }, [refrescarArbol]);

  // ── Tirar para refrescar: las props nuevas del server (modelo.ts → trasRefrescar) ──
  const primeraVez = useRef(true);
  useEffect(() => {
    if (primeraVez.current) { primeraVez.current = false; return; }
    if (!arbolFallo) { setArbol(arbolInicial); setArbolLeido(true); }
    const ocupado = enviando.current || generando.current || leyendoRef.current || cambiandoRef.current;
    const que = trasRefrescar({ abierta: sesionRef.current, llegada: sesionInicial, ocupado });
    if (que === 'adoptar' && sesionInicial) {
      if (sesionRef.current?.id === sesionInicial.id) aplicarSesion(sesionInicial, epoca.current);
      else { reiniciar(); sesionId.current = sesionInicial.id; ponerSesion(sesionInicial); alFondo(false); }
    } else if (que === 'releer' && sesionRef.current) {
      const id = sesionRef.current.id;
      const e = epoca.current;
      void llamarOffer<{ sesion: OfferSesionVista }>({ action: 'abrir', id }, TOPE.corto).then((r) => aplicarSesion(r.sesion, e), () => null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sólo cuando el server manda props nuevas
  }, [arbolInicial, sesionInicial, arbolFallo]);

  // ── Mandar un turno ────────────────────────────────────────────────────────
  const mandar = async (envio: Envio): Promise<Resultado> => {
    const id = sesionId.current;
    const s = sesionRef.current;
    if (id == null || !s || enviando.current) return 'volver';
    if (!envio.texto.trim() && !envio.docs.length && !envio.audio) return 'volver';
    enviando.current = true;
    const e = epoca.current;
    const antes = s.mensajes.length;
    setErrorChat(null);
    setFuente(envio.fuente);
    // Optimista: tu mensaje se dibuja ya (una nota de voz, con su URL local) mientras MaKo contesta.
    setPendiente({
      id: 'pendiente', de: 'yo', texto: envio.texto, at: new Date().toISOString(),
      ...(envio.docs.length ? { adjuntos: envio.docs } : {}),
      ...(envio.audio ? { audio: { url: envio.audio.url, secs: envio.audio.secs } } : {}),
    });
    let avisoLink: string | null = null;
    try {
      const docIds = envio.docs.map((d) => d.id);
      // 1) Los links del mensaje, leídos como un documento más (y una sola vez por conversación).
      for (const url of linksDe(envio.texto)) {
        const ya = linksLeidos.current.get(url);
        if (ya) { if (!docIds.includes(ya.id)) docIds.push(ya.id); continue; }
        setFuente('tu link');
        try {
          const r = await llamarOffer<{ sesion: OfferSesionVista; doc: AdjuntoVista }>(
            { action: 'leer-link', sesionId: id, url, funnelId: s.funnelId }, TOPE.leer, 'Leer el link tardó demasiado.',
          );
          if (e !== epoca.current) return 'volver';
          aplicarSesion(r.sesion, e);
          if (r.doc?.id) { linksLeidos.current.set(url, r.doc); docIds.push(r.doc.id); }
        } catch (err) {
          if (e !== epoca.current) return 'volver';
          // Un link que no abre no frena el mensaje: el motivo va TAL CUAL (ya es una frase entera).
          if (err instanceof ErrorOfferApi && err.sesion) aplicarSesion(err.sesion, e);
          avisoLink = mensajeDeError(err);
        }
      }
      // 2) La nota de voz: a MP3 y a Storage, como un archivo (no pasa por una server action, que topea en 1 MB).
      let audio: { path: string; mime: string; secs: number } | undefined;
      if (envio.audio) {
        setFuente('tu audio');
        let path = envio.audio.path;
        if (!path) {
          const mp3 = await aMp3(envio.audio.blob);
          path = await subirArchivo(new File([mp3], 'nota-de-voz.mp3', { type: 'audio/mpeg' }), 'audio/mpeg');
          envio.audio.path = path;
        }
        if (e !== epoca.current) return 'volver';
        audio = { path, mime: 'audio/mpeg', secs: Math.max(1, Math.round(envio.audio.secs)) };
      }
      setFuente(envio.fuente);
      const r = await llamarOffer<{ sesion: OfferSesionVista }>(
        {
          action: 'turno', sesionId: id, texto: envio.texto, docIds,
          ...(audio ? { audio } : {}),
          ...(envio.respuesta ? { respuesta: envio.respuesta } : {}),
        },
        TOPE.turno,
        'MaKo tardó demasiado en contestar. Prueba de nuevo.',
      );
      aplicarSesion(r.sesion, e);
      if (avisoLink && e === epoca.current) setErrorChat(avisoLink);
      return e === epoca.current ? 'salio' : 'volver';
    } catch (err) {
      if (e !== epoca.current) return 'volver';
      setErrorChat(mensajeDeError(err));
      // El mensaje quedó guardado aunque MaKo no contestó: se dibuja la sesión del servidor y lo enviado NO
      // vuelve al composer (la salida es «Reintentar la respuesta»).
      if (err instanceof ErrorOfferApi && err.sesion) { aplicarSesion(err.sesion, e); return 'salio'; }
      if (err instanceof AudioInservible || (err instanceof ErrorOfferApi && esRechazoDefinitivo(err.status))) return 'tirar';
      // Sin sesión en el error (un corte, un 504): se relee ANTES de devolver lo enviado.
      try {
        const r = await llamarOffer<{ sesion: OfferSesionVista }>({ action: 'abrir', id }, TOPE.corto);
        if (e !== epoca.current) return 'volver';
        aplicarSesion(r.sesion, e);
        if (quedoGuardado(r.sesion.mensajes, antes, { texto: envio.texto, audio: !!envio.audio })) return 'salio';
      } catch { /* sin conexión: se devuelve lo enviado, que es lo seguro */ }
      return 'volver';
    } finally {
      if (e === epoca.current) {
        setPendiente(null);
        enviando.current = false;
      }
    }
  };

  /** Vuelve a pedirle la respuesta a MaKo para el último mensaje, que quedó sin contestar. */
  const reintentarRespuesta = async () => {
    const id = sesionId.current;
    if (id == null || enviando.current) return;
    enviando.current = true;
    const e = epoca.current;
    setErrorChat(null);
    setFuente('tu último mensaje');
    setReintentando(true);
    try {
      const r = await llamarOffer<{ sesion: OfferSesionVista }>({ action: 'turno', sesionId: id, reintentar: true }, TOPE.turno, 'MaKo tardó demasiado en contestar. Prueba de nuevo.');
      aplicarSesion(r.sesion, e);
    } catch (err) {
      if (e === epoca.current) {
        setErrorChat(mensajeDeError(err));
        if (err instanceof ErrorOfferApi && err.sesion) aplicarSesion(err.sesion, e);
      }
    } finally {
      if (e === epoca.current) { setReintentando(false); enviando.current = false; }
    }
  };

  const puedeMandar = !!sesion && !respondiendo && !leyendo && !gen.corriendo && !cambiando;

  /** Manda lo del composer. Si no sale, el texto VUELVE: perder lo escrito por un corte es peor que el corte. */
  const enviarComposer = async () => {
    if (lista.ref.current.length) { void enviarVista(); return; }
    if (!puedeMandar || !texto.trim()) return;
    if (texto.length > TOPE_MENSAJE) { setErrorChat('Tu mensaje es muy largo. Pártelo en dos.'); return; }
    const t = texto.trim();
    const e = epoca.current;
    setTexto('');
    const res = await mandar({ texto: t, docs: [], fuente: fuenteDelTexto(t) });
    if (res === 'salio') return;
    if (e === epoca.current) setTexto((ahora) => (ahora.trim() ? ahora : t));
  };

  // ── Archivos: la vista previa ──────────────────────────────────────────────
  const leerUno = async (it: ItemAdjunto, id: number, funnelId: number | null, e: number): Promise<AdjuntoVista> => {
    const mime = it.file.type || 'application/octet-stream';
    const path = await subirArchivo(it.file, mime);
    if (e !== epoca.current) throw new Error('Cambiaste de conversación.');
    const r = await llamarOffer<{ sesion: OfferSesionVista; doc: AdjuntoVista }>(
      { action: 'leer', sesionId: id, path, nombre: it.file.name, mime, ...(funnelId != null ? { funnelId } : {}) },
      TOPE.leer,
      'Leer el archivo tardó demasiado.',
    );
    aplicarSesion(r.sesion, e);
    return r.doc;
  };

  /** Enviar de la vista previa: recién ACÁ se sube y se lee cada archivo, y después sale el turno. */
  const enviarVista = async () => {
    const items = lista.ref.current;
    if (!items.length || leyendoRef.current || !puedeMandar) return;
    if (texto.length > TOPE_MENSAJE) { setErrorVista('Tu mensaje es muy largo. Pártelo en dos.'); return; }
    const id = sesionId.current;
    const s = sesionRef.current;
    if (id == null || !s) return;
    const e = epoca.current;
    const t = texto.trim();
    leyendoRef.current = true;
    setLeyendo(true);
    setErrorVista(null);
    setErrorChat(null);
    setFalloId(null);
    let lectura: Awaited<ReturnType<typeof leerAdjuntos>>;
    try {
      lectura = await leerAdjuntos(items, docsLeidos.current, {
        leer: (it) => leerUno(it, id, s.funnelId, e),
        alEmpezar: (it) => { if (e === epoca.current) setEstadoVista(`Leyendo «${it.file.name}»…`); },
        vigente: () => e === epoca.current,
      });
    } finally {
      if (e === epoca.current) { leyendoRef.current = false; setLeyendo(false); setEstadoVista(null); }
    }
    if (e !== epoca.current || (!lectura.ok && lectura.cortado)) return;
    if (!lectura.ok) { setErrorVista(lectura.error); setFalloId(lectura.falloId); return; }
    setTexto((ahora) => (ahora.trim() === t ? '' : ahora));
    lista.vaciar();
    const res = await mandar({ texto: t, docs: lectura.docs, fuente: cuantosArchivos(lectura.docs.length) });
    if (res === 'salio') { for (const it of items) docsLeidos.current.delete(it.id); return; }
    // No salió: vuelve la vista con lo que había (los ya leídos no se releen al reintentar).
    if (e === epoca.current) {
      setTexto((ahora) => (ahora.trim() ? ahora : t));
      lista.poner([...items, ...lista.ref.current.filter((x) => !items.some((y) => y.id === x.id))]);
    }
  };

  /** El clip: abre (o suma a) la vista previa. NO sube ni lee nada. */
  const agregarArchivos = (archivos: File[]) => {
    if (sesionId.current == null) return;
    const abierta = lista.ref.current.length > 0;
    const errores = lista.agregar(archivos);
    const msg = errores.length ? errores.join(' ') : null;
    if (lista.ref.current.length) { setErrorVista(msg); if (!abierta) setErrorChat(null); }
    else setErrorChat(msg);
  };
  const quitarArchivo = (idArchivo: string) => {
    lista.quitar(idArchivo);
    docsLeidos.current.delete(idArchivo);
    if (idArchivo === falloId) { setFalloId(null); setErrorVista(null); }
  };
  /** La ✕ de la vista o «atrás»: descarta los archivos (el texto queda en la barra). */
  const cerrarVista = () => {
    if (leyendoRef.current) return;
    lista.vaciar();
    docsLeidos.current = new Map();
    setErrorVista(null);
    setFalloId(null);
  };

  // Con la vista previa arriba, tirar hacia abajo adentro de ella no refresca la página de atrás.
  const hayVista = lista.items.length > 0;
  useEffect(() => {
    if (!hayVista) return;
    const capa = document.getElementById('m-capas');
    capa?.setAttribute('data-m-sin-pull', '');
    return () => capa?.removeAttribute('data-m-sin-pull');
  }, [hayVista]);

  // ── Notas de voz ───────────────────────────────────────────────────────────
  const descartarSubida = (path?: string) => {
    if (!path) return;
    void llamarOffer({ action: 'descartar-subida', path }, TOPE.corto, '').catch(() => null);
  };
  const enviarAudio = async (a: AudioGrabado) => {
    const e = epoca.current;
    if (sesionId.current == null || enviando.current || generando.current || leyendoRef.current) { setAudioEnEspera(a); return; }
    const res = await mandar({ texto: '', docs: [], audio: a, fuente: 'tu audio' });
    if (e !== epoca.current) { soltarUrl(a.url); return; }
    if (res === 'volver') { setAudioEnEspera(a); return; }
    // Salió, o el rechazo es definitivo (sin voz, demasiado pesado, imposible de convertir): no vuelve.
    soltarUrl(a.url);
    if (res === 'tirar') descartarSubida(a.path);
  };
  const mandarAudio = (blob: Blob, secs: number) => { void enviarAudio({ blob, secs, url: crearUrl(blob) }); };
  const reenviarAudio = () => {
    const a = audioEnEspera;
    if (!a) return;
    setAudioEnEspera(null);
    void enviarAudio(a);
  };
  const descartarAudio = () => {
    setAudioEnEspera((a) => { if (a) { soltarUrl(a.url); descartarSubida(a.path); } return null; });
  };

  // ── Armar la oferta ────────────────────────────────────────────────────────
  /** Diagnóstico → oferta nueva. Si falla, se reintenta DESDE el paso que falló. `generando` (ref) frena el doble toque. */
  const armar = async (desde: PasoGeneracion = 'diagnostico') => {
    const id = sesionId.current;
    if (id == null || generando.current) return;
    generando.current = true;
    const e = epoca.current;
    let paso: PasoGeneracion = desde === 'listo' ? 'diagnostico' : desde;
    const versionAntes = sesionRef.current?.conclusion?.version ?? 0;
    setVistaOferta('generando');
    setHoja('oferta');
    setGen({ paso, corriendo: true, error: null });
    const corte = 'Tardó más de 5 minutos. Prueba de nuevo.';
    try {
      if (paso === 'diagnostico') {
        await llamarOffer<{ ok: true }>({ action: 'diagnosticar', sesionId: id }, TOPE.generar, corte);
        if (e !== epoca.current) return;
        paso = 'oferta';
        setGen({ paso, corriendo: true, error: null });
      }
      const r = await llamarOffer<{ sesion: OfferSesionVista }>({ action: 'generar', sesionId: id }, TOPE.generar, corte);
      if (e !== epoca.current) return;
      aplicarSesion(r.sesion, e);
      setGen({ paso: 'listo', corriendo: false, error: null });
      setVistaOferta('conclusion');
      setHoja('oferta');
    } catch (err) {
      if (e !== epoca.current) return;
      if (paso !== 'oferta') { setGen({ paso, corriendo: false, error: mensajeDeError(err) }); return; }
      let versionAhora: number | null = null;
      try {
        const r = await llamarOffer<{ sesion: OfferSesionVista }>({ action: 'abrir', id }, TOPE.corto);
        if (e !== epoca.current) return;
        aplicarSesion(r.sesion, e);
        versionAhora = r.sesion.conclusion?.version ?? 0;
      } catch { /* sin conexión: decide sólo el status del error */ }
      const siguiente = pasoTrasFalloDeOferta({ status: err instanceof ErrorOfferApi ? err.status : undefined, versionAntes, versionAhora });
      if (siguiente === 'listo') {
        setGen({ paso: 'listo', corriendo: false, error: null });
        setVistaOferta('conclusion');
        setHoja('oferta');
        return;
      }
      setGen({ paso: siguiente, corriendo: false, error: mensajeDeError(err) });
    } finally {
      generando.current = false;
    }
  };

  /** Una respuesta rápida (`idx` = su lugar en `opciones` del último mensaje). */
  const elegirOpcion = (idx: number) => {
    const s = sesionRef.current;
    const ultimo = s?.mensajes[s.mensajes.length - 1];
    if (!s || ultimo?.de !== 'mako') return;
    const op = (ultimo.opciones ?? [])[idx]?.trim();
    if (!op) return;
    if (!ultimo.pregunta && (esOpcionArmar(op, opcionArmar) || esOpcionArmar(op, opcionActualizar)) && s.puedeConcluir) { void armar(); return; }
    if (!puedeMandar) return;
    void mandar({
      texto: op,
      docs: [],
      // La opción N de una pregunta del diagnóstico ES la respuesta N: el motor la anota sin adivinar.
      ...(ultimo.pregunta ? { respuesta: { preguntaId: ultimo.pregunta.id, idx } } : {}),
      fuente: 'tu respuesta',
    });
  };

  // ── El selector: abrir una conversación o empezar una ──────────────────────
  const abrirSesion = async (id: number) => {
    setHoja(null);
    // La que ya está abierta no se vuelve a pedir: re-abrirla descartaría lo que esté en vuelo.
    if (sesionRef.current?.id === id) return;
    cambiandoRef.current = true;
    setCambiando(true);
    setErrorSelector(null);
    try {
      const r = await llamarOffer<{ sesion: OfferSesionVista }>({ action: 'abrir', id }, TOPE.corto);
      reiniciar();
      sesionId.current = r.sesion.id;
      ponerSesion(r.sesion);
      setArbol((a) => conSesionEnArbol(a, r.sesion, resumenDe(r.sesion)));
      alFondo(false);
      // Como escritorio (`vistaDeEntrada`): una conversación concluida abre en su oferta.
      if (vistaDeEntrada(r.sesion) === 'conclusion') { setVistaOferta('conclusion'); setHoja('oferta'); }
    } catch (err) {
      setErrorSelector(mensajeDeError(err));
    } finally {
      cambiandoRef.current = false;
      setCambiando(false);
    }
  };

  const nuevaSesion = async (funnelId: number, ofertaBaseId: number | null) => {
    setHoja(null);
    cambiandoRef.current = true;
    setCambiando(true);
    setErrorSelector(null);
    try {
      const r = await llamarOffer<{ sesion: OfferSesionVista }>({ action: 'nueva', funnelId, ofertaBaseId }, TOPE.turno, 'Tardó demasiado en abrir. Prueba de nuevo.');
      // 'nueva' puede devolver la MISMA abierta (el servidor reusa la que sigue vacía): no se reinicia.
      if (r.sesion.id === sesionRef.current?.id) return;
      reiniciar();
      sesionId.current = r.sesion.id;
      ponerSesion(r.sesion);
      setArbol((a) => conSesionEnArbol(a, r.sesion, resumenDe(r.sesion)));
      alFondo(false);
      void refrescarArbol();
    } catch (err) {
      setErrorSelector(mensajeDeError(err));
    } finally {
      cambiandoRef.current = false;
      setCambiando(false);
    }
  };

  // El link del CRM a una oferta sin conversación abre la nueva UNA vez (el ref sobrevive al doble efecto).
  const alAbrir = useRef(analizarAlAbrir);
  useEffect(() => {
    const p = alAbrir.current;
    if (!p) return;
    alAbrir.current = null;
    void nuevaSesion(p.funnelId, p.ofertaBaseId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- corre al montar y nunca más
  }, []);

  const guardarOferta = async (): Promise<AvisoGuardado | null> => {
    const id = sesionRef.current?.id;
    if (id == null) return null;
    const e = epoca.current;
    const r = await llamarOffer<{ ofertaId: number; sesion: OfferSesionVista; aviso?: unknown; avisoReintentable?: unknown }>({ action: 'guardar-oferta', sesionId: id }, TOPE.corto);
    aplicarSesion(r.sesion, e);
    void refrescarArbol();
    return typeof r.aviso === 'string' && r.aviso.trim() ? { texto: r.aviso, reintentable: r.avisoReintentable === true } : null;
  };

  // ── Lo que se dibuja ───────────────────────────────────────────────────────
  const conclusion = sesion?.conclusion ?? null;
  const ocupado = respondiendo || leyendo || gen.corriendo || cambiando;
  const bienvenida = bienvenidaDe(arbolLeido, arbolVacio(arbol));
  const camino = sesion ? caminoDeSesion(sesion) : null;
  const progreso = sesion ? progresoDePiezas(sesion.piezas) : null;
  const opciones = sesion ? opcionesRapidas(sesion, pendiente != null, opcionArmar, opcionActualizar) : [];
  const verOferta = () => { if (conclusion) { setVistaOferta('conclusion'); setHoja('oferta'); } };
  // Mientras se arma, la franja lleva a ver el avance; si no, a las piezas.
  const abrirFranja = () => {
    if (gen.corriendo || gen.error) { setVistaOferta('generando'); setHoja('oferta'); return; }
    setHoja('piezas');
  };
  const vistaHoja: 'generando' | 'conclusion' = vistaOferta === 'conclusion' && conclusion ? 'conclusion' : 'generando';

  return (
    <div className="m-offer" style={sesion ? { paddingBottom: altoDock + 16 } : undefined}>
      {/* El selector: donde escritorio tiene el desplegable (en el lugar del título), una píldora con el camino. */}
      <div className="m-offer-cab">
        <button type="button" className="m-offer-selector" aria-haspopup="dialog"
          aria-label={camino ? `${ROTULOS.selector}: ${caminoEnUnaLinea(camino)}` : ROTULOS.selector}
          disabled={cambiando || gen.corriendo || arbolVacio(arbol)} onClick={() => setHoja('funnel')}>
          <Icon name="funnel" size={18} />
          {camino ? (
            <span className="m-offer-selector__camino">
              <span className="m-offer-selector__funnel">{camino.funnel}</span>
              <span aria-hidden className="m-offer-selector__sep">›</span>
              <span className="m-offer-selector__oferta">{camino.oferta}</span>
            </span>
          ) : <span className="m-offer-selector__camino">{ROTULOS.elegirFunnel}</span>}
          {cambiando ? <span className="mk-spin" aria-hidden /> : <Icon name="chevron" size={16} />}
        </button>
        {cambiando && <span className="m-sr" role="status">Abriendo</span>}
      </div>

      {!arbolLeido && sesion && (
        <p className="m-offer-linea m-offer-linea--warn" role="status">
          {ROTULOS.noCargaron} <button type="button" className="m-offer-lnk" onClick={() => void recargarArbol()} disabled={recargando}>{ROTULOS.volverACargar}</button>
        </p>
      )}
      {errorSelector && <p className="m-offer-linea m-offer-linea--bad" role="alert">{errorSelector}</p>}

      {!sesion ? (
        bienvenida === 'no-cargo'
          ? <ErrorM frase={ROTULOS.noCargaron} rotulo={ROTULOS.volverACargar} onReintentar={() => void recargarArbol()} />
          : bienvenida === 'sin-funnels'
            ? <VacioM frase={ROTULOS.sinFunnels} accion={{ rotulo: ROTULOS.irAlCrm, href: '/m/crm' }} />
            : <VacioM frase={ROTULOS.elegirArriba} accion={{ rotulo: 'Elegir un funnel', onClick: () => setHoja('funnel') }} />
      ) : (
        <HiloOfferM
          sesionId={sesion.id}
          mensajes={sesion.mensajes}
          pendiente={pendiente}
          respondiendo={respondiendo}
          fuente={fuente}
          opciones={opciones}
          opcionesHabilitadas={puedeMandar}
          onOpcion={elegirOpcion}
          onReintentar={sinContestar(sesion, respondiendo) ? () => void reintentarRespuesta() : null}
          onError={setErrorChat}
        />
      )}

      {sesion && capaPie && createPortal(
        <ComposerOfferM
          // Uno por conversación: una nota a medio grabar no viaja a otra (desmontar la cancela), como la
          // barra de escritorio (ChatOffer: `key={sesion.id}`). Lo que se manda decide con refs.
          key={sesion.id}
          arriba={(
            <>
              {errorChat && !hayVista && <p className="m-offer-dock__error" role="alert">{errorChat}</p>}
              {progreso && (
                // El riel de escritorio en una franja (el prototipo: «Tu oferta 9/14», la barra y «Ver»). La franja
                // abre las piezas; «Ver», con la oferta ya armada, la abre a ella (el «Ver mi oferta» del riel).
                <div className="m-offer-franja">
                  <button type="button" className="m-offer-franja__piezas" onClick={abrirFranja}
                    aria-label={gen.corriendo ? `${ROTULOS.tuOferta}: armando` : `${ROTULOS.tuOferta}: ${progreso.sabidas} de ${progreso.total}`}>
                    <span className="m-offer-franja__n">{ROTULOS.tuOferta} <b>{progreso.sabidas}/{progreso.total}</b></span>
                    <span className="m-offer-avance" data-viva={gen.corriendo ? '' : undefined} aria-hidden><i style={{ width: `${progreso.pct}%` }} /></span>
                    {gen.corriendo ? <span className="mk-spin" aria-hidden /> : !conclusion && <Icon name="chevron" size={16} />}
                  </button>
                  {conclusion && !gen.corriendo && (
                    <button type="button" className="m-offer-lnk m-offer-franja__ver" aria-label={ROTULOS.verMiOferta} onClick={verOferta}>Ver</button>
                  )}
                </div>
              )}
            </>
          )}
          texto={texto}
          onTexto={setTexto}
          onEnviar={() => void enviarComposer()}
          ocupado={ocupado}
          enLinea={enLinea}
          onArchivos={agregarArchivos}
          puedeAdjuntar={lista.items.length < MAX_ADJUNTOS}
          onAudio={mandarAudio}
          audioEnEspera={audioEnEspera ? { url: audioEnEspera.url, secs: audioEnEspera.secs } : null}
          onReenviarAudio={reenviarAudio}
          onDescartarAudio={descartarAudio}
          onError={setErrorChat}
          onAltura={setAltoDock}
        />,
        capaPie,
      )}

      {hayVista && (
        <VistaAdjuntosM
          items={lista.items}
          onAgregar={agregarArchivos}
          onQuitar={quitarArchivo}
          onCerrar={cerrarVista}
          texto={texto}
          onTexto={setTexto}
          onEnviar={() => void enviarVista()}
          accept={ACCEPT_IMPORTAR}
          maxArchivos={MAX_ADJUNTOS}
          enviando={leyendo}
          puedeEnviar={puedeMandar && enLinea}
          estado={estadoVista}
          error={errorVista ?? errorChat}
          conError={falloId}
          acento="var(--primary)"
          placeholder="Escribe un mensaje…"
        />
      )}

      <HojaSelector abierto={hoja === 'funnel'} onCerrar={() => setHoja(null)} arbol={arbol} abiertaId={sesion?.id ?? null}
        onAbrir={(id) => void abrirSesion(id)} onNueva={(f, o) => void nuevaSesion(f, o)} />
      {sesion && (
        <HojaPiezas abierto={hoja === 'piezas'} onCerrar={() => setHoja(null)} piezas={sesion.piezas}
          acciones={{
            puedeConcluir: sesion.puedeConcluir,
            hayConclusion: !!conclusion,
            etiquetaArmar: etiquetaArmar(!!conclusion, opcionArmar, opcionActualizar),
            ocupado,
            onArmar: () => void armar(),
            onVer: verOferta,
          }} />
      )}
      <HojaOferta abierto={hoja === 'oferta' && !!sesion} onCerrar={() => setHoja(null)} vista={vistaHoja} gen={gen}
        sesion={sesion} conclusion={conclusion} onReintentar={() => void armar(gen.paso)} onGuardar={guardarOferta} />
    </div>
  );
}

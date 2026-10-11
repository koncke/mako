'use client';

// =============================================================================
// OfferApp — la tab Offer: un chat con MaKo que termina en una oferta y un PDF
// =============================================================================
// Pedido de Martín (11/10/2026): «Implementa completamente la funcionalidad de
// "Offer Analyst" y "Offer Generator" pero todo en una misma tab que se llame
// "Offer"... Quiero que esta tab sea muy de IA: en lugar de formularios
// larguísimos, algo simple como un chat con una IA, donde el usuario pueda escribir
// o mandar audio o adjuntar como en el Archivero... que no tenga mucho texto la tab
// y que el resultado final sea que te dé un PDF con la conclusión. Y que se pueda
// visualizar allí también la conclusión.»
//
// TRES VISTAS, un paso por pantalla:
//   chat        la conversación (también la bienvenida: sin sesión se dibuja el
//               primer mensaje de MaKo que trae la semilla, y la sesión recién se
//               crea con el primer turno o el primer archivo);
//   generando   una tarjeta con dos pasos: diagnóstico → oferta nueva;
//   conclusion  el diagnóstico y la oferta nueva, con el PDF.
//
// El motor vive en app/api/offer/route.ts y lib/offer-sesiones.ts; aquí sólo se
// llama al contrato (./offer-api.ts) y se dibuja lo que vuelve. Lo que la pantalla
// necesita del marco (piezas, dimensiones, tipos) sale de lib/offer-marco.ts.
//
// ⚠️ LA SESIÓN SE CREA UNA SOLA VEZ, aunque se elijan tres archivos a la vez.
// 'leer' y 'turno' con `sesionId: null` crean una sesión cada uno: sin coordinar,
// adjuntar tres archivos en la bienvenida dejaba TRES sesiones, cada una con un
// archivo. `escribir` hace que el primero cree y los demás esperen su id.
//
// ⚠️ CAMBIAR DE SESIÓN DESCARTA LO QUE ESTABA EN VUELO (`epoca`). Lo que el
// servidor ya recibió se guarda igual en la sesión de antes; lo que no puede pasar
// es que la respuesta de la sesión vieja se dibuje en la nueva.

import { useCallback, useRef, useState } from 'react';
import { Banner, Button, PageHeader } from '@/app/_ui';
import { MAX_ARCHIVO_BYTES, porQueNoPuedo, puedeLeerse } from '@/lib/formatos-archivo';
import type { AdjuntoVista, OfferMensaje, OfferSesionResumen, OfferSesionVista, PiezasSabidas } from '@/lib/offer-marco';
import { Chat } from './Chat';
import { Composer, type AdjuntoEnCurso } from './Composer';
import { Conclusion } from './Conclusion';
import { Generando, type PasoGeneracion } from './Generando';
import { Historial } from './Historial';
import { BarraPiezasMovil, RielPiezas, type AccionesPiezas } from './PiezasRail';
import { conResumen, esOpcionArmar, hayChatDespuesDe, reemplaza, resumenDe, vistaDeEntrada, type VistaOffer } from './ayudas';
import { CSS_OFFER } from './estilos';
import { ErrorOfferApi, TOPE, llamarOffer, mensajeDeError, subirArchivo } from './offer-api';

export type SemillaOffer = { piezas: PiezasSabidas; primerMensaje: OfferMensaje };

type EstadoGeneracion = { paso: PasoGeneracion; corriendo: boolean; error: string | null };
const GEN_QUIETA: EstadoGeneracion = { paso: 'diagnostico', corriendo: false, error: null };

/** Se tira cuando la persona cambió de sesión con algo en vuelo: no es un error que mostrar. */
class Descartado extends Error {}

let secuencia = 0;
const claveNueva = (): string => `a${Date.now().toString(36)}${(secuencia++).toString(36)}`;

export function OfferApp({ sesionesIniciales, sesionInicial, semilla, historialFallo, opcionArmar }: {
  sesionesIniciales: OfferSesionResumen[];
  /** La sesión más reciente, abierta. null = bienvenida. */
  sesionInicial: OfferSesionVista | null;
  semilla: SemillaOffer;
  /** El server no pudo leer el historial (la pantalla igual abre). */
  historialFallo: boolean;
  /** La respuesta rápida que dispara la generación (lib/offer-reglas.ts → OPCION_ARMAR). */
  opcionArmar: string;
}) {
  const [sesiones, setSesiones] = useState<OfferSesionResumen[]>(sesionesIniciales);
  const [sesion, setSesion] = useState<OfferSesionVista | null>(sesionInicial);
  const [vista, setVista] = useState<VistaOffer>(vistaDeEntrada(sesionInicial));
  const [texto, setTexto] = useState('');
  const [adjuntos, setAdjuntos] = useState<AdjuntoEnCurso[]>([]);
  const [pendiente, setPendiente] = useState<OfferMensaje | null>(null);
  const [errorChat, setErrorChat] = useState<string | null>(null);
  /** Reintentando la respuesta de MaKo: hay espera, pero ningún mensaje nuevo que dibujar. */
  const [reintentando, setReintentando] = useState(false);
  const [gen, setGen] = useState<EstadoGeneracion>(GEN_QUIETA);
  const [abriendo, setAbriendo] = useState<number | null>(null);
  const [errorHistorial, setErrorHistorial] = useState<string | null>(null);
  const [avisoHistorial, setAvisoHistorial] = useState(historialFallo);

  const sesionId = useRef<number | null>(sesionInicial?.id ?? null);
  const creacion = useRef<Promise<void> | null>(null);
  const epoca = useRef(0);
  const generando = useRef(false);
  const enviando = useRef(false);

  // ── La sesión que vuelve del servidor ──────────────────────────────────────
  const aplicarSesion = useCallback((nueva: OfferSesionVista, e: number) => {
    if (e !== epoca.current) return;
    sesionId.current = nueva.id;
    setSesion((actual) => (reemplaza(actual, nueva) ? nueva : actual));
    setSesiones((l) => conResumen(l, resumenDe(nueva)));
  }, []);

  /**
   * Corre una escritura que necesita el id de la sesión. Si todavía no hay sesión,
   * la PRIMERA la crea (manda null) y las que llegan mientras tanto esperan su id.
   * La reserva es sincrónica: entre leer `creacion` y escribirla no hay ningún
   * `await`, así que dos archivos elegidos juntos no pueden crear dos sesiones.
   */
  const escribir = useCallback(async <R extends { sesion: OfferSesionVista }>(e: number, llamar: (id: number | null) => Promise<R>): Promise<R> => {
    for (;;) {
      if (e !== epoca.current) throw new Descartado();
      const id = sesionId.current;
      if (id != null) return llamar(id);
      const enCurso = creacion.current;
      if (enCurso) { await enCurso; continue; }
      let soltar: () => void = () => undefined;
      const mia = new Promise<void>((res) => { soltar = res; });
      creacion.current = mia;
      try {
        const r = await llamar(null);
        if (e === epoca.current) sesionId.current = r.sesion.id;
        return r;
      } catch (err) {
        // Un turno cuya IA falló igual CREÓ la sesión (y guardó el mensaje): el id se toma acá,
        // antes de soltar a los que esperan, o el próximo archivo crearía una segunda sesión.
        if (err instanceof ErrorOfferApi && err.sesion && e === epoca.current) sesionId.current = err.sesion.id;
        throw err;
      } finally {
        soltar();
        if (creacion.current === mia) creacion.current = null;
      }
    }
  }, []);

  /** Deja la pantalla limpia para otra sesión (o para la bienvenida). */
  const reiniciar = useCallback(() => {
    epoca.current += 1;
    sesionId.current = null;
    creacion.current = null;
    enviando.current = false;
    setPendiente(null);
    setAdjuntos([]);
    setTexto('');
    setErrorChat(null);
    setReintentando(false);
    setGen(GEN_QUIETA);
  }, []);

  // ── Mandar un turno ────────────────────────────────────────────────────────
  /** Manda un mensaje. Devuelve true si MaKo contestó. */
  const mandar = async (t: string, docs: AdjuntoVista[]): Promise<boolean> => {
    const limpio = t.trim();
    if ((!limpio && !docs.length) || enviando.current) return false;
    enviando.current = true;
    const e = epoca.current;
    setErrorChat(null);
    // Optimista: el mensaje del dueño se dibuja ya, mientras MaKo contesta.
    setPendiente({ id: 'pendiente', de: 'yo', texto: limpio, at: new Date().toISOString(), adjuntos: docs.length ? docs : undefined });
    try {
      const r = await escribir(e, (id) => llamarOffer<{ sesion: OfferSesionVista }>(
        { action: 'turno', sesionId: id, texto: limpio, docIds: docs.map((d) => d.id) },
        TOPE.turno,
        'MaKo tardó demasiado en contestar. Prueba de nuevo.',
      ));
      aplicarSesion(r.sesion, e);
      return e === epoca.current;
    } catch (err) {
      if (err instanceof Descartado || e !== epoca.current) return false;
      setErrorChat(mensajeDeError(err));
      // El mensaje quedó guardado aunque MaKo no contestó: se dibuja la sesión que
      // mandó el servidor y el texto NO vuelve al composer (reenviarlo lo duplicaría).
      // La salida es «Reintentar», que corre la IA sobre lo guardado.
      if (err instanceof ErrorOfferApi && err.sesion) { aplicarSesion(err.sesion, e); return true; }
      // Sin sesión en el error (un corte de red, un 504): antes de devolver el texto al composer se
      // relee la conversación. Si el mensaje ya quedó guardado, devolverlo haría que se mande dos veces.
      const id = sesionId.current;
      if (id != null) {
        try {
          const r = await llamarOffer<{ sesion: OfferSesionVista }>({ action: 'abrir', id }, TOPE.corto);
          const ultimoYo = [...r.sesion.mensajes].reverse().find((m) => m.de === 'yo');
          if (e === epoca.current) aplicarSesion(r.sesion, e);
          if (ultimoYo && ultimoYo.texto.trim() === limpio) return true;
        } catch { /* sin conexión: se devuelve el texto, que es lo seguro */ }
      }
      return false;
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
    setReintentando(true);
    try {
      const r = await llamarOffer<{ sesion: OfferSesionVista }>(
        { action: 'turno', sesionId: id, reintentar: true },
        TOPE.turno,
        'MaKo tardó demasiado en contestar. Prueba de nuevo.',
      );
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

  const listos = adjuntos.filter((a) => a.estado === 'listo' && a.doc);
  const leyendo = adjuntos.some((a) => a.estado === 'leyendo');
  const respondiendo = pendiente != null || reintentando;
  const puedeMandar = !respondiendo && !leyendo && !gen.corriendo;
  const hayAlgo = texto.trim().length > 0 || listos.length > 0;

  /**
   * Manda lo del composer. Si falla, el texto y los archivos VUELVEN al composer:
   * perder lo que alguien escribió porque se cortó la conexión es peor que el corte.
   */
  const enviarComposer = async () => {
    if (!puedeMandar || !hayAlgo) return;
    const t = texto;
    const enviados = listos;
    const claves = new Set(enviados.map((a) => a.key));
    const e = epoca.current;
    setTexto('');
    setAdjuntos((prev) => prev.filter((a) => !claves.has(a.key)));
    const ok = await mandar(t, enviados.map((a) => a.doc as AdjuntoVista));
    if (!ok && e === epoca.current) {
      setTexto((ahora) => (ahora.trim() ? ahora : t));
      setAdjuntos((prev) => [...enviados, ...prev]);
    }
  };

  // ── Archivos ───────────────────────────────────────────────────────────────
  const marcarAdjunto = (key: string, e: number, cambio: Partial<AdjuntoEnCurso>) => {
    if (e !== epoca.current) return;
    setAdjuntos((prev) => prev.map((a) => (a.key === key ? { ...a, ...cambio } : a)));
  };

  /** Sube el archivo YA, lo lee, y deja su doc listo para el próximo mensaje. */
  const leerArchivo = async (key: string, f: File, e: number) => {
    try {
      const mime = f.type || 'application/octet-stream';
      const path = await subirArchivo(f, mime);
      const r = await escribir(e, (id) => llamarOffer<{ sesion: OfferSesionVista; doc: AdjuntoVista }>(
        { action: 'leer', sesionId: id, path, nombre: f.name, mime },
        TOPE.leer,
        'Leer el archivo tardó demasiado.',
      ));
      aplicarSesion(r.sesion, e);
      marcarAdjunto(key, e, { estado: 'listo', doc: r.doc });
    } catch (err) {
      if (err instanceof Descartado) return;
      marcarAdjunto(key, e, { estado: 'error', error: mensajeDeError(err) });
    }
  };

  const agregarArchivos = (archivos: File[]) => {
    const e = epoca.current;
    const nuevos: AdjuntoEnCurso[] = [];
    const aLeer: Array<{ key: string; f: File }> = [];
    for (const f of archivos) {
      const key = claveNueva();
      // Se valida ANTES de subir y se dice por qué no: un rebote mudo deja a la
      // persona esperando un archivo que nunca va a llegar.
      if (!puedeLeerse(f.name, f.type)) {
        const porque = porQueNoPuedo(f.name);
        nuevos.push({ key, nombre: f.name, estado: 'error', error: porque ? `Ese archivo ${porque}` : 'No leo ese formato.' });
      } else if (f.size > MAX_ARCHIVO_BYTES) {
        nuevos.push({ key, nombre: f.name, estado: 'error', error: `Pesa más de ${Math.round(MAX_ARCHIVO_BYTES / (1024 * 1024))} MB.` });
      } else {
        nuevos.push({ key, nombre: f.name, estado: 'leyendo' });
        aLeer.push({ key, f });
      }
    }
    if (!nuevos.length) return;
    setAdjuntos((prev) => [...prev, ...nuevos]);
    for (const { key, f } of aLeer) void leerArchivo(key, f, e);
  };

  const quitarAdjunto = (key: string) => setAdjuntos((prev) => prev.filter((a) => a.key !== key));

  // ── Armar la oferta ────────────────────────────────────────────────────────
  /**
   * Diagnóstico → oferta nueva. Si falla, se reintenta DESDE el paso que falló.
   * `generando` (un ref, no un estado) es lo que impide dispararlo dos veces: un
   * doble clic llega antes de que el estado se vuelva a dibujar.
   */
  const armar = async (desde: PasoGeneracion = 'diagnostico') => {
    const id = sesionId.current;
    if (id == null || generando.current) return;
    generando.current = true;
    const e = epoca.current;
    let paso: PasoGeneracion = desde === 'listo' ? 'diagnostico' : desde;
    setVista('generando');
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
      setVista('conclusion');
    } catch (err) {
      if (e === epoca.current) setGen({ paso, corriendo: false, error: mensajeDeError(err) });
    } finally {
      generando.current = false;
    }
  };

  const elegirOpcion = (op: string) => {
    if (esOpcionArmar(op, opcionArmar) && sesion?.puedeConcluir) { void armar(); return; }
    if (!puedeMandar) return;
    // Una respuesta rápida es un turno: los archivos ya leídos viajan con ella.
    const enviados = listos;
    const claves = new Set(enviados.map((a) => a.key));
    const e = epoca.current;
    setAdjuntos((prev) => prev.filter((a) => !claves.has(a.key)));
    void mandar(op, enviados.map((a) => a.doc as AdjuntoVista)).then((ok) => {
      if (!ok && e === epoca.current) setAdjuntos((prev) => [...enviados, ...prev]);
    });
  };

  // ── Historial y nueva oferta ───────────────────────────────────────────────
  const nuevaOferta = () => {
    reiniciar();
    setSesion(null);
    setVista('chat');
  };

  const refrescarLista = async () => {
    setErrorHistorial(null);
    try {
      const r = await llamarOffer<{ sesiones: OfferSesionResumen[] }>({ action: 'listar' }, TOPE.corto);
      setSesiones(Array.isArray(r.sesiones) ? r.sesiones : []);
      setAvisoHistorial(false);
    } catch {
      // Queda la lista que había: sigue sirviendo para abrir. Se dice que no se actualizó.
      setErrorHistorial('No se actualizó la lista.');
    }
  };

  const abrirSesion = async (id: number): Promise<boolean> => {
    if (abriendo != null) return false;
    // La que ya está abierta no se vuelve a pedir: re-abrirla descartaría lo que esté
    // en vuelo (un turno, un archivo) sobre esa misma sesión.
    if (sesion?.id === id) {
      setVista(vistaDeEntrada(sesion));
      return true;
    }
    setAbriendo(id);
    setErrorHistorial(null);
    try {
      const r = await llamarOffer<{ sesion: OfferSesionVista }>({ action: 'abrir', id }, TOPE.corto);
      reiniciar();
      sesionId.current = r.sesion.id;
      setSesion(r.sesion);
      setSesiones((l) => conResumen(l, resumenDe(r.sesion)));
      setVista(vistaDeEntrada(r.sesion));
      return true;
    } catch (err) {
      setErrorHistorial(mensajeDeError(err));
      return false;
    } finally {
      setAbriendo(null);
    }
  };

  const guardarOferta = async () => {
    const id = sesion?.id;
    if (id == null) return;
    const e = epoca.current;
    const r = await llamarOffer<{ ofertaId: number; sesion: OfferSesionVista }>({ action: 'guardar-oferta', sesionId: id }, TOPE.corto);
    aplicarSesion(r.sesion, e);
  };

  // ── Lo que se dibuja ───────────────────────────────────────────────────────
  const mensajes = sesion ? sesion.mensajes : [semilla.primerMensaje];
  const piezas = sesion ? sesion.piezas : semilla.piezas;
  const conclusion = sesion?.conclusion ?? null;
  const puedeConcluir = !!sesion?.puedeConcluir;
  const verOferta = () => { if (conclusion) setVista('conclusion'); };
  const acciones: AccionesPiezas = {
    puedeConcluir,
    hayConclusion: !!conclusion,
    ocupado: respondiendo || leyendo || gen.corriendo,
    onArmar: () => void armar(),
    onVer: verOferta,
  };
  const vistaReal: VistaOffer = vista === 'conclusion' && !conclusion ? 'chat' : vista;

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <style>{CSS_OFFER}</style>
      <PageHeader
        titulo="Offer"
        // Los dos en UNA fila propia: en el celular el header apila sus acciones a
        // todo el ancho, y en un chat eso se come dos renglones de pantalla.
        acciones={(
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
            {/* En la bienvenida, sin nada en vuelo, «Nueva oferta» no haría nada: no se dibuja. */}
            {(sesion || respondiendo || leyendo) && (
              <Button variant="tertiary" onClick={nuevaOferta} disabled={gen.corriendo}>Nueva oferta</Button>
            )}
            <Historial
              sesiones={sesiones}
              actualId={sesion?.id ?? null}
              abriendo={abriendo}
              error={errorHistorial}
              deshabilitado={gen.corriendo}
              onAbrir={abrirSesion}
              alAbrir={() => void refrescarLista()}
            />
          </div>
        )}
      />

      {avisoHistorial && (
        <div style={{ flex: 'none', marginBottom: 12 }}>
          <Banner tono="warn" onCerrar={() => setAvisoHistorial(false)}>No cargó tu historial.</Banner>
        </div>
      )}

      {vistaReal === 'generando' && (
        <Generando
          paso={gen.paso}
          corriendo={gen.corriendo}
          error={gen.error}
          onReintentar={() => void armar(gen.paso)}
          onVolver={() => { setGen(GEN_QUIETA); setVista('chat'); }}
        />
      )}

      {vistaReal === 'conclusion' && sesion && conclusion && (
        // La key remonta la vista con cada conclusión nueva: vuelve a abrir en
        // «Diagnóstico» y con las secciones de entrada, no donde quedó la anterior.
        <Conclusion
          key={`${sesion.id}-${conclusion.version}`}
          sesion={sesion}
          conclusion={conclusion}
          onSeguir={() => setVista('chat')}
          onGuardar={guardarOferta}
        />
      )}

      {vistaReal === 'chat' && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 24 }}>
          <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <BarraPiezasMovil piezas={piezas} acciones={acciones} />
            <Chat
              key={sesion?.id ?? 'nueva'}
              mensajes={mensajes}
              pendiente={pendiente}
              respondiendo={respondiendo}
              opcionesHabilitadas={puedeMandar}
              onOpcion={elegirOpcion}
              puedeConcluir={puedeConcluir}
              invitarAArmar={!sesion || hayChatDespuesDe(sesion)}
              hayConclusion={!!conclusion}
              ocupado={acciones.ocupado}
              onArmar={() => void armar()}
              onVerOferta={verOferta}
              opcionArmar={opcionArmar}
            />
            {/* Se CALCULA del estado (el último mensaje es del dueño y nadie está
                contestando), no se dispara desde el error: así también aparece si el
                fallo pasó en otra pestaña o antes de recargar. */}
            {!respondiendo && !!sesion && sesion.mensajes[sesion.mensajes.length - 1]?.de === 'yo' && (
              <div className="of-reintento" role="status">
                <span>MaKo no contestó tu último mensaje.</span>
                <Button variant="secondary" size="sm" onClick={() => void reintentarRespuesta()}>Reintentar</Button>
              </div>
            )}
            <Composer
              texto={texto}
              onTexto={setTexto}
              adjuntos={adjuntos}
              onArchivos={agregarArchivos}
              onQuitar={quitarAdjunto}
              onEnviar={() => void enviarComposer()}
              puedeEnviar={puedeMandar && hayAlgo}
              enviando={respondiendo}
              error={errorChat}
              onError={setErrorChat}
            />
          </div>
          <RielPiezas piezas={piezas} acciones={acciones} />
        </div>
      )}
    </div>
  );
}

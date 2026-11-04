'use client';

// =============================================================================
// El motor del hilo del grupo: lo nuevo sin recargar, y mandar sin esperar a MaKo (3/11/2026)
// =============================================================================
// El mismo en la computadora y en el teléfono (ChatDelGrupo.tsx y HojaDelGrupo.tsx). No es `useChatCliente`: ése espera el turno entero (hasta 420 s), lleva un
// turno por vez y marcaría «No te pude contestar esto» en cada mensaje entre personas.
//   · LO NUEVO: se lee cada 4 s con el hilo a la vista, con solape, y se mezcla por id (`urlDelSondeo`): así llegan la respuesta de MaKo, su reacción y el archivo
//     que se termina de subir, y no se saltea una fila ajena con id menor. El cursor sale SÓLO de lo que devuelve el GET, nunca de lo que uno escribió.
//   · MANDAR: el POST guarda y vuelve ya. Dos personas escriben mientras MaKo piensa. Cada mensaje lleva su `clienteId`: reintentar no duplica (lib/grupo-app.ts →
//     escribirDePersona), por eso acá SÍ se puede ofrecer «Reintentar» en lo que no se sabe si llegó. Un mensaje por vez, para que salgan en orden.
//   · UN FALLO MANTIENE LO DIBUJADO (la regla del 22/10): sólo un 404 de la lectura cambia la pantalla, y sale siempre el mismo («Ya no estás en este grupo»).
//   · LEÍDO: lo pide la pantalla, con el hilo abajo y la pestaña al frente, y con lo que se dibujó.
//
// ⚠️ El ws es el del grupo, en la URL. Nada de `?ws=` ni `conWs`: un invitado sigue parado en SU negocio (lib/grupo-puerta.ts).

import { useCallback, useEffect, useRef, useState } from 'react';
import { idLocal, leerRespuesta, type Leido } from '@/app/m/mako/chat-ui';
import { mismoValor } from '@/lib/centro-estable';
import { notaEnMp3 } from '@/app/second-brain/nota-de-voz';
import type { MensajeDelHilo } from '@/lib/grupo-reglas';
import { FRASES_DEL_GRUPO, cursorNuevo, mezclarMensajes, urlDelSondeo, type MensajeDeWhatsApp, type PaginaDelGrupo, type PendienteDelGrupo } from './pantalla';

/** Cada cuánto se lee lo nuevo con el hilo a la vista. Sin medir con carga: es criterio. */
export const MS_HILO_DEL_GRUPO = 4000;
/** Lo que se espera después de mandar para ver si MaKo se puso a pensar. */
const MS_TRAS_MANDAR = 1200;
/** Cuántas páginas seguidas se leen en una vuelta, si llegó mucho junto. */
const VUELTAS_MAX = 5;

export type EstadoDelHilo = 'cargando' | 'listo' | 'error' | 'fuera';

async function pedir<T>(url: string, init?: RequestInit): Promise<Leido<T>> {
  try {
    const r = await fetch(url, { cache: 'no-store', ...init });
    return leerRespuesta<T>(r.status, await r.text());
  } catch {
    return { ok: false, error: FRASES_DEL_GRUPO.noSalio, reintentable: false };
  }
}

export function useHiloDelGrupo({ ws, visible, onLeido }: {
  ws: number;
  /** ¿Se está viendo? Montado y escondido (se fue a otro chat) no se sondea. */
  visible: boolean;
  onLeido?: (ws: number, hastaId: number) => void;
}) {
  const base = `/api/grupos/${ws}`;
  const [mensajes, setMensajes] = useState<readonly MensajeDelHilo[]>([]);
  const [pendientes, setPendientes] = useState<readonly PendienteDelGrupo[]>([]);
  const [estado, setEstado] = useState<EstadoDelHilo>('cargando');
  const [hayAntes, setHayAntes] = useState(false);
  const [trayendo, setTrayendo] = useState(false);
  const [pensando, setPensando] = useState(false);
  const [ahora, setAhora] = useState(() => Date.now());
  const [cita, setCita] = useState<MensajeDelHilo | null>(null);
  const [deWhatsApp, setDeWhatsApp] = useState<{ mensajes: readonly MensajeDeWhatsApp[]; hayMas: boolean; pidiendo: boolean; nada: boolean }>({ mensajes: [], hayMas: true, pidiendo: false, nada: false });
  const cursor = useRef(0);
  const leyendo = useRef(false);
  const cargado = useRef(false);
  const vivo = useRef(true);
  const leidoHasta = useRef(0);
  const cola = useRef<Promise<void>>(Promise.resolve());
  const lista = useRef(mensajes);
  lista.current = mensajes;
  const pendientesRef = useRef(pendientes);
  pendientesRef.current = pendientes;

  const cargar = useCallback(async () => {
    if (leyendo.current) return;
    leyendo.current = true;
    try {
      const l = await pedir<PaginaDelGrupo>(`${base}/mensajes`);
      if (!vivo.current) return;
      if (!l.ok) { setEstado(l.status === 404 ? 'fuera' : 'error'); return; }
      cargado.current = true;
      cursor.current = cursorNuevo(cursor.current, l.datos.cursor);
      setMensajes((antes) => mismoValor(antes, mezclarMensajes(antes, l.datos.mensajes ?? [])));
      setHayAntes(!!l.datos.hayMas);
      setPensando(!!l.datos.makoPensando);
      setAhora(Date.now());
      setEstado('listo');
    } finally { leyendo.current = false; }
  }, [base]);

  /** Lo posterior a lo que ya se tiene. Si no se pudo leer ninguna vez, vuelve a intentar la primera. */
  const sondear = useCallback(async () => {
    if (!cargado.current) { await cargar(); return; }
    if (leyendo.current) return;
    leyendo.current = true;
    try {
      let url = urlDelSondeo(ws, cursor.current);
      for (let i = 0; i < VUELTAS_MAX; i++) {
        const l = await pedir<PaginaDelGrupo>(url);
        if (!vivo.current) return;
        if (!l.ok) { if (l.status === 404) setEstado('fuera'); return; }
        cursor.current = cursorNuevo(cursor.current, l.datos.cursor);
        // Sin esto, una vuelta sin nada nuevo redibuja el hilo entero cada 4 s (lib/centro-estable.ts).
        setMensajes((antes) => mismoValor(antes, mezclarMensajes(antes, l.datos.mensajes ?? [])));
        setPensando(!!l.datos.makoPensando);
        setEstado('listo');
        if (!l.datos.hayMas) return;
        url = `${base}/mensajes?despues=${cursor.current}`;
      }
    } finally { leyendo.current = false; }
  }, [base, ws, cargar]);

  useEffect(() => {
    vivo.current = true;
    void cargar();
    return () => { vivo.current = false; };
  }, [cargar]);

  useEffect(() => {
    if (!visible) return;
    const aLaVista = () => document.visibilityState === 'visible';
    void sondear();
    const t = window.setInterval(() => { if (aLaVista()) void sondear(); }, MS_HILO_DEL_GRUPO);
    const alVolver = () => { if (aLaVista()) { setAhora(Date.now()); void sondear(); } };
    document.addEventListener('visibilitychange', alVolver);
    return () => { window.clearInterval(t); document.removeEventListener('visibilitychange', alVolver); };
  }, [visible, sondear]);

  const soltar = useCallback((id: string) => {
    setPendientes((xs) => {
      const p = xs.find((x) => x.id === id);
      if (p?.url) URL.revokeObjectURL(p.url);
      return xs.filter((x) => x.id !== id);
    });
  }, []);

  const postear = useCallback(async (p: PendienteDelGrupo) => {
    let init: RequestInit;
    try {
      if (p.archivo || p.voz) {
        const fd = new FormData();
        fd.set('texto', p.texto);
        fd.set('clienteId', p.clienteId);
        if (p.respondeA != null) fd.set('respondeA', String(p.respondeA));
        if (p.sigue) fd.set('sigue', '1');
        if (p.archivo) fd.set('archivo', p.archivo, p.archivo.name);
        if (p.voz) {
          fd.set('voz', await notaEnMp3(p.voz.blob), 'nota.mp3');
          fd.set('secs', String(Math.max(1, Math.round(p.voz.secs))));
        }
        init = { method: 'POST', body: fd };
      } else {
        init = {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ texto: p.texto, clienteId: p.clienteId, respondeA: p.respondeA, sigue: p.sigue }),
        };
      }
    } catch (e) {
      setPendientes((xs) => xs.map((x) => (x.id === p.id ? { ...x, estado: 'error', error: e instanceof Error ? e.message : FRASES_DEL_GRUPO.noSalio } : x)));
      return;
    }
    const l = await pedir<{ mensaje?: MensajeDelHilo }>(`${base}/mensajes`, init);
    const mensaje = l.ok ? l.datos.mensaje : null;
    if (mensaje) {
      setMensajes((antes) => mezclarMensajes(antes, [mensaje]));
      soltar(p.id);
      window.setTimeout(() => { if (vivo.current) void sondear(); }, MS_TRAS_MANDAR);
      return;
    }
    // Sólo un rechazo con su motivo se dice tal cual; todo lo demás, sin el error de nadie. Un 404 puede ser la cita: si la persona ya no entra, lo dice el sondeo.
    const motivo = !l.ok && l.reintentable && l.status !== 404 ? l.error : FRASES_DEL_GRUPO.noSalio;
    setPendientes((xs) => xs.map((x) => (x.id === p.id ? { ...x, estado: 'error', error: motivo } : x)));
    if (!l.ok && l.status === 404) void sondear();
  }, [base, soltar, sondear]);

  const encolar = useCallback((p: PendienteDelGrupo) => {
    cola.current = cola.current.then(() => postear(p)).catch(() => {});
  }, [postear]);

  /** Lo escrito y lo adjuntado. Con archivos, uno por mensaje como WhatsApp: el texto va con el primero, y la respuesta de MaKo es por todos (`sigue`). */
  const enviar = useCallback((texto: string, archivos: readonly File[] = []) => {
    const t = texto.trim();
    if (!t && !archivos.length) return;
    const respondeA = cita?.id ?? null;
    setCita(null);
    const partes = archivos.length
      ? archivos.map((f, i) => ({ texto: i === 0 ? t : '', archivo: f, sigue: i < archivos.length - 1 }))
      : [{ texto: t, archivo: null as File | null, sigue: false }];
    const nuevos = partes.map((x, i): PendienteDelGrupo => {
      const id = idLocal('g');
      return { id, clienteId: id, texto: x.texto, respondeA: i === 0 ? respondeA : null, sigue: x.sigue, archivo: x.archivo, voz: null, url: x.archivo ? URL.createObjectURL(x.archivo) : null, estado: 'enviando' };
    });
    setPendientes((xs) => [...xs, ...nuevos]);
    for (const p of nuevos) encolar(p);
  }, [cita, encolar]);

  /** La nota de voz: sale en el acto y se guarda siempre (27/10/2026). Transcribirla es del turno, después. */
  const enviarNota = useCallback((audio: Blob, secs: number) => {
    const id = idLocal('g');
    const respondeA = cita?.id ?? null;
    setCita(null);
    const p: PendienteDelGrupo = { id, clienteId: id, texto: '', respondeA, sigue: false, archivo: null, voz: { blob: audio, secs }, url: URL.createObjectURL(audio), estado: 'enviando' };
    setPendientes((xs) => [...xs, p]);
    encolar(p);
  }, [cita, encolar]);

  const reintentar = useCallback((id: string) => {
    const p = pendientesRef.current.find((x) => x.id === id);
    if (!p || p.estado === 'enviando') return;
    const otra: PendienteDelGrupo = { ...p, estado: 'enviando', error: undefined };
    setPendientes((xs) => xs.map((x) => (x.id === id ? otra : x)));
    encolar(otra);
  }, [encolar]);

  const verAnteriores = useCallback(async () => {
    const primero = lista.current[0];
    if (!primero || trayendo) return;
    setTrayendo(true);
    const l = await pedir<PaginaDelGrupo>(`${base}/mensajes?antes=${primero.id}`);
    if (!vivo.current) return;
    setTrayendo(false);
    if (!l.ok) { if (l.status === 404) setEstado('fuera'); return; }
    setMensajes((antes) => mezclarMensajes(antes, l.datos.mensajes ?? []));
    setHayAntes(!!l.datos.hayMas);
  }, [base, trayendo]);

  /** Lo anterior del grupo de WhatsApp: se lee en el momento, no se copia. A un invitado le daría 404: la pantalla no lo ofrece. */
  const verDeWhatsApp = useCallback(async () => {
    if (deWhatsApp.pidiendo) return;
    const desde = deWhatsApp.mensajes[0]?.creadoEn ?? lista.current[0]?.creadoEn ?? null;
    setDeWhatsApp((d) => ({ ...d, pidiendo: true }));
    const l = await pedir<{ mensajes?: MensajeDeWhatsApp[]; hayMas?: boolean }>(`${base}/whatsapp${desde ? `?antes=${encodeURIComponent(desde)}` : ''}`);
    if (!vivo.current) return;
    setDeWhatsApp((d) => {
      if (!l.ok) return { ...d, pidiendo: false };
      const nuevos = l.datos.mensajes ?? [];
      return { mensajes: [...nuevos, ...d.mensajes], hayMas: !!l.datos.hayMas, pidiendo: false, nada: !nuevos.length && !d.mensajes.length };
    });
  }, [base, deWhatsApp.mensajes, deWhatsApp.pidiendo]);

  /** Hasta lo último que se dibujó. Sube y nunca baja, también en el servidor. Si no se pudo anotar, la vuelta siguiente lo intenta. */
  const marcarLeido = useCallback(() => {
    if (document.visibilityState !== 'visible') return;
    const ultimo = lista.current[lista.current.length - 1]?.id ?? 0;
    if (ultimo <= leidoHasta.current) return;
    const antes = leidoHasta.current;
    leidoHasta.current = ultimo;
    onLeido?.(ws, ultimo);
    void pedir(`${base}/leido`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hastaId: ultimo }) })
      .then((l) => { if (!l.ok && leidoHasta.current === ultimo) leidoHasta.current = antes; });
  }, [base, onLeido, ws]);

  return {
    ws, estado, mensajes, pendientes, hayAntes, trayendo, pensando, ahora, cita, setCita, deWhatsApp,
    enviar, enviarNota, reintentar, descartar: soltar, verAnteriores, verDeWhatsApp, sondear, recargar: cargar, marcarLeido,
  };
}

export type HiloDelGrupoK = ReturnType<typeof useHiloDelGrupo>;

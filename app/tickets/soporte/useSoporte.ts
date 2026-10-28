// =============================================================================
// useSoporte — el motor del chat de Soporte de la Ticketera del cliente (23/10/2026): uno para la computadora y el teléfono
// =============================================================================
// Lo que hace la conversación (lib/soporte-chat.ts dice QUÉ dice MaKo; esto lo lleva a la pantalla):
//   · «nuevo»: la persona cuenta, MaKo repregunta lo justo y propone el ticket; la tarjeta lo manda
//     (`levantarDesdeSoporteAction`) y la conversación pasa a ser la de ese ticket, con el «Listo» de MaKo;
//   · un ticket: sus líneas, y lo que escribe la persona sale como respuesta al equipo (`contestarTicketAction`).
// ⚠️ SIN 'use client' A PROPÓSITO (como usarMisTickets.ts): es un hook que sólo importan componentes de cliente.
// ⚠️ De quién son los tickets lo dicen las acciones con la SESIÓN (app/tickets/acciones.ts): nada de acá lo elige.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { contestarTicketAction, levantarDesdeSoporteAction, verMiTicketAction } from '../acciones';
import { contextoDelNavegador } from '../navegador';
import { CHARLA_VACIA, SALUDO, borradorValido, preguntar, queSigue, sumar, type Borrador, type Charla } from '@/lib/soporte-chat';
import type { TicketCliente, TipoTicket } from '@/lib/tickets-reglas';
import { idDelBorrador, itemsDeCharla, itemsDeTicket, placeholderDe, type Turno } from './hilo-soporte';
import { subirAdjuntosTicket } from './subir-adjuntos';
import { ACCEPT_TICKET, lineaDeAdjuntos, mimeDeArchivoTicket, problemaDeAdjuntosTicket, type AdjuntoTicket } from '@/lib/tickets-adjuntos';
import type { AdjuntoCaja } from '@/app/admin/operaciones/useCentro';
import { useNotaEnElActo } from '@/app/_chat/useNotaEnElActo';

let secuencia = 0;
const id = (pre: string) => `${pre}-${Date.now().toString(36)}-${(++secuencia).toString(36)}`;
const uuid = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
const saludo = (): Turno[] => [{ id: id('m'), de: 'mako', texto: SALUDO, at: new Date().toISOString() }];
/** Lo que MaKo «escribe» antes de contestar en la conversación nueva (28/10/2026, el Cerebro: «Soporte: la voz en el acto y
 *  los 3 puntos»). Contesta con reglas y en el acto, pero se lo ve escribir como en todo chat de MaKo, y lo que arma se ve
 *  armándose, con un pequeño delay (Martín, 28/10). En un ticket contesta el equipo, horas después: ahí no hay puntos. */
export const MAKO_ESCRIBE_MS = 700;

export type Abierto = 'nuevo' | number;

export function useSoporte({ tickets: deAfuera, inicial = 'nuevo', movil = false }: {
  /** Los tickets que lee la página (o el refresco de cada minuto del Ops Center). null = todavía no llegaron. */
  tickets: TicketCliente[] | null;
  inicial?: Abierto;
  movil?: boolean;
}) {
  // Los de afuera mandan; los que trajo esta pantalla (el recién mandado, una respuesta) se ven hasta que el refresco los traiga.
  const [propios, setPropios] = useState<TicketCliente[]>([]);
  const tickets = useMemo(() => {
    const base = deAfuera ?? [];
    const ids = new Set(base.map((t) => t.id));
    const nuevos = propios.filter((t) => !ids.has(t.id));
    const porId = new Map(propios.map((t) => [t.id, t]));
    // Un ticket que esta pantalla actualizó después que el refresco (una respuesta recién mandada) se ve como quedó.
    const mezclados = base.map((t) => { const p = porId.get(t.id); return p && Date.parse(p.actualizado) > Date.parse(t.actualizado) ? p : t; });
    return [...nuevos, ...mezclados].sort((a, b) => Date.parse(b.actualizado) - Date.parse(a.actualizado));
  }, [deAfuera, propios]);

  const [abierto, setAbierto] = useState<Abierto>(inicial);
  const [charla, setCharla] = useState<Charla>(CHARLA_VACIA);
  const [turnos, setTurnos] = useState<Turno[]>(saludo);
  /** Lo de la persona que sale a un ticket, y el «Listo» de MaKo del recién mandado. */
  const [extra, setExtra] = useState<Record<number, Turno[]>>({});
  const [texto, setTexto] = useState('');
  const [tipoElegido, setTipoElegido] = useState<TipoTicket | null>(null);
  const [mandando, setMandando] = useState(false);
  const [errorTarjeta, setErrorTarjeta] = useState<string | null>(null);
  /** Las respuestas de MaKo que está «escribiendo» (los 3 puntos). */
  const [escribiendo, setEscribiendo] = useState(0);
  const ref = useRef<string>(uuid());
  // La conversación nueva de AHORA, como estado: la clave de sus notas de voz (la revisión de chats-unificados, 28/10/2026: con «soporte:nuevo» para todas, una
  // nota grabada antes de mandar el ticket salía como primer mensaje de la conversación SIGUIENTE).
  const [idConversacion, setIdConversacion] = useState(() => ref.current);
  const otraConversacion = () => { ref.current = uuid(); setIdConversacion(ref.current); };
  // ── Lo que se adjunta (28/10/2026, Martín: «no permite adjuntar ni archivos ni capturas ni documentos»): lib/tickets-adjuntos.ts.
  // `adjuntos`: lo elegido en la caja, antes de mandar. `delTicket`: lo que ya subió en la conversación NUEVA y viaja con el
  // ticket al levantarlo (en un ticket abierto, cada respuesta lleva los suyos).
  const [adjuntos, setAdjuntos] = useState<AdjuntoCaja[]>([]);
  const [errorAdjunto, setErrorAdjunto] = useState<string | null>(null);
  const delTicket = useRef<AdjuntoTicket[]>([]);
  // Las subidas de la conversación NUEVA que no terminaron: el ticket las espera antes de salir (revisión de 046d9e028: salía sin
  // los archivos, y la foto que terminaba de subir después se iba con el PRÓXIMO ticket de esa persona).
  const subidas = useRef(new Set<Promise<void>>());
  const [subiendo, setSubiendo] = useState(false);
  const sumarAdjuntos = useCallback((lista: readonly File[]) => {
    const validos = lista.filter((f) => mimeDeArchivoTicket(f.name, f.type));
    if (validos.length < lista.length) setErrorAdjunto('Sólo fotos, capturas, PDF, Word, Excel o texto.');
    if (!validos.length) return;
    // En la conversación nueva el tope es por ticket: cuenta lo que ya subió y lo que está subiendo.
    const yaVan = typeof abierto === 'number' ? 0
      : delTicket.current.length + turnos.reduce((n, x) => n + (x.estado === 'enviando' ? x.archivos?.length ?? 0 : 0), 0);
    const mal = problemaDeAdjuntosTicket([...adjuntos.map((a) => a.file), ...validos], yaVan);
    if (mal) { setErrorAdjunto(mal); return; }
    setErrorAdjunto(null);
    setAdjuntos((xs) => [...xs, ...validos.map((f): AdjuntoCaja => ({ id: id('a'), file: f, tipo: f.type.startsWith('image/') ? 'image' : 'document', url: URL.createObjectURL(f) }))]);
  }, [adjuntos, abierto, turnos]);
  const quitarAdjunto = useCallback((idA: string) => setAdjuntos((xs) => { const a = xs.find((x) => x.id === idA); if (a) URL.revokeObjectURL(a.url); return xs.filter((x) => x.id !== idA); }), []);

  const ticket = typeof abierto === 'number' ? tickets.find((t) => t.id === abierto) ?? null : null;
  // Abrió uno que todavía no llegó (el link de un aviso): se lee.
  useEffect(() => {
    if (typeof abierto !== 'number' || ticket || deAfuera == null) return;
    let vivo = true;
    void verMiTicketAction(abierto).then((t) => { if (vivo && t) setPropios((xs) => [t, ...xs.filter((x) => x.id !== t.id)]); });
    return () => { vivo = false; };
  }, [abierto, ticket, deAfuera]);

  // Abrir un ticket trae su conversación entera (la lista llega sin los comentarios del equipo).
  const abrir = useCallback((a: Abierto) => {
    setAbierto(a);
    setErrorTarjeta(null);
    if (typeof a === 'number') void verMiTicketAction(a).then((t) => { if (t) setPropios((xs) => [t, ...xs.filter((x) => x.id !== t.id)]); });
  }, []);

  /** Empieza otra conversación con MaKo. */
  const nuevo = useCallback(() => {
    setCharla(CHARLA_VACIA); setTurnos(saludo()); setTipoElegido(null); setErrorTarjeta(null); otraConversacion(); delTicket.current = []; setEscribiendo(0); setAbierto('nuevo');
  }, []);

  /** Lo que escribe la persona en la conversación nueva: MaKo contesta en el acto (reglas, sin IA). `yaDibujado`: el turno de
   *  la persona ya está en el hilo (sus archivos estaban subiendo) y sólo deja de decir «Enviando…». */
  const contar = useCallback((t: string, yaDibujado?: string) => {
    const at = new Date().toISOString();
    const c1 = sumar(charla, t);
    const paso = queSigue(c1);
    const c2 = paso?.k === 'pregunta' ? preguntar(c1, paso.clave) : c1;
    setCharla(c2);
    setErrorTarjeta(null);
    setTurnos((xs) => (yaDibujado
      ? xs.map((x) => (x.id === yaDibujado ? { id: x.id, de: x.de, texto: x.texto, at: x.at } : x))
      : [...xs, { id: id('p'), de: 'persona' as const, texto: t, at }]));
    if (!paso) return;
    const deMako: Turno = {
      id: id('m'), de: 'mako', texto: paso.texto, at,
      ...(paso.k === 'pregunta' && paso.opciones ? { opciones: paso.opciones } : {}),
      ...(paso.k === 'ticket' ? { borrador: paso.borrador } : {}),
    };
    // MaKo escribe y contesta. Si mientras tanto la persona empezó otra conversación, la respuesta era de la anterior: no cae.
    const conversacion = ref.current;
    setEscribiendo((n) => n + 1);
    setTimeout(() => {
      setEscribiendo((n) => Math.max(0, n - 1));
      if (ref.current === conversacion) setTurnos((xs) => [...xs, { ...deMako, at: new Date().toISOString() }]);
    }, MAKO_ESCRIBE_MS);
  }, [charla]);
  // El `contar` de AHORA, para cuando termina una subida (el de su render ya no tiene lo que se contó después).
  const contarRef = useRef(contar);
  useEffect(() => { contarRef.current = contar; });

  /** Un mensaje con archivos en la conversación NUEVA: se ve ya («Enviando…»), los archivos suben y RECIÉN AHÍ entra al relato
   *  del ticket, con su «📎» (revisión de 046d9e028). Si la persona empezó otra conversación mientras subían, no se suman a ella; si
   *  no subieron, el turno lo dice y se puede reintentar con los mismos archivos. */
  const subirEnLaNueva = useCallback((t: string, archivos: readonly File[], idTurno?: string) => {
    const conversacion = ref.current;
    const visto = [t, lineaDeAdjuntos(archivos.map((f) => f.name))].filter(Boolean).join('\n');
    const idP = idTurno ?? id('p');
    const turno: Turno = { id: idP, de: 'persona', texto: visto, at: new Date().toISOString(), estado: 'enviando', dicho: t, archivos };
    setTurnos((xs) => (idTurno ? xs.map((x) => (x.id === idTurno ? turno : x)) : [...xs, turno]));
    const p = subirAdjuntosTicket(archivos).then((s) => {
      if (ref.current !== conversacion) return;
      if (!s.ok) { setTurnos((xs) => xs.map((x) => (x.id === idP ? { ...x, estado: 'error' as const, error: s.error } : x))); return; }
      delTicket.current = [...delTicket.current, ...s.adjuntos];
      contarRef.current(visto, idP);
    });
    subidas.current.add(p);
    void p.finally(() => subidas.current.delete(p));
  }, []);

  /** Lo que escribe la persona en un ticket: sale como respuesta al equipo. `yaSubidos`: un reintento cuyos archivos ya subieron. */
  const contestar = useCallback(async (t: TicketCliente, x: string, archivos: readonly File[] = [], yaSubidos?: readonly AdjuntoTicket[]) => {
    // Se ve en el acto, con sus archivos dichos; suben y salen por detrás (lib/tickets-adjuntos.ts). El turno guarda lo dicho y
    // los archivos: un reintento los vuelve a mandar, nunca la línea «📎» como si fuera texto.
    const visto = [x, lineaDeAdjuntos(archivos.map((f) => f.name))].filter(Boolean).join('\n');
    const turno: Turno = { id: id('r'), de: 'persona', texto: visto, at: new Date().toISOString(), estado: 'enviando', dicho: x, archivos, ...(yaSubidos ? { subidos: yaSubidos } : {}) };
    setExtra((e) => ({ ...e, [t.id]: [...(e[t.id] ?? []), turno] }));
    const quitar = () => setExtra((e) => ({ ...e, [t.id]: (e[t.id] ?? []).filter((y) => y.id !== turno.id) }));
    const fallo = (error: string) => setExtra((e) => ({ ...e, [t.id]: (e[t.id] ?? []).map((y) => (y.id === turno.id ? { ...y, estado: 'error' as const, error } : y)) }));
    try {
      let refs: readonly AdjuntoTicket[] = yaSubidos ?? [];
      if (archivos.length && !yaSubidos) {
        const s = await subirAdjuntosTicket(archivos);
        if (!s.ok) { fallo(s.error); return; }
        refs = s.adjuntos;
        setExtra((e) => ({ ...e, [t.id]: (e[t.id] ?? []).map((y) => (y.id === turno.id ? { ...y, subidos: refs } : y)) }));
      }
      const r = await contestarTicketAction(t.id, x, refs);
      if (!r.ok) {
        setExtra((e) => ({ ...e, [t.id]: (e[t.id] ?? []).map((y) => (y.id === turno.id ? { ...y, estado: 'error' as const, error: r.error } : y)) }));
        return;
      }
      if (r.ticket) setPropios((xs) => [r.ticket!, ...xs.filter((y) => y.id !== t.id)]);
      quitar();
    } catch {
      setExtra((e) => ({ ...e, [t.id]: (e[t.id] ?? []).map((y) => (y.id === turno.id ? { ...y, estado: 'error' as const, error: 'No salió: revisa tu conexión y vuelve a mandarlo.' } : y)) }));
    }
  }, []);

  const mandar = useCallback((dicho?: string) => {
    const t = (dicho ?? texto).trim();
    const archivos = dicho === undefined ? adjuntos.map((a) => a.file) : [];
    if (!t && !archivos.length) return false;
    if (ticket) {
      if (!ticket.puedeResponder) return false;
      void contestar(ticket, t, archivos);
    } else if (archivos.length) {
      // En la conversación nueva, los archivos suben ya y viajan con el ticket cuando se levanta (`delTicket`).
      subirEnLaNueva(t, archivos);
    } else {
      contar(t);
    }
    if (dicho === undefined) { setTexto(''); for (const a of adjuntos) URL.revokeObjectURL(a.url); setAdjuntos([]); setErrorAdjunto(null); }
    return true;
  }, [texto, ticket, contar, contestar, subirEnLaNueva, adjuntos]);

  /** Un mensaje que no salió: se manda otra vez lo MISMO (lo escrito y sus archivos), sacándolo del hilo. */
  const reintentar = useCallback((idTurno: string) => {
    if (!ticket) {
      const turno = turnos.find((x) => x.id === idTurno && x.estado === 'error');
      if (turno?.archivos?.length) subirEnLaNueva(turno.dicho ?? '', turno.archivos, idTurno);
      return;
    }
    const turno = (extra[ticket.id] ?? []).find((x) => x.id === idTurno);
    if (!turno) return;
    setExtra((e) => ({ ...e, [ticket.id]: (e[ticket.id] ?? []).filter((y) => y.id !== idTurno) }));
    void contestar(ticket, turno.dicho ?? turno.texto, turno.archivos ?? [], turno.subidos);
  }, [ticket, extra, turnos, contestar, subirEnLaNueva]);

  const idTarjeta = idDelBorrador(turnos);
  const borrador: Borrador | null = idTarjeta ? turnos.find((x) => x.id === idTarjeta)!.borrador! : null;

  /** La tarjeta: manda el ticket armado. Al salir, la conversación pasa a ser la del ticket. */
  /** Hay notas de voz de esta conversación sin salir: el ticket las espera (la tarjeta lo dice), como espera las fotos. */
  const notasPendientes = useRef(false);
  const mandarTicket = useCallback(async () => {
    if (!borrador || mandando || notasPendientes.current) return;
    const mal = borradorValido(borrador);
    if (mal) { setErrorTarjeta(mal); return; }
    setMandando(true); setErrorTarjeta(null);
    try {
      // Lo que todavía sube va CON el ticket: se espera, con «Subiendo archivos…» en la tarjeta.
      if (subidas.current.size) {
        setSubiendo(true);
        try { await Promise.all([...subidas.current]); } finally { setSubiendo(false); }
      }
      // La descripción nombra TODO lo que va con el ticket: lo que terminó de subir mientras se esperaba todavía no está en la
      // tarjeta de este render. Y nunca un archivo que no va (lo que no subió no entró al relato).
      const faltan = delTicket.current.map((a) => a.nombre).filter((n) => !borrador.descripcion.includes(n));
      const descripcion = faltan.length ? `${borrador.descripcion}\n${lineaDeAdjuntos(faltan)}` : borrador.descripcion;
      const tipo = tipoElegido ?? borrador.tipo;
      const r = await levantarDesdeSoporteAction({
        tipo, elegido: tipoElegido != null, titulo: borrador.titulo, descripcion, movil,
        contexto: contextoDelNavegador(movil ? 'soporte-movil' : 'soporte'), ref: ref.current, adjuntos: delTicket.current,
      });
      if (!r.ok) { setErrorTarjeta(r.error); return; }
      const t = await verMiTicketAction(r.id);
      if (t) setPropios((xs) => [t, ...xs.filter((x) => x.id !== t.id)]);
      setExtra((e) => ({ ...e, [r.id]: [{ id: id('m'), de: 'mako', at: new Date().toISOString(),
        texto: `Listo: es el ticket #${r.id}. Cuando el equipo te conteste, lo vas a ver aquí, en esta conversación.` }] }));
      setCharla(CHARLA_VACIA); setTurnos(saludo()); setTipoElegido(null); otraConversacion(); delTicket.current = [];
      setAbierto(r.id);
    } catch {
      setErrorTarjeta('No salió: revisa tu conexión y vuelve a mandarlo.');
    } finally {
      setMandando(false);
    }
  }, [borrador, mandando, tipoElegido, movil]);

  const items = useMemo(() => (ticket ? itemsDeTicket(ticket, extra[ticket.id]) : itemsDeCharla(turnos)), [ticket, extra, turnos]);
  // La nota de voz sale en el acto (28/10/2026): se dibuja ya, se pasa a texto por detrás (app/_chat/useNotaEnElActo.ts) y sale
  // por `mandar`, como lo escrito: al equipo en un ticket, a MaKo en la conversación nueva. Lo escrito y lo adjuntado quedan en la caja.
  const nota = useNotaEnElActo({
    clave: typeof abierto === 'number' ? `soporte:${abierto}` : `soporte:nuevo:${idConversacion}`,
    puede: !mandando && !(typeof abierto === 'number' && (!ticket || !ticket.puedeResponder)),
    mandar: (t) => mandar(t),
  });
  useEffect(() => { notasPendientes.current = nota.pendientes; });
  const enviando = ticket ? (extra[ticket.id] ?? []).some((x) => x.estado === 'enviando') : false;

  return {
    tickets, abierto, ticket, abrir, nuevo, items: nota.conNotas(items), texto, setTexto, mandar, reintentar: nota.reintentar(reintentar), enviando,
    onGrabada: nota.onGrabada, descartar: nota.descartar,
    /** Una nota de voz de esta conversación todavía no salió: lo escrito y el ticket la esperan. */
    notasPendientes: nota.pendientes,
    /** Los 3 puntos de MaKo, sólo en la conversación nueva. */
    escribiendo: escribiendo > 0 && !ticket ? { segs: 0 } : null,
    /** La caja ofrece adjuntar: capturas, fotos, PDF y documentos (lib/tickets-adjuntos.ts). */
    adjuntosCaja: { items: adjuntos, puede: !(ticket && !ticket.puedeResponder), onSumar: sumarAdjuntos, onQuitar: quitarAdjunto, accept: ACCEPT_TICKET },
    errorAdjunto,
    idTarjeta, borrador, tipoElegido, setTipoElegido, mandarTicket, mandando, subiendo, errorTarjeta,
    placeholder: placeholderDe(ticket, turnos.length > 1),
    apagado: !!ticket && !ticket.puedeResponder,
    cargando: typeof abierto === 'number' && !ticket,
  };
}
export type Soporte = ReturnType<typeof useSoporte>;

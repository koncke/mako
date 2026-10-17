// =============================================================================
// El motor del Centro: lo que vive mientras se mira, sin la pantalla (17/10/2026)
// =============================================================================
// Martín (17/10/2026, de madrugada): «quiero dejar de mandar prompts por aquí, quiero mandar prompts por MaKo en el
// Second Brain». La tanda 5 de docs/diseno-mako-ai-native.md («el Centro como adaptador de la pieza»): los chats de
// Claude Code (el Cerebro y cada jefe) se escriben desde /second-brain igual que desde /admin/operaciones. Para que
// sea EL MISMO Centro y no una copia, lo que el Centro hace mientras está abierto vive acá, y lo montan tres pantallas:
//   · app/admin/operaciones/CentroApp.tsx (el Centro de siempre),
//   · app/second-brain/ChatSecondBrain.tsx (la sección «Claude Code» de la barra, sólo para quien `puedeOperar`),
//   · app/m/operaciones/CentroAppMovil.tsx y app/m/second-brain/SecondBrainCentroM.tsx (el teléfono).
//
// Lo que hace: la cola y los Runners que se refrescan cada 8 s con la pestaña a la vista; los pushes de Vercel
// DESPUÉS de dibujar; la Ticketera de cada chat; el borrador y el alcance de la caja; mandar (por mandar.ts, el ÚNICO
// camino firmado); y el «⋯» de cada chat (Renombrar, que también es un trabajo firmado, y Cambiar su muñeco).
//
// ⚠️ SIN 'use client' A PROPÓSITO, como mandar.ts: es un hook que sólo importan componentes de cliente.
// ⚠️ LA GUARDA NO VIVE ACÁ: los datos de entrada los lee el servidor DESPUÉS de `puedeOperar` (las dos páginas del
//    Centro y la del Second Brain, tests/operaciones.test.ts), y cada acción la vuelve a pedir (acciones.ts).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DESTINO_RE, aceptaAdjuntos, type AdjuntoPedido, type Alcance, type TurnoChat } from '@/lib/operaciones-reglas';
import { ERROR_ADJUNTO } from '@/lib/mako-adjuntos';
import { idLocal, problemaDeSeleccion, tipoDeElegido } from '@/app/m/mako/chat-ui';
import { achicarImagen } from '@/app/m/mako/achicar-imagen';
import {
  comoSale, completarChats, enQueTrabaja, esperasPorChat, historialDelChat, nombreValido, textoDeEnvio, textoDeRenombre, vistaPrevia,
  type ChatCentro, type DecisionEspera, type Envio, type LineaChat, type TrabajoP, type VistaPrevia,
} from '@/lib/centro-chats';
import type { PedidoP } from '@/lib/progreso-reglas';
import type { LecturaPushes } from '@/lib/progreso';
import type { EstadoCarteros, Pedido } from '@/lib/operaciones';
import { aspectoDe, elegidoPara, type Aspecto, type MunecosElegidos } from '@/lib/centro-munecos';
import { respuestasDelChat } from '@/lib/centro-preguntas';
import type { AccionDeshacer, AccionResponder } from '@/app/admin/runway/decisiones';
import { AUTOMATICO, aceptaModelo, cuentasDelChat, destinoDe, sesionAutomatica, type Esfuerzo, type Modelo } from '@/lib/centro-cuentas';
import { fotoCentroAction, guardarMunecoAction, pushesCentroAction, turnosCentroAction } from './acciones';
import { TEXTO_SOLO_ADJUNTOS, copiar, subirAdjuntos, useFirma } from './mandar';

const REFRESCO_MS = 8000;
/** La barra del avance se recuerda abierta o cerrada entre chats y visitas: es una preferencia (AGENTS.md). */
const CLAVE_AVANCE = 'centro.avance';
const leerAvance = () => { try { return window.localStorage.getItem(CLAVE_AVANCE) === '1'; } catch { return false; } };

/** Lo que el servidor lee para el Centro, DESPUÉS de `puedeOperar`. Viaja entero de la página a la pantalla. */
export type DatosCentro = {
  /** La mitad de la lista que sale de las bitácoras (lib/centro-chats.ts → chatsDeBitacoras). */
  base: ChatCentro[];
  colaInicial: Pedido[] | null;
  carterosIniciales: EstadoCarteros | null;
  /** Las tarjetas de la Ticketera, enteras; null si no se pudieron leer. */
  decisionesIniciales: DecisionEspera[] | null;
  /** Los muñecos que Martín eligió, por nombre (lib/centro-munecos-db.ts). */
  munecosIniciales: MunecosElegidos;
  pedidos: PedidoP[];
  ahora: number;
  sub: string;
  /** Los nombres de las tabs: el jefe de un chat se llama como una (tabs.ts). */
  tabs: readonly string[];
  /** Las acciones de la Ticketera (app/admin/runway/acciones.ts): contestar acá es contestar allá. */
  responder: AccionResponder;
  deshacer?: AccionDeshacer;
};

/** Un archivo elegido (o pegado) en la caja, con su vista previa local. */
export type AdjuntoCaja = { id: string; file: File; tipo: 'image' | 'document'; url: string };
/** Una captura chica va tal cual (el texto de una captura se lee mejor en PNG); una foto grande se achica (Vercel corta
 *  un POST de más de ~4,5 MB). */
const TAL_CUAL_BYTES = 1_500_000;

/** Cómo avisa cada pantalla (el Toast de escritorio, el del teléfono). */
export type Avisar = (texto: string, tono: 'good' | 'bad') => void;

/** Lo de la cola que dibuja un chat. */
const trabajoDe = (p: Pedido): TrabajoP => ({
  id: p.id, destino: p.destino, destino_titulo: p.destino_titulo, destino_cuenta: p.destino_cuenta, created_at: p.created_at,
  texto: p.texto, estado: p.estado, motivo: p.motivo, entregado_at: p.entregado_at, cerrado_at: p.cerrado_at, cierre: p.cierre,
  ...(p.adjuntos?.length ? { adjuntos: p.adjuntos } : {}),
});

export function useCentro(d: DatosCentro, avisar: Avisar) {
  const { base, pedidos, sub, tabs, responder, deshacer } = d;
  const [cola, setCola] = useState<Pedido[]>(d.colaInicial ?? []);
  // Lo recién mandado se ve enseguida; cuando el refresco lo trae de la cola, se usa el de la cola.
  const [locales, setLocales] = useState<TrabajoP[]>([]);
  const [estado, setEstado] = useState<EstadoCarteros | null>(d.carterosIniciales);
  const [decisiones, setDecisiones] = useState<DecisionEspera[]>(d.decisionesIniciales ?? []);
  const [decisionesOk, setDecisionesOk] = useState(d.decisionesIniciales != null);
  const [ahora, setAhora] = useState(d.ahora);
  const [pushes, setPushes] = useState<LecturaPushes | null>(null);
  const [munecos, setMunecos] = useState<MunecosElegidos>(d.munecosIniciales);
  const [borradores, setBorradores] = useState<Record<string, string>>({});
  const [alcance, setAlcance] = useState<Alcance>('solo_esto');
  /** La cuenta elegida para cada chat (ausente = «Automático»): se recuerda mientras la pantalla está abierta. */
  const [cuentaDe, setCuentaDe] = useState<Record<string, string>>({});
  /** El modelo y el esfuerzo del próximo trabajo (null = «Automático»): vuelven a Automático después de mandar. */
  const [modelo, setModelo] = useState<Modelo | null>(null);
  const [esfuerzo, setEsfuerzo] = useState<Esfuerzo | null>(null);
  const [enviando, setEnviando] = useState(false);
  /** Los archivos elegidos (o pegados) en la caja de cada chat. El ref los tiene al día para sumar sin esperar un render. */
  const [adjuntos, setAdjuntos] = useState<Record<string, AdjuntoCaja[]>>({});
  const adjuntosRef = useRef(adjuntos);
  const ponerAdjuntos = (clave: string, xs: AdjuntoCaja[]) => {
    adjuntosRef.current = { ...adjuntosRef.current, [clave]: xs };
    setAdjuntos(adjuntosRef.current);
  };
  const [avance, setAvance] = useState(false);
  // El «⋯» de una fila (o el clic derecho): dónde abre y de qué chat es.
  const [menu, setMenu] = useState<{ x: number; y: number; clave: string } | null>(null);
  const [renombrando, setRenombrando] = useState<{ clave: string; texto: string; error: string | null; mandando: boolean } | null>(null);
  const [eligiendo, setEligiendo] = useState<{ clave: string; aspecto: Aspecto; guardando: boolean } | null>(null);
  const firma = useFirma(sub);
  // ── Lo que se dijo en el chat abierto (sus turnos, del transcript: «los chats no se entienden», 17/10/2026) ──
  // Se piden sólo para el chat que se mira (al abrirlo y en cada refresco): los demás no viajan.
  const [turnos, setTurnos] = useState<Record<string, TurnoChat[]>>({});
  const mirado = useRef<ChatCentro | null>(null);
  const pedirTurnos = useCallback(async (c: ChatCentro) => {
    const locales = c.miembros.filter((m) => DESTINO_RE.test(m));
    if (!locales.length) return;
    const r = await turnosCentroAction(locales).catch(() => null);
    if (r?.ok) setTurnos((t) => ({ ...t, [c.clave]: r.turnos }));
  }, []);
  /** La conversación avisa qué chat se está mirando (o null al cerrarla). */
  const mirar = useCallback((c: ChatCentro | null) => { mirado.current = c; if (c) void pedirTurnos(c); }, [pedirTurnos]);
  const turnosDe = (c: ChatCentro): TurnoChat[] => turnos[c.clave] ?? [];

  // Se lee después de montar: el server no sabe lo del navegador, y el primer dibujo tiene que coincidir.
  useEffect(() => { setAvance(leerAvance()); }, []);
  const cambiarAvance = useCallback((v: boolean) => {
    setAvance(v);
    try { window.localStorage.setItem(CLAVE_AVANCE, v ? '1' : '0'); } catch { /* es una comodidad */ }
  }, []);

  const trabajos = useMemo(() => {
    const deCola = cola.map(trabajoDe);
    return [...locales.filter((l) => !deCola.some((w) => w.id === l.id)), ...deCola];
  }, [cola, locales]);
  const carteros = useMemo(() => estado?.carteros ?? [], [estado]);
  const esperas = useMemo(() => esperasPorChat(decisiones, carteros), [decisiones, carteros]);
  const chats = useMemo(() => completarChats(base, { carteros, trabajos, ahora }), [base, carteros, trabajos, ahora]);
  const porId = useMemo(() => new Map(pedidos.map((p) => [p.id, p])), [pedidos]);
  // La conversación de cada chat, una vez: de ella salen el segundo renglón y en qué está trabajando.
  const lineasDe = useMemo(
    () => new Map<string, LineaChat[]>(chats.map((c) => [c.clave, historialDelChat(c, porId, trabajos, respuestasDelChat(c, decisiones, carteros), turnos[c.clave])])),
    [chats, porId, trabajos, decisiones, carteros, turnos],
  );
  const previas = useMemo(() => new Map<string, VistaPrevia | null>([...lineasDe].map(([k, l]) => [k, vistaPrevia(l)])), [lineasDe]);
  const enCursos = useMemo(() => new Map<string, string | null>([...lineasDe].map(([k, l]) => [k, enQueTrabaja(l)])), [lineasDe]);

  const refrescar = useCallback(async () => {
    const f = await fotoCentroAction();
    if (f.ok) { setCola(f.pedidos); setEstado(f.carteros); if (f.decisiones) { setDecisiones(f.decisiones); setDecisionesOk(true); } }
    if (mirado.current) void pedirTurnos(mirado.current);
    setAhora(Date.now());
  }, [pedirTurnos]);
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === 'visible') refrescar(); }, REFRESCO_MS);
    const volver = () => { if (document.visibilityState === 'visible') refrescar(); };
    document.addEventListener('visibilitychange', volver);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', volver); };
  }, [refrescar]);
  // Vercel, después de dibujar.
  useEffect(() => { let vivo = true; pushesCentroAction().then((p) => { if (vivo) setPushes(p); }).catch(() => {}); return () => { vivo = false; }; }, []);

  // ── Las preguntas de cada chat (la Ticketera de ESE chat, arriba de su caja) ──────────────────────
  // Contestar acá o en la Ticketera guarda lo mismo; lo de acá se ve en el acto (el refresco trae la verdad).
  const anotarRespuesta = (id: number, clave: string | null, texto: string) => setDecisiones((ds) => ds.map((x) => (x.id !== id ? x : {
    ...x, respuesta: clave, respuestaTexto: clave ? texto.trim() || null : null, respondidaAt: clave ? new Date().toISOString() : null, recogidaAt: null,
  })));
  const responderAca: AccionResponder = async (prev, fd) => {
    const r = await responder(prev, fd);
    if (r.ok) anotarRespuesta(Number(fd.get('id')), String(fd.get('clave') ?? ''), String(fd.get('texto') ?? ''));
    return r;
  };
  const deshacerAca: AccionDeshacer = async (fd) => {
    if (!deshacer) return { ok: false, error: 'Deshazlo desde la Ticketera.', yaRecogida: false };
    const r = await deshacer(fd);
    if (r.ok) anotarRespuesta(Number(fd.get('id')), null, '');
    return r;
  };
  const pendientesTicketera = decisiones.filter((x) => !x.respuesta && x.urgencia !== 'aviso').length;

  // ── La caja ────────────────────────────────────────────────────────────────────────────────────
  const claveFirma = firma.clave === undefined ? undefined : firma.clave?.id ?? null;
  // ── La cuenta (Martín, 17/10/2026: «Si no selecciono nada que lo decida solo, pero debería poder seleccionar») ──
  const cuentaElegida = (clave: string) => cuentaDe[clave] ?? AUTOMATICO;
  const elegirCuenta = (clave: string, cuenta: string) => setCuentaDe((m) => ({ ...m, [clave]: cuenta }));
  /** A qué sesión va lo que se escribe en la caja de ESTE chat (la cuenta elegida, o la automática). */
  const destinoDeChat = (c: ChatCentro) => destinoDe(c, cuentaElegida(c.clave), carteros, ahora);
  /** Las cuentas del chat para el selector, y cuál elegiría «Automático». */
  const cuentasDe = (c: ChatCentro) => ({ opciones: cuentasDelChat(c, carteros, ahora), automatica: sesionAutomatica(c, carteros, ahora)?.cuenta ?? null });
  const envioDe = (c: ChatCentro): Envio => comoSale(destinoDeChat(c), carteros, claveFirma, ahora);
  const borradorDe = (clave: string) => borradores[clave] ?? '';
  const ponerBorrador = (clave: string, t: string) => setBorradores((b) => ({ ...b, [clave]: t }));

  /** Lo que se acaba de mandar, para que se vea en su chat mientras llega el refresco. */
  const anotarEnviado = (t: TrabajoP) => { setLocales((l) => [t, ...l]); refrescar(); };

  // ── Los adjuntos de la caja (17/10/2026): fotos y PDF, también pegando una captura con Ctrl+V ─────────────
  const adjuntosDe = (clave: string) => adjuntos[clave] ?? [];
  /** ¿Baja adjuntos el Runner de la cuenta a la que sale? Con un cartero de antes de la 1.9.0 el trabajo llegaría SIN
   *  los archivos y nadie lo diría: la caja no ofrece adjuntar. */
  const puedeAdjuntar = (c: ChatCentro) => {
    const { cuenta } = destinoDeChat(c);
    return carteros.some((k) => (!cuenta || k.cuenta === cuenta) && aceptaAdjuntos(k.version));
  };
  const sumarAdjuntos = async (clave: string, lista: readonly File[]) => {
    if (!lista.length) return;
    const validos = lista.filter((f) => tipoDeElegido(f) != null);
    if (validos.length < lista.length) avisar(ERROR_ADJUNTO.formato, 'bad');
    const listos: File[] = [];
    for (const f of validos) {
      const talCual = f.size <= TAL_CUAL_BYTES && /^image\/(png|jpeg|webp|gif)$|^application\/pdf$/.test(f.type);
      try { listos.push(talCual ? f : await achicarImagen(f)); } catch (e) { avisar(e instanceof Error ? e.message : 'No pude leer esa imagen.', 'bad'); }
    }
    if (!listos.length) return;
    const antes = adjuntosRef.current[clave] ?? [];
    const problema = problemaDeSeleccion([...antes.map((a) => a.file.size), ...listos.map((f) => f.size)]);
    if (problema) { avisar(problema, 'bad'); return; }
    ponerAdjuntos(clave, [...antes, ...listos.map((f): AdjuntoCaja => ({
      id: idLocal('a'), file: f, tipo: tipoDeElegido(f) === 'image' ? 'image' : 'document', url: URL.createObjectURL(f),
    }))]);
  };
  const quitarAdjunto = (clave: string, id: string) => {
    const antes = adjuntosRef.current[clave] ?? [];
    const a = antes.find((x) => x.id === id);
    if (a) URL.revokeObjectURL(a.url);
    ponerAdjuntos(clave, antes.filter((x) => x.id !== id));
  };
  /** Después de mandar: la caja queda vacía. */
  const vaciarAdjuntos = (clave: string) => {
    for (const a of adjuntosRef.current[clave] ?? []) URL.revokeObjectURL(a.url);
    ponerAdjuntos(clave, []);
  };

  async function mandar(c: ChatCentro) {
    const texto = borradorDe(c.clave);
    const archivos = adjuntosRef.current[c.clave] ?? [];
    const d = destinoDeChat(c);
    if (!d.sesion || !envioDe(c).puede || enviando || (!texto.trim() && !archivos.length)) return;
    setEnviando(true);
    // Primero los archivos: el trabajo se firma con el `ref` de cada uno y el sha256 que calculó este navegador.
    let subidos: AdjuntoPedido[] = [];
    if (archivos.length) {
      const s = await subirAdjuntos(archivos.map((a) => a.file));
      if (!s.ok) { setEnviando(false); avisar(s.error, 'bad'); return; }
      subidos = s.adjuntos;
    }
    // El modelo y el esfuerzo sólo viajan a un chat de la app (lib/centro-cuentas.ts → aceptaModelo).
    const como = aceptaModelo(d.sesion) ? { modelo, esfuerzo } : {};
    const r = await firma.mandar({ sesion: d.sesion, cuenta: d.cuenta, titulo: c.titulo }, texto, alcance, como, subidos);
    setEnviando(false);
    if (!r.ok) { avisar(r.error, 'bad'); return; }
    anotarEnviado({
      id: r.id, destino: d.sesion, destino_titulo: c.titulo, destino_cuenta: d.cuenta, created_at: r.creado, texto: texto.trim() || TEXTO_SOLO_ADJUNTOS,
      estado: 'escrito', motivo: null, cierre: null, ...(subidos.length ? { adjuntos: subidos.map((a) => a.nombre) } : {}),
    });
    vaciarAdjuntos(c.clave);
    ponerBorrador(c.clave, '');
    setAlcance('solo_esto');
    setModelo(null);
    setEsfuerzo(null);
  }

  // Los avisos dicen qué hacer, cortos (Martín, 15/10/2026: «Jamás pongas mensajes no claros»). Después de crear el
  // Token, el paso siguiente (pegárselo al Runner) ya lo dice la caja.
  const copiarConAviso = async (t: string, aviso: string) => {
    if (await copiar(t)) avisar(aviso, 'good'); else avisar('No pude copiar', 'bad');
  };
  const crearClave = async () => {
    const c = await firma.crear();
    if (!c) { avisar('No pude crear tu Token', 'bad'); return; }
    avisar('Token creado', 'good');
  };
  const copiarClave = () => { if (firma.clave) void copiarConAviso(firma.clave.spki, 'Copiado: pégalo en el Runner'); };

  // ── El «⋯» de cada chat: Renombrar y Cambiar su muñeco ─────────────────────────────────────────
  const abrirMenu = (clave: string, x: number, y: number) => setMenu({ x, y, clave });
  const delMenu = menu ? chats.find((c) => c.clave === menu.clave) ?? null : null;
  const deRenombre = renombrando ? chats.find((c) => c.clave === renombrando.clave) ?? null : null;
  const deMuneco = eligiendo ? chats.find((c) => c.clave === eligiendo.clave) ?? null : null;
  const abrirMuneco = (c: ChatCentro) => setEligiendo({ clave: c.clave, aspecto: aspectoDe(c.titulo, elegidoPara(munecos, c.titulo)), guardando: false });
  const elegirEnMenu = (id: string) => {
    const c = delMenu;
    setMenu(null);
    if (!c) return;
    if (id === 'renombrar') setRenombrando({ clave: c.clave, texto: c.titulo, error: null, mandando: false });
    if (id === 'muneco') abrirMuneco(c);
  };
  // El nombre lo cambia cada sesión del chat (en todas sus cuentas): se le manda a cada una un trabajo firmado que se lo
  // pide (lib/centro-chats.ts → textoDeRenombre). La que está cerrada lo recibe cuando se abre.
  async function renombrar() {
    if (!renombrando || !deRenombre) return;
    const v = nombreValido(renombrando.texto);
    if (!v.ok) { setRenombrando({ ...renombrando, error: v.error }); return; }
    if (v.nombre === deRenombre.titulo) { setRenombrando(null); return; }
    const sale = envioDe(deRenombre);
    if (!sale.puede) { setRenombrando({ ...renombrando, error: textoDeEnvio(sale) }); return; }
    setRenombrando({ ...renombrando, mandando: true, error: null });
    let mal: string | null = null;
    for (const s of deRenombre.sesiones) {
      const r = await firma.mandar({ sesion: s.sesion, cuenta: s.cuenta, titulo: deRenombre.titulo }, textoDeRenombre(v.nombre), 'solo_esto');
      if (!r.ok) mal = r.error;
    }
    if (mal) { setRenombrando({ ...renombrando, mandando: false, error: mal }); return; }
    // El muñeco elegido se guarda por nombre: viaja con el nombre nuevo, o el chat renombrado lo perdería.
    const suyo = elegidoPara(munecos, deRenombre.titulo);
    if (suyo) { const g = await guardarMunecoAction(v.nombre, suyo); if (g.ok) setMunecos(g.munecos); }
    setRenombrando(null);
    avisar('Renombre enviado', 'good');
    refrescar();
  }
  async function guardarElegido(aspecto: Aspecto | null) {
    if (!eligiendo || !deMuneco) return;
    setEligiendo({ ...eligiendo, guardando: true });
    const r = await guardarMunecoAction(deMuneco.titulo, aspecto);
    if (!r.ok) { setEligiendo({ ...eligiendo, guardando: false }); avisar(r.error, 'bad'); return; }
    setMunecos(r.munecos);
    setEligiendo(null);
    avisar('Muñeco guardado', 'good');
  }

  return {
    chats, carteros, trabajos, porId, esperas, decisiones, decisionesOk, ahora, pushes, estado, munecos, setMunecos, tabs, firma, pedidos,
    turnosDe, mirar,
    lineasDe, previas, enCursos, pendientesTicketera, refrescar, responderAca, deshacerAca,
    avance, cambiarAvance,
    envioDe, borradorDe, ponerBorrador, alcance, setAlcance, enviando, mandar, anotarEnviado, copiarConAviso, crearClave, copiarClave,
    adjuntosDe, puedeAdjuntar, sumarAdjuntos, quitarAdjunto, vaciarAdjuntos,
    cuentaElegida, elegirCuenta, cuentasDe, destinoDeChat, modelo, setModelo, esfuerzo, setEsfuerzo,
    menu, delMenu, abrirMenu, cerrarMenu: () => setMenu(null), elegirEnMenu,
    renombrando, setRenombrando, deRenombre, renombrar,
    eligiendo, setEligiendo, deMuneco, abrirMuneco, guardarElegido,
  };
}

export type Centro = ReturnType<typeof useCentro>;

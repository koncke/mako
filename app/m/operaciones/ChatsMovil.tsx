'use client';

// =============================================================================
// Chats en el teléfono: la misma lista y la misma conversación que la computadora, destiladas (16/10/2026)
// =============================================================================
// Copiado de WhatsApp y de Codex en el iPhone (capturas del 15/10, docs/hallazgos-operaciones.md): UNA lista (sin
// grupos por cuenta desde el 15/10: Martín, «No quiero que exista "cuenta 1, cuenta 2, 3"»), cada fila con su punto,
// el título, la edad a la derecha y lo último que pasó debajo; al tocarla, la conversación a pantalla casi
// completa con la caja de escribir FIJA abajo, como WhatsApp. El hilo es el de la computadora (Hilo.tsx), y arriba
// va la barra «Avance 3/5» que se abre (Avance.tsx, la de «Tu oferta» de Offer en el teléfono). La cuenta, como chip.
// Los chats se unen por nombre (las tres cuentas) y cada sub-chat («CRM › Lead Detail») va debajo de su jefe, corrido
// a la derecha, como en la computadora. El «⋯» de la conversación abre Renombrar y Cambiar su muñeco, en hojas.
//
// ⚠️ MANDAR DESDE EL TELÉFONO pasa por el MISMO camino que la computadora (app/admin/operaciones/mandar.ts →
// encolarPedidoAction, con su `puedeOperar`): se firma con la clave de ESTE teléfono, y la PC tiene que
// aceptarla (cartero.mjs clave). Hasta entonces la caja lo dice y ofrece copiar la clave.
// ⚠️ EN DOS PARTES desde el 17/10 (tanda 5: los chats de Claude Code en el Second Brain del teléfono): `parte="lista"`
// dibuja sólo las filas (van ADENTRO de la hoja «Tus chats» de /m/second-brain) y `parte="hoja"` sólo la hoja de la
// conversación, que tiene que vivir AFUERA de esa hoja: si viviera adentro, cerrar «Tus chats» la desmontaría (una
// hoja sobre otra REEMPLAZA, SheetM.tsx). El chat abierto lo lleva el padre (`abierto` / `onAbierto`). Sin `parte`,
// todo junto, como en /m/operaciones.

import '@/app/admin/operaciones/centro.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FilaM, ListaM, PieM, SeccionM, SheetM, VacioM, useToastM } from '@/app/m/_ui';
import { Button, Field, Input } from '@/app/_ui';
import { Icon } from '@/app/_components/icons';
import { conVinetas, enterEnLista, textoParaMandar } from '@/lib/centro-caja';
import {
  CEREBRO, SECCION_CEREBRO, SECCION_CHATS, comoSale, esPrioritario, seguirChat, enQueTrabaja, esperaDe, historialDelChat, nombreCuenta, nombreValido, partesDelNombre, porJefe, seccionesDeChats, trabajaSinEscribir,
  textoDeEnvio, textoDeRenombre, vistaPrevia, type CarteroP, type ChatCentro, type TrabajoP,
} from '@/lib/centro-chats';
import type { PedidoP, PushP } from '@/lib/progreso-reglas';
import type { AccionResponder, Decision } from '@/app/admin/runway/decisiones';
import { preguntasDelChat, respuestasDelChat } from '@/lib/centro-preguntas';
import { Pregunta } from '@/app/admin/operaciones/Pregunta';
import { MunecoNuevo, NuevoChat, sePuedeAbrir, type BorradorNuevoChat } from '@/app/admin/operaciones/NuevoChat';
import { comandoNuevoChat } from '@/lib/runner';
import { Hilo, Tick } from '@/app/admin/operaciones/Hilo';
import { Muneco, animoDe } from '@/app/admin/operaciones/Muneco';
import { TareasVinculadas, irAlTurno } from '@/app/admin/operaciones/Avance';
import { LinksDeLaCaja, ResalteDeLinks, hayLinks } from '@/app/admin/operaciones/ConLinks';
import { ElegirMuneco } from '@/app/admin/operaciones/ElegirMuneco';
import { guardarMunecoAction } from '@/app/admin/operaciones/acciones';
import { Microfono } from '@/app/admin/operaciones/Microfono';
import { aspectoDe, elegidoPara, type Aspecto, type MunecosElegidos } from '@/lib/centro-munecos';

const ESTADO: Record<ChatCentro['estado'], string> = { trabajando: 'Trabajando', abierto: 'Abierto', cerrado: 'Cerrado', sin_dato: '' };
const metaDe = (c: ChatCentro) => ESTADO[c.estado];
import { TEXTO_SOLO_ADJUNTOS, copiar, subirAdjuntos, type useFirma } from '@/app/admin/operaciones/mandar';
import { ListaAdjuntos, MasCaja, alPegar, type AdjuntosDeCaja } from '@/app/admin/operaciones/AdjuntosCaja';
import type { AdjuntoPedido } from '@/lib/operaciones-reglas';
import type { Centro } from '@/app/admin/operaciones/useCentro';
import { SelectoresDeEnvio, resumenDeEnvio } from '@/app/admin/operaciones/PiezasCentro';
import { aceptaModelo } from '@/lib/centro-cuentas';

/** Cuántos chats se ven antes de «Ver todos». */
const VISIBLES = 10;

const edad = (t: number | null, ahora: number): string => {
  if (t == null || !Number.isFinite(t)) return '';
  const s = Math.max(0, Math.round((ahora - t) / 1000));
  if (s < 60) return 'ahora';
  if (s < 3600) return `${Math.round(s / 60)} min`;
  if (s < 86_400) return `${Math.round(s / 3600)} h`;
  return `${Math.round(s / 86_400)} d`;
};

export function ChatsM({ chats, carteros, pedidos, trabajos, pushes, ahora, esperas, firma, onEnviado, munecos, onMunecos, decisiones, responder, parte, tituloChats = 'Chats', abierto: abiertoFuera, onAbierto, centro }: {
  /** El motor del Centro (useCentro.ts): con él, la caja elige la cuenta, el modelo y el esfuerzo (17/10/2026), igual que
   *  la de la computadora (PiezasCentro.tsx → SelectoresDeEnvio). */
  centro?: Centro;
  /** Sólo las filas o sólo la hoja de la conversación (ver arriba); sin esto, las dos. */
  parte?: 'lista' | 'hoja';
  /** El título de la sección de los jefes (en el Second Brain, «Claude Code»: «Chats» ahí son los de MaKo). */
  tituloChats?: string;
  /** El chat abierto, cuando lo lleva el padre (las dos partes por separado). */
  abierto?: string | null;
  onAbierto?: (clave: string | null) => void;
  /** Las tarjetas de la Ticketera: cada chat contesta las suyas al final de su conversación, pegadas a la caja. */
  decisiones: readonly Decision[];
  responder: AccionResponder;
  chats: ChatCentro[];
  carteros: CarteroP[];
  pedidos: PedidoP[];
  trabajos: TrabajoP[];
  /** null mientras llegan los de Vercel: el avance no afirma «subió» sin leerlos. */
  pushes: PushP[] | null;
  ahora: number;
  /** Cuántas tarjetas de la Ticketera espera cada chat (lib/centro-chats.ts → esperasPorChat). */
  esperas: Record<string, number>;
  firma: ReturnType<typeof useFirma>;
  /** Lo que se acaba de mandar, para que se vea enseguida mientras llega el refresco. */
  onEnviado: (t: TrabajoP) => void;
  /** Los muñecos que Martín eligió, por nombre, y cómo quedan después de guardar uno. */
  munecos: MunecosElegidos;
  onMunecos: (m: MunecosElegidos) => void;
}) {
  const [abiertoPropio, setAbiertoPropio] = useState<string | null>(null);
  const abierto = abiertoFuera !== undefined ? abiertoFuera : abiertoPropio;
  const setAbierto = (clave: string | null) => { if (onAbierto) onAbierto(clave); else setAbiertoPropio(clave); };
  const [enteras, setEnteras] = useState<Set<string>>(new Set());
  const [enviando, setEnviando] = useState(false);
  const [opciones, setOpciones] = useState(false);
  const [nuevo, setNuevo] = useState<BorradorNuevoChat | null>(null);
  const [abriendo, setAbriendo] = useState(false);
  const [renombre, setRenombre] = useState<{ texto: string; error: string | null; mandando: boolean } | null>(null);
  const [eligiendo, setEligiendo] = useState<{ aspecto: Aspecto; guardando: boolean } | null>(null);
  const toast = useToastM();
  const porId = useMemo(() => new Map(pedidos.map((p) => [p.id, p])), [pedidos]);
  // El chat abierto se sigue aunque lo renombren (17/10/2026): su clave es su nombre, y si ya no está se lo busca por las
  // sesiones que tenía (lib/centro-chats.ts → seguirChat). Sin esto la hoja se cerraba sola al llegar el nombre nuevo.
  const miembrosAbierto = useRef<readonly string[] | null>(null);
  const elegido = seguirChat(chats, abierto, miembrosAbierto.current, trabajos);
  useEffect(() => {
    if (!elegido) return;
    miembrosAbierto.current = elegido.miembros;
    // La lista no lo corrige: con las dos partes, la de la hoja lo hace (la de la lista cierra «Tus chats» al elegir).
    if (parte !== 'lista' && abierto && elegido.clave !== abierto) setAbierto(elegido.clave);
  }, [elegido, abierto, parte]); // eslint-disable-line react-hooks/exhaustive-deps
  const lineas = elegido ? historialDelChat(elegido, porId, trabajos, respuestasDelChat(elegido, decisiones, carteros), centro?.turnosDe(elegido), centro?.preguntasDe(elegido)) : [];
  // Lo que se dijo en el chat abierto: se pide mientras se lo mira (useCentro.ts → mirar). Sólo la hoja lo pide.
  const mirar = centro?.mirar;
  useEffect(() => {
    if (!mirar || parte === 'lista') return;
    mirar(elegido);
    return () => mirar(null);
  }, [elegido?.clave, mirar, parte]); // eslint-disable-line react-hooks/exhaustive-deps
  const preguntas = elegido ? preguntasDelChat(elegido, decisiones, carteros) : [];
  const hilo = useRef<HTMLDivElement>(null);
  // La caja: dónde va el cursor después de que una lista cambió el texto (la viñeta, el ítem siguiente).
  const caja = useRef<HTMLTextAreaElement>(null);
  const cursor = useRef<number | null>(null);
  const resalte = useRef<HTMLDivElement | null>(null);
  const borradorAbierto = elegido && centro ? centro.borradorDe(elegido.clave) : '';
  useEffect(() => {
    const el = caja.current;
    if (el && cursor.current != null) { el.setSelectionRange(cursor.current, cursor.current); cursor.current = null; }
  }, [borradorAbierto]);
  // Como un chat: abre en lo último. La hoja monta su cuerpo en un portal y lo mide después del primer pintado,
  // así que se baja en el cuadro siguiente (en el mismo efecto no hay todavía qué scrollear).
  useEffect(() => {
    const t = setTimeout(() => { const el = hilo.current?.closest('.m-sheet__cuerpo') as HTMLElement | null; if (el) el.scrollTop = el.scrollHeight; }, 80);
    return () => clearTimeout(t);
  }, [abierto, lineas.length]);

  // Una sola lista (sin «Sin asignar», 17/10/2026): arriba lo que trabaja, después lo que espera a Martín.
  const avisos = useMemo(() => (c: ChatCentro) => esperaDe(c, esperas), [esperas]);
  const secciones = useMemo(() => seccionesDeChats(chats, avisos), [chats, avisos]);

  if (!chats.length) return parte === 'hoja' ? null : <VacioM frase="Conecta un Runner desde la computadora para ver tus chats aquí." />;

  // La sesión a la que va: la de la cuenta elegida (o la automática) si está el motor; si no, la del chat.
  const destino = elegido ? (centro ? centro.destinoDeChat(elegido) : elegido) : null;
  const envio = destino ? comoSale(destino, carteros, firma.clave === undefined ? undefined : firma.clave?.id ?? null, ahora) : null;
  // El borrador es el del motor (useCentro.ts): el mismo que en la computadora, guardado mientras se escribe.
  const texto = borradorAbierto;
  const ponerTexto = (t: string) => { if (elegido && centro) centro.ponerBorrador(elegido.clave, t); };
  /** Responder sobre un «Ya está» (la C): la caja arranca con «Sobre «…»: ». */
  const responderSobre = (titulo: string) => {
    const prefijo = `Sobre «${titulo}»: `;
    ponerTexto(texto.startsWith(prefijo) ? texto : prefijo + texto);
    window.setTimeout(() => { const el = caja.current; if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }, 0);
  };
  // Las fotos y los PDF de la caja (17/10/2026): el estado es del motor (useCentro.ts), el mismo de la computadora.
  const adjuntos: AdjuntosDeCaja | undefined = centro && elegido ? {
    items: centro.adjuntosDe(elegido.clave), puede: centro.puedeAdjuntar(elegido),
    onSumar: (fs) => void centro.sumarAdjuntos(elegido.clave, fs), onQuitar: (id) => centro.quitarAdjunto(elegido.clave, id),
  } : undefined;

  async function mandar() {
    const archivos = adjuntos?.items ?? [];
    if (!elegido || !destino?.sesion || !envio?.puede || enviando || (!texto.trim() && !archivos.length)) return;
    setEnviando(true);
    // Primero los archivos: el trabajo se firma con su `ref` y el sha256 que calculó este teléfono (mandar.ts).
    let subidos: AdjuntoPedido[] = [];
    if (archivos.length) {
      const s = await subirAdjuntos(archivos.map((a) => a.file));
      if (!s.ok) { setEnviando(false); toast(s.error); return; }
      subidos = s.adjuntos;
    }
    const como = centro && aceptaModelo(destino.sesion) ? { modelo: centro.modelo, esfuerzo: centro.esfuerzo } : {};
    const sale = textoParaMandar(texto);
    const r = await firma.mandar({ sesion: destino.sesion, cuenta: destino.cuenta, titulo: elegido.titulo }, sale, 'solo_esto', como, subidos);
    setEnviando(false);
    if (!r.ok) { toast(r.error); return; }
    onEnviado({
      id: r.id, destino: destino.sesion, destino_titulo: elegido.titulo, destino_cuenta: destino.cuenta, created_at: r.creado, texto: sale || TEXTO_SOLO_ADJUNTOS,
      estado: 'escrito', motivo: null, cierre: null, ...(subidos.length ? { adjuntos: subidos.map((a) => a.nombre) } : {}),
    });
    centro?.vaciarAdjuntos(elegido.clave);
    centro?.limpiarBorrador(elegido.clave);
    centro?.setModelo(null);
    centro?.setEsfuerzo(null);
  }
  const copiarClave = async () => {
    if (!firma.clave) return;
    toast(await copiar(firma.clave.spki) ? 'Copiado: pégalo en el Runner' : 'No pude copiar');
  };
  const crearClave = async () => { toast((await firma.crear()) ? 'Token creado' : 'No pude crear tu Token'); };

  // Renombrar: a cada sesión del chat (las de las tres cuentas) le llega un trabajo firmado que se lo pide.
  async function renombrar() {
    if (!elegido || !renombre || !envio) return;
    const v = nombreValido(renombre.texto);
    if (!v.ok) { setRenombre({ ...renombre, error: v.error }); return; }
    if (v.nombre === elegido.titulo) { setRenombre(null); return; }
    if (!envio.puede) { setRenombre({ ...renombre, error: textoDeEnvio(envio) }); return; }
    setRenombre({ ...renombre, mandando: true, error: null });
    let mal: string | null = null;
    for (const s of elegido.sesiones) {
      const r = await firma.mandar({ sesion: s.sesion, cuenta: s.cuenta, titulo: elegido.titulo }, textoDeRenombre(v.nombre), 'solo_esto');
      if (!r.ok) mal = r.error;
    }
    if (mal) { setRenombre({ ...renombre, mandando: false, error: mal }); return; }
    // El muñeco elegido se guarda por nombre: viaja con el nombre nuevo, o el chat renombrado lo perdería.
    const suyo = elegidoPara(munecos, elegido.titulo);
    if (suyo) { const g = await guardarMunecoAction(v.nombre, suyo); if (g.ok) onMunecos(g.munecos); }
    setRenombre(null);
    toast('Renombre enviado');
  }
  async function guardarMuneco(aspecto: Aspecto | null) {
    if (!elegido || !eligiendo) return;
    setEligiendo({ ...eligiendo, guardando: true });
    const r = await guardarMunecoAction(elegido.titulo, aspecto);
    if (!r.ok) { setEligiendo({ ...eligiendo, guardando: false }); toast(r.error); return; }
    onMunecos(r.munecos);
    setEligiendo(null);
    toast('Criatura guardada');
  }
  const abrirMuneco = () => { if (elegido) setEligiendo({ aspecto: aspectoDe(elegido.titulo, elegidoPara(munecos, elegido.titulo)), guardando: false }); };
  const cerrarHoja = () => { setAbierto(null); setOpciones(false); setRenombre(null); setEligiendo(null); };

  const estado = envio ? textoDeEnvio(envio) : null;
  const pie = elegido && envio ? (
    envio.puede ? (
      <div className="m-operaciones-caja">
        <ListaAdjuntos a={adjuntos} />
        <div className="m-operaciones-caja__fila">
          {/* El «+» de la caja, como en la computadora: adjuntar y con qué corre (17/10/2026, la B). */}
          {centro && (
            <MasCaja a={adjuntos} apagado={enviando} resumen={resumenDeEnvio(centro, elegido)}>
              {(cerrar) => <><SelectoresDeEnvio centro={centro} chat={elegido} /><TareasVinculadas tareas={centro.tareasDe(elegido)} onIr={(u) => { cerrar(); irAlTurno(u); }} /></>}
            </MasCaja>
          )}
          <div className="co-caja__campo">
          {hayLinks(texto) && <ResalteDeLinks texto={texto} capa={(el) => { resalte.current = el; }} />}
          <textarea
            ref={caja}
            className={hayLinks(texto) ? 'co-caja__texto--resalte' : undefined}
            onScroll={(e) => { if (resalte.current) resalte.current.scrollTop = e.currentTarget.scrollTop; }}
            rows={1}
            value={texto}
            onChange={(e) => {
              const v = conVinetas(e.target.value, e.target.selectionStart);
              if (v.texto !== e.target.value) cursor.current = v.cursor;
              ponerTexto(v.texto);
            }}
            onKeyDown={(e) => {
              // En el teléfono Enter baja de renglón; adentro de una lista arma el ítem siguiente, o la corta.
              if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return;
              const l = enterEnLista(texto, e.currentTarget.selectionStart, e.currentTarget.selectionEnd);
              if (l) { e.preventDefault(); cursor.current = l.cursor; ponerTexto(l.texto); }
            }}
            onPaste={(e) => alPegar(e, adjuntos)}
            placeholder={`Escribe a ${elegido.titulo}`}
            aria-label={`Escribe a ${elegido.titulo}`}
            disabled={enviando}
          />
          </div>
          <Microfono valor={texto} onValor={ponerTexto} onError={(m) => toast(m)} apagado={enviando} />
          <button type="button" className="co-enviar" onClick={mandar} disabled={enviando || (!texto.trim() && !adjuntos?.items.length)} aria-label="Firmar y mandar">
            {enviando ? <span className="co-enviar__giro" aria-hidden /> : <Icon name="flecha" size={18} />}
          </button>
        </div>
        <LinksDeLaCaja texto={texto} />
        {estado && <div className="m-operaciones-caja__fila m-operaciones-caja__fila--meta"><span className="m-operaciones-caja__estado">{estado}</span></div>}
      </div>
    ) : envio.por === 'leyendo_clave' ? null : (
      <div className="m-operaciones-caja m-operaciones-caja--quieta">
        <span className="m-operaciones-caja__estado">{estado}</span>
        {envio.por === 'sin_clave' && <button type="button" className="co-chip" onClick={crearClave}>Crear Token</button>}
        {envio.por === 'clave_no_aceptada' && <button type="button" className="co-chip" onClick={copiarClave}><Icon name="copy" size={14} />Copiar Token</button>}
      </div>
    )
  ) : undefined;

  const conLista = parte !== 'hoja';
  const conHoja = parte !== 'lista';
  return (
    <>
      {/* «Nuevo chat», arriba de todos (NuevoChat.tsx): el comando para abrirlo en la PC. Sólo en el Centro: en el
          Second Brain, «Nuevo chat» es el de MaKo. */}
      {!parte && <>
      <ListaM etiqueta="Nuevo chat">
        <FilaM leading={<MunecoNuevo size={40} />} titulo="Nuevo chat" onClick={() => setNuevo({ nombre: '', cuenta: 'claude1' })} navegacion />
      </ListaM>
      <SheetM abierto={!!nuevo && !elegido} onCerrar={() => setNuevo(null)} titulo="Nuevo chat"
        // «Abrir» con un clic cuando el Runner de esa cuenta abre (17/10/2026); si no, copiar el comando, como antes.
        pie={nuevo ? (centro?.puedeAbrirEn(nuevo.cuenta) ? (
          <PieM consecuencia="Se abre en la PC en 2 minutos.">
            <Button variant="primary" size="lg" full loading={abriendo} disabled={abriendo || !sePuedeAbrir(nuevo, true)}
              onClick={async () => { setAbriendo(true); const ok = await centro.abrirChat(nuevo); setAbriendo(false); if (ok) setNuevo(null); }}>Abrir</Button>
          </PieM>
        ) : (
          <PieM consecuencia="Pégalo en PowerShell, en la PC.">
            <Button variant="primary" size="lg" full disabled={!nombreValido(nuevo.nombre.trim()).ok}
              onClick={async () => { toast((await copiar(comandoNuevoChat(nuevo.cuenta, nuevo.nombre))) ? 'Copiado' : 'No pude copiar'); setNuevo(null); }}>Copiar comando</Button>
          </PieM>
        )) : undefined}>
        {nuevo && <NuevoChat borrador={nuevo} onCambio={setNuevo} onCopiar={async (t) => toast((await copiar(t)) ? 'Copiado' : 'No pude copiar')}
          puedeAbrir={!!centro?.puedeAbrirEn(nuevo.cuenta)} estado={centro?.apertura ?? null} />}
      </SheetM>
      </>}
      {conLista && secciones.map(({ clave: k, titulo, chats: lista }) => {
        const todas = enteras.has(k);
        // Lo que trabaja o espera a Martín nunca queda detrás de «Ver todos».
        const corte = todas ? lista : lista.filter((c, i) => i < VISIBLES || esPrioritario(c, avisos));
        return (
          <SeccionM key={k} titulo={titulo ?? (k === SECCION_CEREBRO ? CEREBRO : tituloChats)}>
            <ListaM etiqueta={titulo ?? (k === SECCION_CEREBRO ? CEREBRO : tituloChats)}>
              {(k === SECCION_CHATS
                ? porJefe(corte).flatMap((g) => [
                  ...(g.chat ? [{ c: g.chat, sub: false }] : []),
                  ...g.subs.map((c) => ({ c, sub: true })),
                ])
                : corte.map((c) => ({ c, sub: false }))
              ).map(({ c, sub }) => {
                const lineasC = historialDelChat(c, porId, trabajos, respuestasDelChat(c, decisiones, carteros));
                const p = vistaPrevia(lineasC);
                const vivo = c.estado === 'trabajando' && !c.viejo;
                const espera = esperaDe(c, esperas);
                return (
                  <FilaM
                    key={c.clave}
                    // Un sub-chat va corrido a la derecha, con su muñeco más chico y sólo lo que va después de «›».
                    leading={<span className={sub ? 'm-operaciones-sub' : undefined}><Muneco titulo={c.titulo} aspecto={elegidoPara(munecos, c.titulo)} animo={animoDe(c)} size={sub ? 32 : 40} espera={espera} /></span>}
                    titulo={<span className="m-operaciones-texto1">{sub ? `↳ ${partesDelNombre(c.titulo).sub}` : c.titulo}{c.nube && <> <span className="co-chip-cuenta">Nube</span></>}</span>}
                    segunda={vivo
                      ? <span className="m-operaciones-vivo">{enQueTrabaja(lineasC) ?? 'trabajando…'}</span>
                      : espera > 0 ? <span className="m-operaciones-espera">Espera tu respuesta</span>
                      : p ? <span className="m-operaciones-previa">{p.tick ? <Tick estado={p.tick} /> : p.propio ? 'Tú: ' : ''}{p.texto}</span>
                        : undefined}
                    riel={<span className="m-operaciones-hace">{edad(c.actividad, ahora)}</span>}
                    onClick={() => setAbierto(c.clave)}
                    chevron={false}
                  />
                );
              })}
              {lista.length > corte.length && <FilaM titulo={`Ver los ${lista.length} chats`} onClick={() => setEnteras((s) => new Set(s).add(k))} navegacion />}
            </ListaM>
          </SeccionM>
        );
      })}
      {/* ⚠️ UNA SOLA HOJA: en el teléfono nunca hay dos (SheetM → «Una hoja sobre otra REEMPLAZA»), así que las opciones,
          Renombrar y el muñeco se abren ADENTRO de la de la conversación, con su «‹» para volver, como una navegación de
          iOS dentro de una hoja. Abrirlas en una hoja nueva cerraba la conversación, y con ella la hoja nueva. */}
      {conHoja && <SheetM abierto={!!elegido} onCerrar={cerrarHoja} snap="alto"
        titulo={renombre ? 'Renombrar' : eligiendo ? 'Su criatura' : elegido?.titulo ?? 'Chat'}
        ocupado={!!renombre?.mandando || !!eligiendo?.guardando}
        pie={renombre ? (
          <PieM consecuencia={elegido && new Set(elegido.sesiones.map((s) => s.cuenta)).size > 1 ? `Se renombra en sus ${new Set(elegido.sesiones.map((s) => s.cuenta)).size} cuentas.` : undefined}>
            <Button variant="primary" size="lg" full loading={renombre.mandando} onClick={renombrar}>Renombrar</Button>
          </PieM>
        ) : eligiendo ? (
          <PieM>
            <Button variant="primary" size="lg" full loading={eligiendo.guardando} onClick={() => guardarMuneco(eligiendo.aspecto)}>Guardar criatura</Button>
            {elegido && elegidoPara(munecos, elegido.titulo) && <Button variant="tertiary" size="lg" full disabled={eligiendo.guardando} onClick={() => guardarMuneco(null)}>Volver al de siempre</Button>}
          </PieM>
        ) : opciones ? undefined : pie}>
        {elegido && (renombre || eligiendo || opciones) && (
          <button type="button" className="m-operaciones-volver" disabled={!!renombre?.mandando || !!eligiendo?.guardando}
            onClick={() => { setRenombre(null); setEligiendo(null); setOpciones(false); }}>
            <span aria-hidden>‹</span> {elegido.titulo}
          </button>
        )}
        {elegido && renombre && (
          <form onSubmit={(e) => { e.preventDefault(); renombrar(); }}>
            <Field label="Nombre" hint="Para ponerlo dentro de su jefe: CRM › Lead Detail" error={renombre.error ?? undefined}>
              <Input value={renombre.texto} maxLength={120} disabled={renombre.mandando} style={{ fontSize: 16 }}
                onChange={(e) => setRenombre({ ...renombre, texto: e.target.value, error: null })} />
            </Field>
          </form>
        )}
        {elegido && !renombre && eligiendo && (
          <ElegirMuneco titulo={elegido.titulo} animo={animoDe(elegido)} aspecto={eligiendo.aspecto} onCambio={(a) => setEligiendo({ ...eligiendo, aspecto: a })} />
        )}
        {elegido && !renombre && !eligiendo && opciones && (
          <ListaM etiqueta="Opciones">
            {elegido.sesiones.length > 0 && <FilaM icono="pen" titulo="Renombrar" onClick={() => { setOpciones(false); setRenombre({ texto: elegido.titulo, error: null, mandando: false }); }} navegacion />}
            <FilaM icono="perfil" titulo="Cambiar su criatura" onClick={() => { setOpciones(false); abrirMuneco(); }} navegacion />
          </ListaM>
        )}
        {elegido && !renombre && !eligiendo && !opciones && (
          <div className="m-operaciones-hilo" ref={hilo}>
            <div className="m-operaciones-hilo__meta">
              {/* Sin «⋯» desde el 17/10/2026: tocar el muñeco abre Renombrar y Cambiar su muñeco. */}
              <button type="button" className="m-operaciones-muneco" onClick={() => setOpciones(true)} aria-label={`Opciones de ${elegido.titulo}`}>
                <Muneco titulo={elegido.titulo} aspecto={elegidoPara(munecos, elegido.titulo)} animo={animoDe(elegido)} size={28} />
              </button>
              {[...new Set(elegido.sesiones.map((s) => s.cuenta).filter((x): x is string => !!x))].map((x) => <span key={x} className="co-chip-cuenta">{nombreCuenta(x)}</span>)}
              {metaDe(elegido)}
            </div>
            <Hilo lineas={lineas} pushes={pushes ?? []} ahora={ahora} vacio="Escríbele abajo para empezar." quien={{ titulo: elegido.titulo, aspecto: elegidoPara(munecos, elegido.titulo), animo: animoDe(elegido), dato: trabajaSinEscribir(elegido, lineas) ?? metaDe(elegido) }}
              vivo={{ chat: elegido, carteros }}
              onResponder={centro ? (p, e, o) => centro.contestarPregunta(elegido, p, e, o) : undefined}
              tareas={centro?.tareasDe(elegido)} onFeedback={responderSobre} />
            {/* Lo que espera de Martín, al final de la conversación y pegado a la caja: AskUserQuestion de Claude Code. */}
            {preguntas.length > 0 && <Pregunta key={elegido.clave} preguntas={preguntas} responder={responder} />}
          </div>
        )}
      </SheetM>}
    </>
  );
}

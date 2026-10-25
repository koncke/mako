'use client';

// =============================================================================
// PanelEditarMako — «Editar con MaKo»: el chat que cambia la hoja abierta (Dashboard y General)
// =============================================================================
// Martín, 16/10/2026: «en dashboard y general no está la edición con IA, y debería... quiero que la app sea AI NATIVE».
// Etapa 1 de docs/diseno-mako-ai-native.md (rama centro-chat): un panel con la pieza MÍNIMA (el hilo, la caja y lo que
// cambió con su Deshacer), sin barra de chats y sin streaming. Cuando exista la pieza única del Centro, éste se muda a ella.
//
// COPIADO DEL PANEL LATERAL DE GEMINI EN GOOGLE WORKSPACE (el Dashboard copia Looker Studio, y Gemini es su panel): a la
// derecha de la hoja, un saludo con pedidos de ejemplo cuando está vacío, lo que pide la persona en una burbuja a la
// derecha, lo que hizo MaKo a la izquierda con su logo, y la caja abajo. El marco es el del AI Analyst (`.an`,
// ./PanelAnalista.tsx): flota sobre la grilla sin empujarla y en el celular va a pantalla completa.
//
// Lo que gobierna, y no se ve en las firmas:
//   · EL CAMBIO LO APLICA EL EDITOR, con `mutar` (`onAplicar`): un solo escritor del informe, y el Ctrl+Z sigue vivo. La
//     ruta (app/api/graficos/editar) no escribe nada.
//   · SE MANDA LA HOJA COMO ESTÁ EN PANTALLA, y la respuesta sólo se aplica si esa hoja no cambió mientras MaKo pensaba
//     (`leerHoja`, por referencia): pisaría lo que la persona tocó en el medio.
//   · «DESHACER» SÓLO MIENTRAS LA HOJA SIGUE SIENDO LA QUE DEJÓ MaKo (la misma referencia): después de otro cambio,
//     deshacer el de MaKo borraría también el de la persona. Para eso está el Ctrl+Z del editor.
//   · EL HILO ES POR HOJA y lo tiene el editor (cerrar y abrir el panel no lo pierde). Desde el 22/10/2026 queda en la BASE
//     (`dashboard:<hoja>`, ./hilo-guardado.ts y /api/hilo-de-tab): cada turno se guarda al terminar, y al abrir el panel
//     sobre una hoja sin hilo se trae lo guardado. Así sobrevive a recargar y se ve en el Ops Center.
//
// LA CARA DEL OPS CENTER (22/10/2026, TB3; Martín: «quiero que todos los chats de MaKo en las tabs sean el del Ops Center»):
// el hilo es `HiloMako` y la caja es `CajaChat` (app/_chat/), las piezas únicas. Desde el 23/10/2026, adentro del PANEL único
// (PanelChat.tsx → PanelDeChat) y con la estrella de MaKo, no el muñeco de la tab (Martín: «Tienes que UNIFICAR los chats con
// MaKo en toda la app»; la regla del 21/10: las criaturas de MaKo son siempre su estrella). Lo que sólo tiene este chat —«lo que cambió» con su Deshacer, los avisos, un error con
// su link y los pedidos de otra hoja con sus botones— va en el hueco `enMensaje` del hilo (./items-edicion.ts). El motor es
// el de siempre (la ruta de los pedidos y /api/graficos/editar): la estrella de la tab, en «analizar», no edita la hoja.
// Y va a la IZQUIERDA, como todo MaKo en una tab (el marco `.an`, ./PanelAnalista.tsx).

import { useEffect, useMemo, useRef, useState } from 'react';
import { sanearHoja, type Hoja } from '@/lib/graficos-catalogo';
import { TOPE_PEDIDO_IA } from '@/lib/graficos-ia';
import { TURNOS_IA, type TurnoEdicion } from '@/lib/graficos-ia-edicion';
import { Muneco } from '@/app/admin/operaciones/Muneco';
import { CajaChat } from '@/app/_chat/CajaChat';
import { HiloMako, type EnMensaje } from '@/app/_chat/HiloMako';
import { PanelDeChat } from '@/app/admin/operaciones/PanelChat';
import { ASPECTO_MAKO } from '@/lib/centro-munecos';
import type { ItemHilo } from '@/app/m/mako/chat-ui';
import '@/app/admin/operaciones/centro.css';
import { PLAZO_PEDIDOS_MS, pedirPedidos } from '@/app/web-generator/cliente';
import { CSS_PANEL_LATERAL } from './PanelAnalista';
import { TextoConLink } from './NuevaHoja';
import { CSS_MODOS_MAKO, ModosMako, type ModoMako } from './ModosMako';
import { filasDeHilo, hiloDeFilas, tituloDeHoja } from './hilo-guardado';
import { indiceDe, itemsDeEdicion } from './items-edicion';
import { guardarEnHiloDeTab, leerHiloDeTab } from '@/lib/hilo-de-tab-cliente';
import { claveDeHoja } from '@/lib/hilo-de-tab-reglas';
import {
  TAB_DEL_INFORME, burbujasDeHoja, interpretacionDe, pulsarHoja, textoActual, trasCrear, vistaDeBurbujaHoja,
  type BotonHoja, type BurbujaHoja,
} from './pedidos-hoja';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { useAppDeEscritorio } from '@/app/_chat/useAppDeEscritorio';

/** Un mensaje del hilo. El de MaKo trae lo que cambió y, si cambió algo, la hoja de antes para deshacerlo. */
export type MensajeEdicion =
  | { k: 'yo'; texto: string }
  | { k: 'el'; texto: string; cambios: string[]; avisos: string[]; hojaId?: string; antes?: Hoja; aplicada?: Hoja; deshecho?: boolean; analizar?: boolean }
  | { k: 'error'; texto: string; link?: string }
  /** Un pedido que no es de esta hoja (otra hoja, otra tab, crear otra): ./pedidos-hoja.ts. */
  | { k: 'pedido'; id: string; burbuja: BurbujaHoja };

/** El tope de la ruta (`maxDuration = 120`) + margen. */
const TOPE_CLIENTE_MS = 125_000;

/** Los pedidos de ejemplo del panel vacío: genéricos (AGENTS.md: un ejemplo de pantalla es ficticio por regla). */
// 17/10/2026: «Probemos…» es Experiments, que se mudó acá (lib/experimentos-catalogo.ts): el ejemplo enseña que existe.
export const SUGERENCIAS_DASHBOARD = ['Agrega los leads por semana', 'Pon arriba lo cobrado del mes', 'Probemos un anuncio con testimonio'] as const;
export const SUGERENCIAS_GENERAL = ['Agrega mis tareas prioritarias', 'Pon arriba lo cobrado del mes', 'Agrega Mi día'] as const;

const lista = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : []);

/** Lo que viaja de lo hablado: los últimos turnos, sin los errores. */
function historialDe(hilo: readonly MensajeEdicion[]): TurnoEdicion[] {
  return hilo.flatMap((m): TurnoEdicion[] => {
    if (m.k === 'yo') return [{ quien: 'persona', texto: m.texto }];
    if (m.k === 'el') return [{ quien: 'mako', texto: [m.texto, ...m.cambios].filter(Boolean).join(' · ') }];
    return [];
  }).slice(-TURNOS_IA);
}

export function PanelEditarMako({ hoja, informe, hilo, onHilo, leerHoja, onAplicar, onDeshacer, onCrearHoja, onAbrirHoja, onArchivarHoja, onCerrar, textoInicial = '', onModo, editando }: {
  /** La hoja abierta. */
  hoja: Hoja;
  /**
   * Si la persona está EDITANDO la hoja (17/10/2026). El editor sólo monta este panel editando, y la ruta no cambia nada
   * sin esto (`permisoEdicionMako`): en vista, MaKo asesora.
   */
  editando: boolean;
  /** El tercer tipo (`automatizacion:N`) entró con las «Métricas» por automatización y ya llega acá. */
  informe: 'dashboard' | 'general' | `automatizacion:${number}`;
  /** El hilo de ESTA hoja (lo guarda el editor, así cerrar y abrir el panel no lo pierde). */
  hilo: readonly MensajeEdicion[];
  onHilo: (fn: (h: MensajeEdicion[]) => MensajeEdicion[]) => void;
  /** La hoja de ese id como está AHORA en el informe (por referencia). */
  leerHoja: (id: string) => Hoja | null;
  /** Mete la hoja cambiada en el informe (con `mutar`: tiene deshacer y se guarda). */
  onAplicar: (h: Hoja) => void;
  /** Vuelve la hoja a como estaba antes de un cambio de MaKo. */
  onDeshacer: (antes: Hoja) => void;
  /** Una hoja nueva que armó MaKo con un pedido de «crear otra» (la agrega y la abre: `crearHoja` del editor). */
  onCrearHoja: (h: Hoja) => void;
  /** Abre otra hoja del informe (`irAHoja`). */
  onAbrirHoja: (id: string) => void;
  /** Archiva otra hoja del informe (`eliminarHoja`: queda en Archivados, con su Deshacer). Ya confirmado. */
  onArchivarHoja: (id: string) => void;
  onCerrar: () => void;
  /** Lo que la caja trae escrito al abrir (un link viejo de /experimentos con su hipótesis: «Probemos: …»). */
  textoInicial?: string;
  /**
   * #862: pasar al otro modo del MISMO MaKo (./ModosMako.tsx). Con esto la cabecera dice «Analizar · Editar» y un análisis
   * pedido acá ofrece «Analizar la hoja». Sin esto (quien no tiene AI Analyst), la cabecera es el título de siempre.
   */
  onModo?: (m: ModoMako) => void;
}) {
  const [texto, setTexto] = useState(textoInicial);
  // Sin la app de escritorio no se escribe (25/10/2026, Martín: «En ningun chat, no solo en Ops Center»): app/_chat/useAppDeEscritorio.tsx.
  const appEscritorio = useAppDeEscritorio();
  /** Desde cuándo piensa MaKo (null = no piensa). */
  const [desde, setDesde] = useState<number | null>(null);
  const [ahora, setAhora] = useState(() => Date.now());
  const [errorDictado, setErrorDictado] = useState<string | null>(null);
  const ctrl = useRef<AbortController | null>(null);
  /** El id de la próxima burbuja (para reemplazarla en el hilo cuando cambia). */
  const idPedido = useRef(0);
  const campo = useRef<HTMLTextAreaElement>(null);
  const fin = useRef<HTMLDivElement>(null);
  /** La conversación del panel único (PanelDeChat): la columna que scrollea. */
  const hiloPanel = useRef<HTMLDivElement>(null);
  const pensando = desde != null;

  useEffect(() => {
    if (!pensando) return;
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [pensando]);
  // Cerrar el panel corta el pedido: la ruta no escribió nada, así que no queda nada a medias.
  useEffect(() => () => ctrl.current?.abort(), []);
  useEffect(() => { fin.current?.scrollIntoView({ block: 'end' }); }, [hilo.length, pensando]);
  // Abrir el panel es para escribir: el foco va a la caja.
  useEffect(() => { campo.current?.focus(); }, []);
  // Una hoja sin hilo en el editor trae el suyo de la base (recién recargada, u otra computadora). Lo que se haya
  // escrito mientras llegaba queda DESPUÉS de lo guardado.
  const hayHilo = hilo.length > 0;
  useEffect(() => {
    if (hayHilo) return;
    const c = new AbortController();
    void leerHiloDeTab(claveDeHoja(hoja.id), c.signal).then((filas) => {
      if (c.signal.aborted || !filas?.length) return;
      const guardado = hiloDeFilas(filas);
      onHilo((h) => [...guardado, ...h]);
    });
    return () => c.abort();
    // Sólo al cambiar de hoja: una vez que hay hilo, el del editor es la verdad.
  }, [hoja.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const enviar = async (escrito?: string) => {
    const mensaje = (escrito ?? texto).trim().slice(0, TOPE_PEDIDO_IA);
    if (!mensaje || pensando || appEscritorio.bloqueada) return;
    const enviada = hoja;
    const historial = historialDe(hilo);
    onHilo((h) => [...h, { k: 'yo', texto: mensaje }]);
    setTexto('');
    setErrorDictado(null);
    const c = new AbortController();
    ctrl.current = c;
    const tope = setTimeout(() => c.abort(), TOPE_CLIENTE_MS);
    setDesde(Date.now());
    setAhora(Date.now());
    // Lo de este turno, para guardarlo en la base al terminar (./hilo-guardado.ts): el pedido y lo que contestó MaKo.
    const delTurno: MensajeEdicion[] = [{ k: 'yo', texto: mensaje }];
    const decir = (m: MensajeEdicion) => { delTurno.push(m); onHilo((h) => [...h, m]); };
    try {
      // 1 · ENTENDER EL PEDIDO (docs/diseno-mako-pedidos.md, «El punto de enganche»): lo de esta hoja sigue a la
      //     edición de siempre; lo demás —otra hoja, otra tab, crear otra— son burbujas (./pedidos-hoja.ts). Si la ruta
      //     falla o tarda más de `PLAZO_PEDIDOS_MS`, el mensaje entero es de esta hoja: lo de antes, sin regresión.
      const r = await pedirPedidos({ texto: mensaje, tab: informe === 'general' ? TAB_DEL_INFORME.general : TAB_DEL_INFORME.dashboard, actualId: enviada.id, actualNombre: enviada.nombre }, { ms: PLAZO_PEDIDOS_MS, signal: c.signal });
      if (ctrl.current !== c) return;
      const interpretacion = interpretacionDe(r, mensaje);
      const deEstaHoja = textoActual(interpretacion);
      const burbujas = burbujasDeHoja(interpretacion, enviada.id);
      // 2 · Lo de esta hoja, a la edición.
      if (deEstaHoja) {
        const res = await fetch('/api/graficos/editar', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          // 17/10/2026: el server sólo cambia la hoja con el modo, «editando» y ESA hoja (`permisoEdicionMako`).
          body: JSON.stringify({ hoja: enviada, pedido: deEstaHoja, historial, informe, modo: 'editar', editando, hojaId: enviada.id }), signal: c.signal,
        });
        const j = await res.json().catch(() => null) as { ok?: boolean; respuesta?: unknown; cambios?: unknown; avisos?: unknown; hoja?: unknown; analizar?: unknown; error?: string; link?: string } | null;
        if (ctrl.current !== c) return;
        if (!res.ok || !j?.ok) {
          decir({ k: 'error', texto: j?.error || `Error ${res.status}`, link: j?.link });
        } else {
          const respuesta = typeof j.respuesta === 'string' ? j.respuesta : '';
          const cambios = lista(j.cambios);
          const avisos = lista(j.avisos);
          // Lo que llega por la red se vuelve a sanear: la hoja vale por lo que dice el catálogo de acá.
          const nueva = j.hoja != null && cambios.length ? sanearHoja(j.hoja, 0) : null;
          // #862: un análisis pedido en Editar no cambió la hoja: la burbuja ofrece pasar a Analizar.
          if (j.analizar === true) decir({ k: 'el', texto: respuesta, cambios: [], avisos, analizar: true });
          else if (j.hoja == null || !cambios.length) decir({ k: 'el', texto: respuesta, cambios: [], avisos });
          else if (!nueva || nueva.id !== enviada.id) decir({ k: 'error', texto: 'Llegó otra hoja. Prueba de nuevo.' });
          else if (leerHoja(enviada.id) !== enviada) decir({ k: 'error', texto: 'La hoja cambió mientras MaKo pensaba. Pídelo de nuevo.' });
          else {
            onAplicar(nueva);
            decir({ k: 'el', texto: respuesta, cambios, avisos, hojaId: enviada.id, antes: enviada, aplicada: nueva });
          }
        }
      }
      // 3 · Lo demás, como burbujas de MaKo (después de lo de esta hoja: «¿Terminamos esto y después…?» ya está terminado).
      // El id con la hora: cerrar y abrir el panel lo vuelve a montar, y el hilo (del editor) queda con las de antes.
      for (const b of burbujas) decir({ k: 'pedido', id: `${Date.now().toString(36)}-${++idPedido.current}`, burbuja: b });
    } catch {
      if (ctrl.current !== c) return;
      decir({ k: 'error', texto: c.signal.aborted ? 'Tardó demasiado. Prueba de nuevo.' : 'Sin conexión. Prueba de nuevo.' });
    } finally {
      clearTimeout(tope);
      if (ctrl.current === c) { ctrl.current = null; setDesde(null); }
      // De la hoja a la que se le pidió (si la persona cambió de hoja mientras tanto, igual es de ésa).
      void guardarEnHiloDeTab(claveDeHoja(enviada.id), tituloDeHoja(enviada.nombre), filasDeHilo(delTurno));
    }
  };

  /** Una burbuja cambia (con un clic o con lo que el clic pidió): se reemplaza por id en el hilo de la hoja donde nació. */
  const cambiarBurbuja = (id: string, burbuja: BurbujaHoja) =>
    onHilo((h) => h.map((x) => (x.k === 'pedido' && x.id === id ? { ...x, burbuja } : x)));

  /**
   * Un clic en una burbuja: el estado nuevo y el efecto. Crear arma la hoja con MaKo (/api/graficos/ia, la misma de «¿Qué
   * vas a crear hoy?») y la entrega al editor, que la agrega y la abre; abrir y archivar son del editor.
   */
  const alPulsar = async (m: Extract<MensajeEdicion, { k: 'pedido' }>, boton: BotonHoja) => {
    const { burbuja, efecto } = pulsarHoja(m.burbuja, boton);
    cambiarBurbuja(m.id, burbuja);
    if (!efecto) return;
    if (efecto.tipo === 'abrir') { onAbrirHoja(efecto.id); return; }
    if (efecto.tipo === 'archivar') { onArchivarHoja(efecto.id); return; }
    let creada: Hoja | null = null;
    try {
      const res = await fetch('/api/graficos/ia', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pedido: efecto.pedido.slice(0, TOPE_PEDIDO_IA), informe }), signal: AbortSignal.timeout(TOPE_CLIENTE_MS),
      });
      const j = await res.json().catch(() => null) as { ok?: boolean; hoja?: unknown } | null;
      creada = res.ok && j?.ok ? sanearHoja(j.hoja, 0) : null;
    } catch { creada = null; }
    cambiarBurbuja(m.id, trasCrear(burbuja, !!creada));
    if (creada) onCrearHoja(creada);
  };

  const cancelar = () => { ctrl.current?.abort(); ctrl.current = null; setDesde(null); };

  const deshacer = (m: Extract<MensajeEdicion, { k: 'el' }>) => {
    if (!m.antes || !m.hojaId || leerHoja(m.hojaId) !== m.aplicada) return;
    onDeshacer(m.antes);
    onHilo((h) => h.map((x) => (x === m ? { ...m, deshecho: true } : x)));
  };

  const sugerencias = informe === 'general' ? SUGERENCIAS_GENERAL : SUGERENCIAS_DASHBOARD;
  const segundos = desde != null ? Math.max(0, Math.round((ahora - desde) / 1000)) : 0;
  const animo = pensando ? 'trabajando' : 'despierto';
  const items = useMemo(() => itemsDeEdicion(hilo), [hilo]);

  /** Lo que sólo tiene este chat, adentro del mensaje de MaKo que lo dijo (./items-edicion.ts). */
  const enMensaje = (x: Extract<ItemHilo, { k: 'msg' }>): EnMensaje | null => {
    const n = indiceDe(x.id);
    const m = n == null ? null : hilo[n];
    if (!m || m.k === 'yo') return null;
    if (m.k === 'error') return { arriba: <p className="em-err" role="alert"><TextoConLink texto={m.texto} link={m.link} /><ReportarASoporte /></p> };
    if (m.k === 'pedido') {
      // Un pedido que no es de esta hoja: su texto, su link (otra tab) y sus botones (./pedidos-hoja.ts).
      const v = vistaDeBurbujaHoja(m.burbuja);
      return {
        arriba: <p className={v.error ? 'em-err' : 'em-texto'} data-pedido={m.burbuja.tipo}>{v.texto}</p>,
        abajo: <>
          {v.link && <a className="em-link" href={v.link.href}>{v.link.texto} →</a>}
          {v.botones.length > 0 && (
            <div className="em-botones">
              {v.botones.map((b) => (
                <button key={b.id} type="button" className={b.primario ? 'em-boton em-boton--primario' : 'em-boton'} disabled={v.ocupado}
                  onClick={() => { void alPulsar(m, b.id); }}>{b.texto}</button>
              ))}
            </div>
          )}
        </>,
      };
    }
    const puede = !!m.aplicada && !m.deshecho && !!m.hojaId && leerHoja(m.hojaId) === m.aplicada;
    const hay = m.cambios.length > 0 || m.avisos.length > 0 || !!m.deshecho || puede || (!!m.analizar && !!onModo);
    if (!hay) return null;
    return {
      abajo: <div className="em-el-cuerpo">
        {m.cambios.length > 0 && <ul className="em-cambios">{m.cambios.map((c, k) => <li key={k}>{c}</li>)}</ul>}
        {m.avisos.length > 0 && <p className="em-aviso">{m.avisos.join(' · ')}</p>}
        {m.deshecho && <p className="em-aviso">Deshecho</p>}
        {puede && <button type="button" className="em-deshacer" onClick={() => deshacer(m)}>Deshacer</button>}
        {m.analizar && onModo && (
          <div className="em-botones">
            <button type="button" className="em-boton em-boton--primario" onClick={() => onModo('analizar')}>Analizar la hoja</button>
          </div>
        )}
      </div>,
    };
  };

  return (
    // Un <section> y no un <aside>: la barra de la agencia (app/globals.css, `[data-barra-agencia] aside`) le fuerza a todo
    // <aside> el alto de la ventana y su `top`, y el panel quedaba más alto que el lienzo, con la caja fuera de la vista.
    <section role="complementary" className="an em" aria-label="Editar con MaKo" onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onCerrar(); } }}>
      <style>{CSS_PANEL_LATERAL + CSS + CSS_MODOS_MAKO}</style>
      {/* EL CHAT DEL OPS CENTER (23/10/2026, Martín: «Tienes que UNIFICAR los chats con MaKo en toda la app»): el panel único
          (PanelChat.tsx) con su cabecera y la estrella de MaKo (antes, la criatura de la tab), los modos y el cerrar a su lado;
          el hilo y la caja únicos adentro. Lo propio de la hoja (su motor, deshacer, analizar) sigue acá. */}
      <PanelDeChat hilo={hiloPanel}
        cabecera={{ clave: 'editar-con-mako', titulo: onModo ? 'MaKo' : 'Editar con MaKo', criatura: 'MaKo', aspecto: ASPECTO_MAKO, animo,
          acciones: <>
            {onModo && <ModosMako modo="editar" onModo={onModo} />}
            <button type="button" className="an-x" onClick={onCerrar} aria-label="Cerrar" title="Cerrar" style={{ marginLeft: 'auto' }}>×</button>
          </> }}
        caja={<>
          <div className="co-caja">
            <CajaChat campo={campo} texto={texto} onTexto={(t) => { setTexto(t); setErrorDictado(null); }} onMandar={() => { void enviar(); }}
              ocupado={pensando} placeholder="Pídele un cambio a MaKo" tituloMandar="Mandar" enterManda onErrorMic={setErrorDictado}
              bloqueo={appEscritorio.bloqueo} />
          </div>
          {errorDictado && <p className="em-err">{errorDictado}</p>}
        </>}
        estado="">
          {!hilo.length && (
            <div className="em-vacio">
              <Muneco titulo="MaKo" aspecto={ASPECTO_MAKO} animo={animo} size={64} />
              <p className="em-hola">¿Qué le cambio a esta hoja?</p>
              <p className="em-sub">Pídelo con tus palabras.</p>
              <div className="em-sugs">
                {sugerencias.map((s) => (
                  <button key={s} type="button" className="em-sug" disabled={pensando} onClick={() => { void enviar(s); }}>{s}</button>
                ))}
              </div>
            </div>
          )}
          {/* Las filas del Ops Center, con la estrella de MaKo; mientras piensa, su «Trabajando…» con los segundos. */}
          <HiloMako items={items} quien={{ nombre: 'MaKo', aspecto: ASPECTO_MAKO }} ahora={ahora} escribiendo={pensando ? { segs: segundos } : null}
            tarjeta={null} onTarjeta={nada} onReintentar={nada} onRecargar={nada} enMensaje={enMensaje} />
          {pensando && <button type="button" className="em-cancelar" onClick={cancelar}>Cancelar</button>}
          <div ref={fin} />
      </PanelDeChat>
    </section>
  );
}

const nada = () => {};

// Sin backticks acá adentro: es un template literal. Sólo tokens de la app (se dan vuelta en oscuro).
const CSS = `
.an.em { overflow: hidden; padding: 0; }
.an.em { display: flex; flex-direction: column; }
.em > .co-panel { flex: 1; min-height: 0; }
.em .co-cab { padding: 0 8px 0 14px; }
.em .co-hilo { padding: 16px; }
.em .co-hilo__col { min-height: 100%; }
.em-vacio { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; margin: auto 0 0; }
.em-hola { margin: 6px 0 0; font-size: 18px; font-weight: 600; line-height: 1.3; color: var(--ink); }
.em-sub { margin: 0; font-size: 13px; color: var(--dim); }
.em-sugs { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; margin-top: 8px; }
.em-sug { max-width: 100%; text-align: left; padding: 8px 12px; border-radius: 12px; border: 1px solid var(--border-strong);
  background: var(--surface); color: var(--ink); font: inherit; font-size: 13px; line-height: 1.35; cursor: pointer; }
.em-sug:hover:not(:disabled) { background: var(--surface-2); border-color: var(--primary); }
.em-el-cuerpo { min-width: 0; display: flex; flex-direction: column; gap: 6px; margin-top: 4px; }
.em-texto { margin: 0; font-size: 14px; line-height: 1.5; color: var(--ink); overflow-wrap: anywhere; }
.em-cambios { margin: 0; padding-left: 18px; font-size: 13px; line-height: 1.55; color: var(--ink); }
.em-aviso { margin: 0; font-size: 12.5px; color: var(--dim); }
.em-deshacer { align-self: flex-start; border: none; background: none; padding: 0; font: inherit; font-size: 13px; font-weight: 600;
  color: var(--primary); cursor: pointer; }
.em-deshacer:hover { text-decoration: underline; }
.em-err { margin: 0; font-size: 13px; line-height: 1.45; color: var(--bad); }
.em-link { align-self: flex-start; font-size: 13px; font-weight: 600; color: var(--primary); text-decoration: none; }
.em-link:hover { text-decoration: underline; }
.em-botones { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
.em-boton { height: 30px; padding: 0 12px; border-radius: 15px; border: 1px solid var(--border-strong); background: var(--surface);
  color: var(--ink); font: inherit; font-size: 13px; cursor: pointer; }
.em-boton:hover:not(:disabled) { background: var(--surface-2); }
.em-boton--primario { background: var(--primary); border-color: var(--primary); color: var(--on-primary); }
.em-boton--primario:hover:not(:disabled) { background: var(--primary); filter: brightness(1.06); }
.em-boton:disabled { opacity: .6; cursor: default; }
.em-cancelar { align-self: flex-start; border: none; background: none; padding: 0; font: inherit; font-size: 13px; color: var(--dim); cursor: pointer; }
.em-cancelar:hover { color: var(--ink); text-decoration: underline; }
.em-caja-wrap { flex: none; display: flex; flex-direction: column; gap: 6px; margin: 0 12px 12px; }
@media (prefers-reduced-motion: reduce) { .em-hilo { scroll-behavior: auto; } }
`;

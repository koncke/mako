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
//   · EL HILO ES DE LA SESIÓN, por hoja (lo guarda el editor): no se persiste en la etapa 1.
//
// LA CARA DEL SECOND BRAIN (17/10/2026, como el chat del CRM en 8db1e3cbc): donde iba el logo de MaKo va el MUÑECO de
// la tab («Dashboard» o «General», lib/centro-munecos.ts), trabajando mientras piensa, y la caja dicta con el
// micrófono del Second Brain (app/admin/operaciones/Microfono.tsx). El hilo NO es `HiloMako` (app/_chat/): lo de MaKo
// acá es «lo que cambió» con su Deshacer y los pedidos de otra hoja, que el modelo de mensajes del teléfono no tiene.

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { sanearHoja, type Hoja } from '@/lib/graficos-catalogo';
import { TOPE_PEDIDO_IA } from '@/lib/graficos-ia';
import { TURNOS_IA, type TurnoEdicion } from '@/lib/graficos-ia-edicion';
import { GRAMATICA } from '@/lib/mako-gramatica';
import { Muneco } from '@/app/admin/operaciones/Muneco';
import { Microfono } from '@/app/admin/operaciones/Microfono';
import '@/app/admin/operaciones/centro.css';
import { PLAZO_PEDIDOS_MS, pedirPedidos } from '@/app/web-generator/cliente';
import { CSS_PANEL_LATERAL } from './PanelAnalista';
import { TextoConLink } from './NuevaHoja';
import {
  TAB_DEL_INFORME, burbujasDeHoja, interpretacionDe, pulsarHoja, textoActual, trasCrear, vistaDeBurbujaHoja,
  type BotonHoja, type BurbujaHoja,
} from './pedidos-hoja';

/** Un mensaje del hilo. El de MaKo trae lo que cambió y, si cambió algo, la hoja de antes para deshacerlo. */
export type MensajeEdicion =
  | { k: 'yo'; texto: string }
  | { k: 'el'; texto: string; cambios: string[]; avisos: string[]; hojaId?: string; antes?: Hoja; aplicada?: Hoja; deshecho?: boolean }
  | { k: 'error'; texto: string; link?: string }
  /** Un pedido que no es de esta hoja (otra hoja, otra tab, crear otra): ./pedidos-hoja.ts. */
  | { k: 'pedido'; id: string; burbuja: BurbujaHoja };

/** El tope de la ruta (`maxDuration = 120`) + margen. */
const TOPE_CLIENTE_MS = 125_000;
/** Lo alto que crece la caja (después scrollea adentro). */
const ALTO_CAJA = 160;

/** Los pedidos de ejemplo del panel vacío: genéricos (AGENTS.md: un ejemplo de pantalla es ficticio por regla). */
export const SUGERENCIAS_DASHBOARD = ['Agrega los leads por semana', 'Pon arriba lo cobrado del mes', 'Quita el último gráfico'] as const;
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

export function PanelEditarMako({ hoja, informe, hilo, onHilo, leerHoja, onAplicar, onDeshacer, onCrearHoja, onAbrirHoja, onArchivarHoja, onCerrar }: {
  /** La hoja abierta. */
  hoja: Hoja;
  informe: 'dashboard' | 'general';
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
}) {
  const [texto, setTexto] = useState('');
  /** Desde cuándo piensa MaKo (null = no piensa). */
  const [desde, setDesde] = useState<number | null>(null);
  const [ahora, setAhora] = useState(() => Date.now());
  const [errorDictado, setErrorDictado] = useState<string | null>(null);
  const ctrl = useRef<AbortController | null>(null);
  /** El id de la próxima burbuja (para reemplazarla en el hilo cuando cambia). */
  const idPedido = useRef(0);
  const campo = useRef<HTMLTextAreaElement>(null);
  const fin = useRef<HTMLDivElement>(null);
  const pensando = desde != null;

  useEffect(() => {
    if (!pensando) return;
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [pensando]);
  // Cerrar el panel corta el pedido: la ruta no escribió nada, así que no queda nada a medias.
  useEffect(() => () => ctrl.current?.abort(), []);
  useEffect(() => { fin.current?.scrollIntoView({ block: 'end' }); }, [hilo.length, pensando]);
  useEffect(() => {
    const el = campo.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, ALTO_CAJA)}px`;
  }, [texto]);
  // Abrir el panel es para escribir: el foco va a la caja.
  useEffect(() => { campo.current?.focus(); }, []);

  const enviar = async (escrito?: string) => {
    const mensaje = (escrito ?? texto).trim().slice(0, TOPE_PEDIDO_IA);
    if (!mensaje || pensando) return;
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
    const decir = (m: MensajeEdicion) => onHilo((h) => [...h, m]);
    try {
      // 1 · ENTENDER EL PEDIDO (docs/diseno-mako-pedidos.md, «El punto de enganche»): lo de esta hoja sigue a la
      //     edición de siempre; lo demás —otra hoja, otra tab, crear otra— son burbujas (./pedidos-hoja.ts). Si la ruta
      //     falla o tarda más de `PLAZO_PEDIDOS_MS`, el mensaje entero es de esta hoja: lo de antes, sin regresión.
      const r = await pedirPedidos({ texto: mensaje, tab: TAB_DEL_INFORME[informe], actualId: enviada.id, actualNombre: enviada.nombre }, { ms: PLAZO_PEDIDOS_MS, signal: c.signal });
      if (ctrl.current !== c) return;
      const interpretacion = interpretacionDe(r, mensaje);
      const deEstaHoja = textoActual(interpretacion);
      const burbujas = burbujasDeHoja(interpretacion, enviada.id);
      // 2 · Lo de esta hoja, a la edición.
      if (deEstaHoja) {
        const res = await fetch('/api/graficos/editar', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hoja: enviada, pedido: deEstaHoja, historial, informe }), signal: c.signal,
        });
        const j = await res.json().catch(() => null) as { ok?: boolean; respuesta?: unknown; cambios?: unknown; avisos?: unknown; hoja?: unknown; error?: string; link?: string } | null;
        if (ctrl.current !== c) return;
        if (!res.ok || !j?.ok) {
          decir({ k: 'error', texto: j?.error || `Error ${res.status}`, link: j?.link });
        } else {
          const respuesta = typeof j.respuesta === 'string' ? j.respuesta : '';
          const cambios = lista(j.cambios);
          const avisos = lista(j.avisos);
          // Lo que llega por la red se vuelve a sanear: la hoja vale por lo que dice el catálogo de acá.
          const nueva = j.hoja != null && cambios.length ? sanearHoja(j.hoja, 0) : null;
          if (j.hoja == null || !cambios.length) decir({ k: 'el', texto: respuesta, cambios: [], avisos });
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
  // El muñeco de la tab: el mismo que tiene en el Centro de Operaciones.
  const tab = informe === 'general' ? 'General' : 'Dashboard';
  const animo = pensando ? 'trabajando' : 'despierto';

  return (
    <aside className="an em" aria-label="Editar con MaKo" onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onCerrar(); } }}>
      <style>{CSS_PANEL_LATERAL + CSS}</style>
      <div className="an-cab">
        <Muneco titulo={tab} animo={animo} size={26} />
        <span className="an-tit">Editar con MaKo</span>
        <button type="button" className="an-x" onClick={onCerrar} aria-label="Cerrar" title="Cerrar">×</button>
      </div>

      <div className="em-hilo" aria-live="polite">
        {!hilo.length && (
          <div className="em-vacio">
            <Muneco titulo={tab} animo={animo} size={64} />
            <p className="em-hola">¿Qué le cambio a esta hoja?</p>
            <p className="em-sub">Pídelo con tus palabras.</p>
            <div className="em-sugs">
              {sugerencias.map((s) => (
                <button key={s} type="button" className="em-sug" disabled={pensando} onClick={() => { void enviar(s); }}>{s}</button>
              ))}
            </div>
          </div>
        )}
        {hilo.map((m, i) => {
          if (m.k === 'yo') return <p key={i} className="em-yo">{m.texto}</p>;
          if (m.k === 'error') return <p key={i} className="em-err" role="alert"><TextoConLink texto={m.texto} link={m.link} /></p>;
          if (m.k === 'pedido') {
            // Un pedido que no es de esta hoja: su texto, su link (otra tab) y sus botones (./pedidos-hoja.ts).
            const v = vistaDeBurbujaHoja(m.burbuja);
            return (
              <div key={i} className="em-el" data-pedido={m.burbuja.tipo}>
                <span className="em-logo"><Muneco titulo={tab} animo="despierto" size={26} /></span>
                <div className="em-el-cuerpo">
                  <p className={v.error ? 'em-err' : 'em-texto'}>{v.texto}</p>
                  {v.link && <a className="em-link" href={v.link.href}>{v.link.texto} →</a>}
                  {v.botones.length > 0 && (
                    <div className="em-botones">
                      {v.botones.map((b) => (
                        <button key={b.id} type="button" className={b.primario ? 'em-boton em-boton--primario' : 'em-boton'} disabled={v.ocupado}
                          onClick={() => { void alPulsar(m, b.id); }}>{b.texto}</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          }
          const puede = !!m.aplicada && !m.deshecho && !!m.hojaId && leerHoja(m.hojaId) === m.aplicada;
          return (
            <div key={i} className="em-el">
              <span className="em-logo"><Muneco titulo={tab} animo="despierto" size={26} /></span>
              <div className="em-el-cuerpo">
                {m.texto && <p className="em-texto">{m.texto}</p>}
                {m.cambios.length > 0 && <ul className="em-cambios">{m.cambios.map((c, n) => <li key={n}>{c}</li>)}</ul>}
                {m.avisos.length > 0 && <p className="em-aviso">{m.avisos.join(' · ')}</p>}
                {m.deshecho && <p className="em-aviso">Deshecho</p>}
                {puede && <button type="button" className="em-deshacer" onClick={() => deshacer(m)}>Deshacer</button>}
              </div>
            </div>
          );
        })}
        {pensando && (
          <div className="em-pensando" role="status">
            <Muneco titulo={tab} animo="trabajando" size={26} />
            <span className="em-rotulo">{GRAMATICA.analizando.rotulo}</span>
            <span className="em-dim">· {segundos} s</span>
            <button type="button" className="em-cancelar" onClick={cancelar}>Cancelar</button>
          </div>
        )}
        <div ref={fin} />
      </div>

      <div className="em-caja">
        <textarea ref={campo} rows={1} value={texto} maxLength={TOPE_PEDIDO_IA} placeholder="Pídele un cambio a MaKo"
          aria-label="Qué cambiar en la hoja" style={CAMPO}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            // Enter manda; Shift+Enter, un renglón. Mientras se compone un acento (IME), Enter es del teclado.
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void enviar(); }
          }} />
        <div className="em-caja-pie">
          <Microfono valor={texto} onValor={(v) => { setTexto(v.slice(0, TOPE_PEDIDO_IA)); setErrorDictado(null); }} onError={setErrorDictado} apagado={pensando} />
          <button type="button" className="em-mandar" onClick={() => { void enviar(); }} disabled={!texto.trim() || pensando} aria-label="Mandar" title="Mandar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 19V5" /><path d="m5 12 7-7 7 7" />
            </svg>
          </button>
        </div>
        {errorDictado && <p className="em-err">{errorDictado}</p>}
      </div>
    </aside>
  );
}

const CAMPO: CSSProperties = {
  width: '100%', boxSizing: 'border-box', resize: 'none', border: 'none', outline: 'none', background: 'transparent',
  color: 'var(--ink)', font: 'inherit', fontSize: 14, lineHeight: 1.45, padding: 0, maxHeight: ALTO_CAJA,
};

// Sin backticks acá adentro: es un template literal. Sólo tokens de la app (se dan vuelta en oscuro).
const CSS = `
.an.em { overflow: hidden; padding: 0; }
.em-hilo { flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; padding: 16px; }
.em-vacio { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; margin: auto 0 0; }
.em-hola { margin: 6px 0 0; font-size: 18px; font-weight: 600; line-height: 1.3; color: var(--ink); }
.em-sub { margin: 0; font-size: 13px; color: var(--dim); }
.em-sugs { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; margin-top: 8px; }
.em-sug { max-width: 100%; text-align: left; padding: 8px 12px; border-radius: 12px; border: 1px solid var(--border-strong);
  background: var(--surface); color: var(--ink); font: inherit; font-size: 13px; line-height: 1.35; cursor: pointer; }
.em-sug:hover:not(:disabled) { background: var(--surface-2); border-color: var(--primary); }
.em-yo { align-self: flex-end; max-width: 85%; margin: 0; padding: 9px 13px; border-radius: 16px 16px 4px 16px;
  background: var(--surface-2); color: var(--ink); font-size: 14px; line-height: 1.45; white-space: pre-wrap; overflow-wrap: anywhere; }
.em-el { display: flex; gap: 10px; align-items: flex-start; }
.em-logo { flex: none; padding-top: 1px; }
.em-el-cuerpo { min-width: 0; display: flex; flex-direction: column; gap: 6px; }
.em-texto { margin: 0; font-size: 14px; line-height: 1.5; color: var(--ink); overflow-wrap: anywhere; }
.em-cambios { margin: 0; padding-left: 18px; font-size: 13px; line-height: 1.55; color: var(--ink); }
.em-aviso { margin: 0; font-size: 12.5px; color: var(--dim); }
.em-deshacer { align-self: flex-start; border: none; background: none; padding: 0; font: inherit; font-size: 13px; font-weight: 600;
  color: var(--primary); cursor: pointer; }
.em-deshacer:hover { text-decoration: underline; }
.em-err { margin: 0; font-size: 13px; line-height: 1.45; color: var(--bad); }
.em-link { align-self: flex-start; font-size: 13px; font-weight: 600; color: var(--primary); text-decoration: none; }
.em-link:hover { text-decoration: underline; }
.em-botones { display: flex; flex-wrap: wrap; gap: 6px; }
.em-boton { height: 30px; padding: 0 12px; border-radius: 15px; border: 1px solid var(--border-strong); background: var(--surface);
  color: var(--ink); font: inherit; font-size: 13px; cursor: pointer; }
.em-boton:hover:not(:disabled) { background: var(--surface-2); }
.em-boton--primario { background: var(--primary); border-color: var(--primary); color: var(--on-primary); }
.em-boton--primario:hover:not(:disabled) { background: var(--primary); filter: brightness(1.06); }
.em-boton:disabled { opacity: .6; cursor: default; }
.em-pensando { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 13px; }
.em-rotulo { font-weight: 600; color: var(--mako-ink); }
.em-dim { color: var(--dim); }
.em-cancelar { margin-left: auto; border: none; background: none; padding: 0; font: inherit; font-size: 13px; color: var(--dim); cursor: pointer; }
.em-cancelar:hover { color: var(--ink); text-decoration: underline; }
.em-caja { flex: none; display: flex; flex-direction: column; gap: 8px; margin: 0 12px 12px; padding: 10px 12px 8px;
  border: 1px solid var(--border-strong); border-radius: 16px; background: var(--surface); }
.em-caja:focus-within { border-color: var(--primary); }
.em-caja-pie { display: flex; align-items: center; justify-content: flex-end; gap: 6px; }
.em-mandar { width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center; border: none; border-radius: 50%;
  background: var(--primary); color: var(--on-primary); cursor: pointer; }
.em-mandar:disabled { background: var(--surface-2); color: var(--faint); cursor: default; }
@media (prefers-reduced-motion: reduce) { .em-hilo { scroll-behavior: auto; } }
`;

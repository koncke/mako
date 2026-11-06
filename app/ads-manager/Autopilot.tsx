'use client';

// =============================================================================
// Media Buyer — las piezas con la estructura de AdAmigo (25/10/2026)
// =============================================================================
// Martín, 25/10/2026 ~18:50: «Me gusta el de "AdAmigo" implementalo de punta en punta». Cada pieza es la de una captura de
// AdAmigo (docs/media-buyer/referencias/adamigo/): la cabecera «I've prepared 2 new AI Actions for today» con su barra
// «0/2 applied» y «Adjust AI» (adamigo-1), la tarjeta de acción con su agente, Qué · Por qué · Impacto esperado y
// 🗑 · ⚙ · Ask · Apply (adamigo-1 y adamigo-3), el cambio «$250 → $300/day +20%» (adamigo-4) y la columna de la derecha
// con los números de la cuenta y «New ads ready for your review» (adamigo-1). Los nombres, en español y cortos.
// Lo que AdAmigo no tiene y MaKo sí va DENTRO de esos lugares: el producto (el funnel del CRM) de cada acción como una
// etiqueta más, y los números del CRM por producto en la columna de la derecha.
// =============================================================================

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import type { Decision, KpiMediaBuyer } from '@/lib/media-buyer/tipos';
import type { Alerta } from '@/lib/media-buyer/protect';
import { IconoBorrar } from '@/app/_ui/BotonBorrar';
import { TUERCA } from '@/app/_ui/icono-tuerca';
import {
  AGENTE_DE, NOMBRE_AGENTE, cambioDe, hace, impactoEsperado, leerMonto, queHace, verboLanzar,
  type Agente, type ResultadoAplicar,
} from './mb-modelo';
import { fmtDinero } from '@/lib/format';
import { NOMBRE_BOTON } from '@/lib/media-buyer/variacion-boton';

// ── Los íconos de línea (el trazo de AdAmigo, que es el de Lucide) ──
const sv = (d: ReactNode, w = 1.7) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden>{d}</svg>
);
export const Ic = {
  tuerca: () => sv(<path d={TUERCA} />),
  info: () => sv(<><circle cx="12" cy="12" r="9" /><path d="M12 16v-4M12 8h.01" /></>),
  check: () => sv(<path d="M20 6 9 17l-5-5" />, 2),
  checkCirculo: () => sv(<><circle cx="12" cy="12" r="9" /><path d="m8.5 12 2.5 2.5 4.5-5" /></>),
  abajo: () => sv(<path d="m6 9 6 6 6-6" />),
  deshacer: () => sv(<><path d="M9 14 4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 0 10h-3" /></>),
  chispa: () => sv(<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />),
};
const ICONO_AGENTE: Record<Agente, () => ReactNode> = {
  media_buyer: () => sv(<><circle cx="9" cy="20" r="1.2" /><circle cx="18" cy="20" r="1.2" /><path d="M2 3h3l2.6 12.4a2 2 0 0 0 2 1.6h8.8a2 2 0 0 0 2-1.6L22 7H6" /></>),
  protect: () => sv(<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />),
  estratega: () => sv(<><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5z" /></>),
  disenador: () => sv(<><path d="m12 19 7-7 3 3-7 7-3-3z" /><path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" /><path d="m2 2 7.6 7.6" /><circle cx="11" cy="11" r="2" /></>),
  tu: () => sv(<><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>),
};

export function EtiquetaAgente({ d }: { d: Pick<Decision, 'tactica'> }) {
  const a = AGENTE_DE[d.tactica];
  return <span className="aa-agente">{ICONO_AGENTE[a]()}{NOMBRE_AGENTE[a]}</span>;
}

// ── La tarjeta de acción ─────────────────────────────────────────────────────

const fecha = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' });

export function TarjetaAccion({ d, kpi, producto, ocupada, encendido, ajustesHref, onAplicar, onBorrar, onPreguntar, onDeshacer, onReabrir, onCalificar, onHooksAVideo }: {
  d: Decision; kpi: KpiMediaBuyer; producto: string | null; ocupada: boolean; encendido: boolean; ajustesHref: string;
  onAplicar: (extra: { presupuesto?: number; elegidas?: string[]; confirmarBaja?: boolean }) => Promise<ResultadoAplicar>;
  onBorrar: () => void; onPreguntar: () => void; onDeshacer: () => void; onReabrir: () => void;
  onCalificar: (n: number) => void; onHooksAVideo: (elegidas: string[]) => void;
}) {
  const [mas, setMas] = useState(false);
  const [elegidas, setElegidas] = useState<Set<string>>(() => new Set((d.variaciones ?? []).filter((v) => v.elegida).map((v) => v.id)));
  const [editando, setEditando] = useState(false);
  const [montoTxt, setMontoTxt] = useState(d.despues.presupuesto != null ? String(d.despues.presupuesto) : '');
  // Bajar 80% o más se pregunta acá, pegado al botón, con lo que dijo el servidor («Bajarlo de $100 a $15 por día es 85% menos»).
  const [porConfirmar, setPorConfirmar] = useState<string | null>(null);
  const esVar = d.tipo === 'variaciones_texto' || d.tipo === 'variaciones_hook';
  const abierta = d.estado === 'abierta';
  const reintentable = d.estado === 'bloqueada' || d.estado === 'fallida';
  const hecha = d.estado === 'aplicada' || d.estado === 'deshecha';
  const cambio = cambioDe(d);
  const baja = cambio?.pct?.startsWith('-') || d.despues.estado === 'PAUSED';
  const aplicar = (confirmarBaja = false) => {
    const extra: { presupuesto?: number; elegidas?: string[]; confirmarBaja?: boolean } = {};
    if (esVar) extra.elegidas = [...elegidas];
    // «1,500» es mil quinientos, no 1,5 (revisión de tren-l, falla 4): leerMonto, y si no se entiende no se lanza.
    if (editando && montoTxt.trim()) extra.presupuesto = leerMonto(montoTxt) ?? undefined;
    if (confirmarBaja) extra.confirmarBaja = true;
    void onAplicar(extra).then((r) => {
      if (typeof r === 'object') { setPorConfirmar(r.mensaje); return; }
      setPorConfirmar(null);
      if (r) setEditando(false);
    });
  };
  const montoEditado = editando ? leerMonto(montoTxt) : null;
  const estado = d.estado === 'fallida' ? { t: 'No se pudo', tono: 'mal' } : d.estado === 'bloqueada' ? { t: 'Frenada por un tope', tono: 'cuidado' }
    : d.estado === 'vencida' ? { t: 'Vencida', tono: undefined } : d.estado === 'descartada' ? { t: 'Descartada', tono: undefined }
      : d.estado === 'deshecha' ? { t: 'Deshecha', tono: undefined }
        : d.estado === 'aplicada' ? { t: d.origen === 'piloto' ? `Piloto automático · ${hace(d.aplicadaAt)}` : `${d.aplicadaPor ?? 'Tu equipo'} · ${hace(d.aplicadaAt)}`, tono: undefined } : null;

  return (
    <article className="aa-card" id={`accion-${d.id}`}>
      <div className="aa-card-cab">
        <EtiquetaAgente d={d} />
        {producto && <span className="aa-producto" title={`Producto: ${producto}`}>{producto}</span>}
        {estado && <span className="aa-estado" data-tono={estado.tono}>{estado.t}</span>}
      </div>
      <h3>{d.titulo}</h3>
      <div className="aa-fecha">{fecha.format(new Date(d.creada))}</div>
      {cambio && (
        <div className="aa-cambio">
          <span className="a">{cambio.antes}</span><span className="flecha" aria-hidden>→</span><span className="b">{cambio.despues}</span>
          {cambio.pct && <span className="aa-pct" data-baja={baja ? '1' : '0'}>{cambio.pct}</span>}
        </div>
      )}
      <div className="aa-bloque"><h4>Qué</h4><p>{queHace(d)}</p></div>
      <div className="aa-bloque">
        <h4>Por qué</h4>
        <p>{d.titular}.{mas && d.porque.length ? ' ' + d.porque.join(' ') : ''}</p>
        {mas && d.numeros.length > 0 && (
          <table className="aa-nums" style={{ marginTop: 8 }}>
            <tbody>{d.numeros.map((n, i) => <tr key={i}><td>{n.condicion}</td><td>{n.valor}</td></tr>)}</tbody>
          </table>
        )}
      </div>
      {esVar && (
        <div className="aa-bloque">
          <h4>{d.tipo === 'variaciones_hook' ? 'Los ganchos' : 'Los textos'}</h4>
          <div className="aa-vars">
            {/* TODOS los textos a la vista: lo que se tilda es lo que sale (antes se veían 2 y salían 4; tren-l, falla 0). */}
            {(d.variaciones ?? []).map((v) => {
              const on = elegidas.has(v.id);
              return (
                <label key={v.id} className="aa-var" data-on={on ? '1' : '0'}>
                  <input type="checkbox" checked={on} disabled={!abierta}
                    onChange={() => setElegidas((s) => { const n = new Set(s); if (n.has(v.id)) n.delete(v.id); else n.add(v.id); return n; })} />
                  {/* Lo que sale ENTERO: el gancho, el texto y el título del anuncio (el headline también lo escribe la IA). */}
                  {/* La variación de BOTÓN (lib/media-buyer/variacion-boton.ts) es el mismo texto con otro botón: sin decirlo, se ve igual que el original. */}
                  <span>{v.gancho && <b>{v.gancho}</b>}<p>{v.textoPrincipal}</p>{v.titulo && <em className="aa-var-titulo">Título: {v.titulo}</em>}
                    {v.cta && <em className="aa-var-titulo">Botón: {NOMBRE_BOTON[v.cta] ?? v.cta}</em>}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
      <div className="aa-bloque">
        <h4>Impacto esperado</h4>
        <ul className="aa-impacto">{impactoEsperado(d, kpi).map((t) => <li key={t}>{Ic.checkCirculo()}{t}</li>)}</ul>
      </div>
      {(d.porque.length > 0 || d.numeros.length > 0 || (d.variaciones ?? []).length > 2) && (
        <button type="button" className="aa-mas" aria-expanded={mas} onClick={() => setMas((x) => !x)}>{mas ? 'Menos' : 'Más info'}{Ic.abajo()}</button>
      )}
      {editando && d.despues.presupuesto != null && (
        <div className="aa-editar">
          <input inputMode="decimal" value={montoTxt} onChange={(e) => { setMontoTxt(e.target.value); setPorConfirmar(null); }} aria-label="Presupuesto diario nuevo, en la moneda de la cuenta" />
          <span>{d.moneda ?? ''} por día</span>
        </div>
      )}
      {porConfirmar && montoEditado != null ? (
        <div className="aa-pie" aria-live="polite">
          <span className="aa-pie-nota" data-tono="cuidado">{porConfirmar}</span>
          <button type="button" className="aa-sec" disabled={ocupada} onClick={() => setPorConfirmar(null)}>No bajar</button>
          <button type="button" className="aa-aplicar" disabled={ocupada || !encendido} onClick={() => aplicar(true)}>
            {ocupada ? 'Aplicando…' : `Bajar a ${fmtDinero(montoEditado, d.moneda)} por día`}
          </button>
        </div>
      ) : (
      <div className="aa-pie">
        {hecha && (
          <span className="aa-estrellas" aria-label="¿Cuánto sirvió?">
            {[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" data-on={(d.estrellas ?? 0) >= n ? '1' : '0'} title={`${n} de 5`} onClick={() => onCalificar(n)}>★</button>)}
          </span>
        )}
        {!hecha && <span className="aa-pie-nota" data-tono={d.error ? (d.estado === 'bloqueada' ? 'cuidado' : 'mal') : undefined}>{d.error ?? d.nota ?? ''}</span>}
        {(abierta || reintentable) && <button type="button" className="aa-ic" title="Borrar" aria-label="Borrar esta acción" disabled={ocupada} onClick={onBorrar}><IconoBorrar size={16} /></button>}
        {abierta && <Link href={ajustesHref} className="aa-ic" title="Ajustes de esta táctica" aria-label="Ajustes de esta táctica">{Ic.tuerca()}</Link>}
        {abierta && d.despues.presupuesto != null && (
          <button type="button" className="aa-sec" onClick={() => setEditando((x) => !x)}>{editando ? 'Usar el de MaKo' : 'Editar'}</button>
        )}
        {abierta && d.tipo === 'variaciones_hook' && (
          <button type="button" className="aa-sec" disabled={elegidas.size === 0} onClick={() => onHooksAVideo([...elegidas])}>Filmar</button>
        )}
        <button type="button" className="aa-sec" onClick={onPreguntar}>{Ic.info()}Preguntar</button>
        {(abierta || reintentable) && (
          <button type="button" className="aa-aplicar" disabled={ocupada || !encendido || (esVar && elegidas.size === 0) || (editando && montoTxt.trim() !== '' && leerMonto(montoTxt) == null)} onClick={() => aplicar()}>
            {Ic.check()}{ocupada ? 'Aplicando…' : reintentable ? 'Reintentar' : esVar ? verboLanzar(d) : 'Aplicar'}
          </button>
        )}
        {d.estado === 'aplicada' && <button type="button" className="aa-sec" disabled={ocupada} onClick={onDeshacer}>{Ic.deshacer()}Deshacer</button>}
        {(d.estado === 'descartada' || d.estado === 'vencida') && <button type="button" className="aa-sec" disabled={ocupada} onClick={onReabrir}>Volver a abrir</button>}
      </div>
      )}
    </article>
  );
}

/**
 * Protect: lo roto en la cuenta (lib/media-buyer/protect.ts), en la hoja que abre el aviso de Hoy. Con la densidad de Actividad
 * (27/10/2026): una fila por alerta con su punto (rojo si es grave), el título, una línea con el detalle y UN botón,
 * «Preguntar». Antes era una tarjeta por alerta con su ícono en una caja, el borde de color y su encabezado «Protect · N».
 * Sin alertas no se dibuja.
 */
export function AlertasProtect({ alertas, onPreguntar }: { alertas: Alerta[]; onPreguntar: (a: Alerta) => void }) {
  if (!alertas.length) return null;
  return (
    <ul className="aa-act-lista aa-protect" aria-label="Protect">
      {alertas.map((a) => (
        <li key={a.id} data-g={a.gravedad}>
          <span className="aa-punto" aria-hidden />
          <span className="aa-act-txt"><b>{a.titulo}</b><small>{a.detalle}</small></span>
          <button type="button" className="aa-sec" onClick={() => onPreguntar(a)}>Preguntar</button>
        </li>
      ))}
    </ul>
  );
}

/** Lo que no está en ninguna pestaña: una línea, nunca una caja vacía. */
export function Nada({ children }: { children: ReactNode }) {
  return <p className="aa-nada">{Ic.chispa()}{children}</p>;
}


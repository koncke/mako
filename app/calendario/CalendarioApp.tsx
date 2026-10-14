'use client';

// =============================================================================
// CalendarioApp — la tab Calendario: la semana o el mes, con sus cinco capas
// =============================================================================
// Martín: «que sea simple de usar, que sirva para todos los casos... y que no sea restrictivo». De arriba abajo:
//   · la barra: ‹ Hoy ›, el rango, Semana | Mes, las CAPAS (Publicaciones, Llamadas, Bloques, Plan, Objetivos: cada
//     una con su color y su interruptor) y «＋ Nuevo»;
//   · la grilla: siete columnas de lunes a domingo; cada renglón con su color de capa. Lo de día completo arriba,
//     lo demás por hora. Un clic en el hueco de un día crea ahí; un clic en algo propio lo abre; lo de afuera lleva
//     a donde vive (la ficha del lead, la tarjeta del Plan, /general).
//
// Lo que no se ve en la firma:
//   · LA VISTA Y LA FECHA VIAJAN EN LA URL (`?vista=&fecha=`) y las LEE EL SERVER: el link que se copia es lo que
//     se ve, y cambiar de semana trae lo de esa semana. Se navega con el router de la casa (preserva el `?ws=`).
//   · LAS CAPAS PRENDIDAS SON UNA PREFERENCIA DEL NAVEGADOR (localStorage, con try/catch): no deciden nada que se
//     guarde, sólo qué se dibuja. Sin la clave, todas prendidas.
//   · «NO PUDE LEER» SE DICE, una línea por fuente (`fallos`): un calendario vacío sobre una lectura caída diría
//     que la semana está libre.
//   · DESPUÉS DE ESCRIBIR, `router.refresh()`: lo que cambia es un dato de esta pantalla. Borrar deja el «Deshacer»
//     en un toast que vive acá (no en el modal, que se desmonta), y vuelve a poner la MISMA fila.

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import Link, { useRouter } from '@/app/_ui/Link';
import { Toast, useToast } from '@/app/_ui';
import { Button } from '@/app/_ui/Button';
import { IconoMenu } from '@/app/_ui/iconos-menu';
import {
  CAPAS_CALENDARIO, DIAS_CORTOS, colorDeCapa, filtrarPorCapas, horaDe, itemsPorDia, moverFecha, rotuloDeRango,
  lunesDe, diaDe, ROTULO_FORMATO,
  type CapaCalendario, type ItemCalendario, type VistaCalendario, type EntradaEvento, type PlantillaCalendario,
} from '@/lib/calendario-modelo';
import type { FallosCalendario } from '@/lib/calendario';
import { crearEventosAction, cambiarEventoAction, marcarEventoAction, borrarEventoAction, restaurarEventoAction } from './actions';
import { EventoModal, ICONO_FORMATO, ICONO_TIPO, type EventoEditable } from './EventoModal';
import { NuevoEnCalendario } from './NuevoEnCalendario';

const CLAVE_CAPAS = 'calendario.capas';

/** Cuántos renglones se ven por día en el mes antes de «+N más». */
const EN_EL_MES = 3;

type Abierto =
  | { t: 'nuevo' }
  | { t: 'evento'; inicial: EventoEditable }
  | null;

export function CalendarioApp({ vista, fecha, hoy, tz, dias, items, fallos, pendienteOnboarding }: {
  vista: VistaCalendario;
  fecha: string;
  hoy: string;
  tz: string;
  dias: string[];
  items: ItemCalendario[];
  fallos: FallosCalendario;
  /** El onboarding de la tab no está hecho: se abre «Nuevo» la primera vez (es la primera semana). */
  pendienteOnboarding: boolean;
}) {
  const router = useRouter();
  const [prendidas, setPrendidas] = useState<Set<CapaCalendario>>(() => new Set(CAPAS_CALENDARIO.map((c) => c.id)));
  const [abierto, setAbierto] = useState<Abierto>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast, show, clear } = useToast(5000);

  // La preferencia de capas: se lee al montar (nunca pisa una decisión: no hay otra fuente de esto).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CLAVE_CAPAS);
      if (!raw) return;
      const ids = JSON.parse(raw);
      if (Array.isArray(ids)) {
        const validas = ids.filter((x): x is CapaCalendario => CAPAS_CALENDARIO.some((c) => c.id === x));
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPrendidas(new Set(validas));
      }
    } catch { /* sin almacenamiento: todas prendidas */ }
  }, []);
  // La primera vez (onboarding pendiente) se abre la galería: armar la primera semana ES el onboarding.
  useEffect(() => {
    if (!pendienteOnboarding) return;
    try { if (window.sessionStorage.getItem('calendario.bienvenida')) return; window.sessionStorage.setItem('calendario.bienvenida', '1'); } catch { /* igual se abre */ }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAbierto({ t: 'nuevo' });
  }, [pendienteOnboarding]);

  const alternarCapa = (c: CapaCalendario) => {
    setPrendidas((p) => {
      const n = new Set(p);
      if (n.has(c)) n.delete(c); else n.add(c);
      try { window.localStorage.setItem(CLAVE_CAPAS, JSON.stringify([...n])); } catch { /* preferencia: no pasa nada */ }
      return n;
    });
  };

  const ir = useCallback((v: VistaCalendario, f: string) => router.push(`/calendario?vista=${v}&fecha=${f}`), [router]);
  const visibles = useMemo(() => filtrarPorCapas(items, prendidas), [items, prendidas]);
  const porDia = useMemo(() => itemsPorDia(visibles, dias, tz), [visibles, dias, tz]);
  const lunes = lunesDe(vista === 'semana' ? fecha : (dias.includes(hoy) ? hoy : fecha));

  // ── Escrituras ──
  const crear = async (entradas: EntradaEvento[], origen: 'user' | 'plantilla' | 'ia', mensaje: string): Promise<boolean> => {
    setGuardando(true); setError(null);
    try {
      const r = await crearEventosAction(entradas, origen);
      if (!r.ok) { setError(r.error); show(r.error, undefined, 'bad'); return false; }
      setAbierto(null);
      const ids = r.ids;
      show(mensaje, origen === 'user' ? undefined : () => { void deshacerLote(ids); });
      router.refresh();
      return true;
    } catch {
      show('Sin conexión', undefined, 'bad');
      return false;
    } finally { setGuardando(false); }
  };
  const deshacerLote = async (ids: string[]) => {
    try { for (const id of ids) await borrarEventoAction(id); router.refresh(); }
    catch { show('No se pudo deshacer', undefined, 'bad'); }
  };

  const guardarEvento = async (inicial: EventoEditable, e: EntradaEvento) => {
    if (!inicial.id) { await crear([e], 'user', 'Agendado'); return; }
    setGuardando(true); setError(null);
    try {
      const r = await cambiarEventoAction(inicial.id, e);
      if (!r.ok) { setError(r.error); return; }
      setAbierto(null);
      show('Guardado');
      router.refresh();
    } catch { setError('Sin conexión. Prueba de nuevo.'); }
    finally { setGuardando(false); }
  };

  const borrar = async (id: string) => {
    setGuardando(true);
    try {
      const b = await borrarEventoAction(id);
      setAbierto(null);
      show('Borrado', b ? () => { void restaurarEventoAction(b).then(() => router.refresh()).catch(() => show('No se pudo deshacer', undefined, 'bad')); } : undefined);
      router.refresh();
    } catch { show('No se pudo borrar', undefined, 'bad'); }
    finally { setGuardando(false); }
  };

  const marcar = async (id: string, hecho: boolean) => {
    try { await marcarEventoAction(id, hecho); setAbierto(null); show(hecho ? 'Hecho' : 'Pendiente'); router.refresh(); }
    catch { show('No se pudo guardar', undefined, 'bad'); }
  };

  /** Abrir lo propio para editarlo; lo de afuera navega (es un Link). */
  const abrirPropio = (it: ItemCalendario) => {
    if (it.fuente !== 'propio' || !it.tipo) return;
    setError(null);
    setAbierto({
      t: 'evento',
      inicial: {
        id: it.id.replace(/^propio:/, ''), titulo: it.titulo, tipo: it.tipo, formato: it.formato ?? null,
        fecha: diaDe(it.inicio, tz), hora: it.diaCompleto ? null : horaDe(it.inicio, tz),
        duracionMin: it.fin ? Math.round((Date.parse(it.fin) - Date.parse(it.inicio)) / 60_000) : null,
        notas: it.notas ?? '', hecho: it.hecho,
      },
    });
  };
  const nuevoEn = (dia: string) => { setError(null); setAbierto({ t: 'evento', inicial: { titulo: '', tipo: 'publicacion', formato: 'reel', fecha: dia, hora: '10:00', duracionMin: null } }); };

  const avisos = lineasDeFallo(fallos);

  return (
    <div data-calendario="" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {toast && <Toast state={toast} onClose={clear} />}

      {/* La barra */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <button type="button" aria-label={vista === 'semana' ? 'Semana anterior' : 'Mes anterior'} style={FLECHA} onClick={() => ir(vista, moverFecha(vista, fecha, -1))}>‹</button>
          <Button variant="secondary" size="sm" onClick={() => ir(vista, hoy)}>Hoy</Button>
          <button type="button" aria-label={vista === 'semana' ? 'Semana siguiente' : 'Mes siguiente'} style={FLECHA} onClick={() => ir(vista, moverFecha(vista, fecha, 1))}>›</button>
        </div>
        <span data-rango="" style={{ fontSize: 20, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.01em', textTransform: 'capitalize' }}>{rotuloDeRango(vista, fecha)}</span>
        <div role="tablist" aria-label="Vista" style={{ display: 'inline-flex', padding: 3, borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)', marginLeft: 'auto' }}>
          {(['semana', 'mes'] as const).map((v) => (
            <button key={v} type="button" role="tab" aria-selected={vista === v} onClick={() => ir(v, fecha)}
              style={{ padding: '6px 14px', borderRadius: 8, border: 'none', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', background: vista === v ? 'var(--surface)' : 'transparent', color: vista === v ? 'var(--ink)' : 'var(--dim)', boxShadow: vista === v ? '0 1px 3px color-mix(in srgb, var(--ink) 12%, transparent)' : 'none' }}>
              {v === 'semana' ? 'Semana' : 'Mes'}
            </button>
          ))}
        </div>
        <Button variant="primary" size="sm" onClick={() => { setError(null); setAbierto({ t: 'nuevo' }); }}>＋ Nuevo</Button>
      </div>

      {/* Las capas: el color de cada una y su interruptor. */}
      <div role="group" aria-label="Qué se ve" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {CAPAS_CALENDARIO.map((c) => {
          const on = prendidas.has(c.id);
          return (
            <button key={c.id} type="button" aria-pressed={on} data-capa={c.id} onClick={() => alternarCapa(c.id)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 32, padding: '0 12px', borderRadius: 999, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${on ? 'var(--border-strong)' : 'var(--border)'}`, background: on ? 'var(--surface)' : 'transparent', color: on ? 'var(--ink)' : 'var(--faint)' }}>
              <span aria-hidden style={{ width: 9, height: 9, borderRadius: '50%', background: c.color, opacity: on ? 1 : 0.3 }} />
              {c.nombre}
            </button>
          );
        })}
      </div>

      {avisos.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {avisos.map((a) => (
            <span key={a.texto} style={{ fontSize: 13, color: a.tono === 'dim' ? 'var(--dim)' : 'var(--warn)' }}>
              {a.texto}{a.href && <> · <Link href={a.href} style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>{a.link}</Link></>}
            </span>
          ))}
        </div>
      )}

      {vista === 'semana'
        ? <Semana dias={dias} porDia={porDia} hoy={hoy} tz={tz} onNuevo={nuevoEn} onAbrir={abrirPropio} />
        : <Mes dias={dias} porDia={porDia} hoy={hoy} tz={tz} mes={fecha.slice(0, 7)} onNuevo={nuevoEn} onAbrir={abrirPropio} onVerSemana={(d) => ir('semana', d)} />}

      {abierto?.t === 'nuevo' && (
        <NuevoEnCalendario lunes={lunes} guardando={guardando} onCerrar={() => setAbierto(null)}
          onBlanco={() => nuevoEn(dias.includes(hoy) ? hoy : lunes)}
          onPlantilla={(p: PlantillaCalendario, entradas) => { void crear(entradas, 'plantilla', `${p.nombre}: ${entradas.length} agendados`); }}
          onConfirmarIA={(entradas, aviso) => { void crear(entradas, 'ia', aviso ?? (entradas.length === 1 ? '1 agendado' : `${entradas.length} agendados`)); }} />
      )}
      {abierto?.t === 'evento' && (
        <EventoModal inicial={abierto.inicial} guardando={guardando} error={error}
          onCerrar={() => setAbierto(null)}
          onGuardar={(e) => { void guardarEvento(abierto.inicial, e); }}
          onBorrar={abierto.inicial.id ? () => { void borrar(abierto.inicial.id!); } : undefined}
          onHecho={abierto.inicial.id ? (h) => { void marcar(abierto.inicial.id!, h); } : undefined} />
      )}
    </div>
  );
}

/** Una línea por fuente que no se pudo leer (y la de Google sin conectar, en gris, con su link). */
function lineasDeFallo(f: FallosCalendario): Array<{ texto: string; tono: 'warn' | 'dim'; href?: string; link?: string }> {
  const out: Array<{ texto: string; tono: 'warn' | 'dim'; href?: string; link?: string }> = [];
  if (f.propios) out.push({ texto: 'No pude leer tus eventos.', tono: 'warn' });
  if (f.crm) out.push({ texto: 'No pude leer las reuniones del CRM.', tono: 'warn' });
  if (f.google === 'error') out.push({ texto: 'No pude leer tu agenda de Google.', tono: 'warn' });
  if (f.google === 'sin-conexion') out.push({ texto: 'Tu agenda de Google no está conectada.', tono: 'dim', href: '/integraciones', link: 'Conectar' });
  if (f.plan) out.push({ texto: 'No pude leer los deadlines del Plan.', tono: 'warn' });
  if (f.objetivos) out.push({ texto: 'No pude leer los objetivos.', tono: 'warn' });
  return out;
}

// ── La semana ─────────────────────────────────────────────────────────────────────────────────

function Semana({ dias, porDia, hoy, tz, onNuevo, onAbrir }: {
  dias: string[]; porDia: Map<string, ItemCalendario[]>; hoy: string; tz: string;
  onNuevo: (dia: string) => void; onAbrir: (it: ItemCalendario) => void;
}) {
  return (
    <div data-semana="" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
      {dias.map((d, i) => {
        const es = d === hoy;
        const lista = porDia.get(d) ?? [];
        return (
          <section key={d} data-dia={d} style={{ display: 'flex', flexDirection: 'column', minHeight: 260, background: 'var(--surface)', border: `1px solid ${es ? 'var(--primary)' : 'var(--border)'}`, borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '10px 12px 8px', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: es ? 'var(--primary)' : 'var(--dim)' }}>{DIAS_CORTOS[i]}</span>
              <span style={{ fontSize: 22, fontWeight: 600, color: es ? 'var(--primary)' : 'var(--ink)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{Number(d.slice(8, 10))}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 8 }}>
              {lista.map((it) => <Renglon key={it.id} it={it} tz={tz} onAbrir={onAbrir} />)}
            </div>
            {/* El hueco del día: crear ahí. Un botón de verdad (teclado y lector), que ocupa lo que queda. */}
            <button type="button" aria-label={`Nuevo evento el ${d}`} onClick={() => onNuevo(d)} className="cal-hueco"
              style={{ flex: 1, minHeight: 40, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--faint)', fontSize: 18, fontFamily: 'inherit' }}>
              <span aria-hidden className="cal-mas">＋</span>
            </button>
          </section>
        );
      })}
      <style>{`.cal-hueco .cal-mas{opacity:0;transition:opacity .12s}.cal-hueco:hover .cal-mas,.cal-hueco:focus-visible .cal-mas{opacity:1}`}</style>
    </div>
  );
}

// ── El mes ────────────────────────────────────────────────────────────────────────────────────

function Mes({ dias, porDia, hoy, tz, mes, onNuevo, onAbrir, onVerSemana }: {
  dias: string[]; porDia: Map<string, ItemCalendario[]>; hoy: string; tz: string; mes: string;
  onNuevo: (dia: string) => void; onAbrir: (it: ItemCalendario) => void; onVerSemana: (dia: string) => void;
}) {
  return (
    <div data-mes="" style={{ overflowX: 'auto' }} className="mk-scroll-x">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(110px, 1fr))', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', background: 'var(--surface)', minWidth: 770 }}>
        {DIAS_CORTOS.map((n) => (
          <div key={n} style={{ padding: '8px 10px', fontSize: 12.5, fontWeight: 600, color: 'var(--dim)', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>{n}</div>
        ))}
        {dias.map((d, i) => {
          const lista = porDia.get(d) ?? [];
          const fuera = d.slice(0, 7) !== mes;
          const es = d === hoy;
          return (
            <div key={d} data-dia={d} style={{ minHeight: 112, padding: 6, display: 'flex', flexDirection: 'column', gap: 4, borderTop: i < 7 ? 'none' : '1px solid var(--border)', borderLeft: i % 7 === 0 ? 'none' : '1px solid var(--border)', background: fuera ? 'var(--surface-2)' : 'var(--surface)' }}>
              <button type="button" onClick={() => onNuevo(d)} aria-label={`Nuevo evento el ${d}`}
                style={{ alignSelf: 'flex-start', border: 'none', background: es ? 'var(--primary)' : 'transparent', color: es ? '#fff' : fuera ? 'var(--faint)' : 'var(--ink)', borderRadius: 999, minWidth: 26, height: 26, padding: '0 6px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontVariantNumeric: 'tabular-nums' }}>
                {Number(d.slice(8, 10))}
              </button>
              {lista.slice(0, EN_EL_MES).map((it) => <Renglon key={it.id} it={it} tz={tz} onAbrir={onAbrir} compacto />)}
              {lista.length > EN_EL_MES && (
                <button type="button" onClick={() => onVerSemana(d)} style={{ alignSelf: 'flex-start', border: 'none', background: 'none', padding: '0 4px', color: 'var(--primary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  +{lista.length - EN_EL_MES} más
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Un renglón ────────────────────────────────────────────────────────────────────────────────

function Renglon({ it, tz, onAbrir, compacto = false }: { it: ItemCalendario; tz: string; onAbrir: (it: ItemCalendario) => void; compacto?: boolean }) {
  const color = colorDeCapa(it.capa);
  const icono = it.formato ? ICONO_FORMATO[it.formato] : it.tipo ? ICONO_TIPO[it.tipo] : null;
  const contenido = (
    <>
      <span aria-hidden style={{ flex: 'none', width: 3, alignSelf: 'stretch', borderRadius: 2, background: color }} />
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: compacto ? 12 : 13, color: it.hecho ? 'var(--faint)' : 'var(--ink)', fontWeight: 500, textDecoration: it.hecho ? 'line-through' : 'none', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
          {!it.diaCompleto && <span style={{ flex: 'none', color: 'var(--dim)', fontVariantNumeric: 'tabular-nums' }}>{horaDe(it.inicio, tz)}</span>}
          {icono && !compacto && <span aria-hidden style={{ flex: 'none', display: 'inline-flex', color: 'var(--dim)' }}><IconoMenu nombre={icono} size={13} /></span>}
          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.titulo}</span>
        </span>
        {!compacto && it.detalle && <span style={{ fontSize: 11.5, color: 'var(--dim)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{it.detalle}</span>}
      </span>
    </>
  );
  const estilo: CSSProperties = {
    display: 'flex', alignItems: 'stretch', gap: 7, padding: compacto ? '3px 5px' : '6px 7px', borderRadius: 8, textAlign: 'left',
    background: `color-mix(in srgb, ${color} 9%, var(--surface))`, border: 'none', textDecoration: 'none', cursor: 'pointer', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box',
  };
  const titulo = [it.titulo, it.detalle, it.formato ? ROTULO_FORMATO[it.formato] : null].filter(Boolean).join(' · ');
  if (it.fuente === 'propio') return <button type="button" data-item={it.id} title={titulo} style={estilo} onClick={() => onAbrir(it)}>{contenido}</button>;
  if (it.href) return <Link href={it.href} data-item={it.id} title={titulo} style={estilo}>{contenido}</Link>;
  return <div data-item={it.id} title={titulo} style={{ ...estilo, cursor: 'default' }}>{contenido}</div>;
}

const FLECHA: CSSProperties = {
  width: 32, height: 32, display: 'grid', placeItems: 'center', borderRadius: 9, border: '1px solid var(--border-strong)',
  background: 'var(--surface)', color: 'var(--ink)', fontSize: 18, lineHeight: 1, cursor: 'pointer', fontFamily: 'inherit',
};

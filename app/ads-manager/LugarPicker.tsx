'use client';

// =============================================================================
// LugarPicker — dónde está la gente, con los mismos lugares que acepta Meta
// =============================================================================
// Lo usan el paso 'lugar' de NuevaCampanaModal (grande), AgregarConjuntoModal
// (compacto) y EditarPublicoModal (compacto, sobre los lugares de un conjunto que ya
// corre: ahí aparecen pines y radios que esta pantalla no crea). Un buscador contra `search?type=adgeolocation` (país, provincia,
// ciudad, código postal, barrio, localidad, partido, DMA) + dirección con radio,
// cada lugar para INCLUIR o EXCLUIR, radio en ciudades y direcciones, y el alcance
// de Meta en vivo — que además VALIDA: si Meta rechaza la combinación, lo dice acá
// y el paso no avanza, en vez de enterarse al publicar. Las reglas medidas viven
// en lib/meta-geo.ts.
// =============================================================================

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Dropdown } from '../components/Dropdown';
import {
  ETIQUETA_TIPO, RADIOS_CIUDAD_KM, RADIOS_DIRECCION_KM,
  agregarLugar, cambiarRadio, claveFila, geoSpecDe, lugarDireccion, mismoLugar, nombrePais, quitarLugar, rotuloRadio, type LugarMeta,
} from '@/lib/meta-geo';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

type Alcance =
  | { estado: 'nada' }
  | { estado: 'midiendo' }
  | { estado: 'ok'; min: number | null; max: number | null; frase: string | null }
  | { estado: 'rechazado'; mensaje: string }
  // No pude PREGUNTAR (403, red): no es lo mismo que "Meta dijo que no", y no bloquea.
  | { estado: 'sin-medir'; mensaje: string };

const fmtPersonas = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toLocaleString('es-MX', { maximumFractionDigits: 1 })} M`
    : n >= 1_000 ? `${Math.round(n / 1_000).toLocaleString('es-MX')} mil`
      : n.toLocaleString('es-MX');

function contexto(l: LugarMeta): string {
  const partes = [l.tipo === 'zip' ? l.ciudad : null, l.region, l.pais && l.tipo !== 'country' ? nombrePais(l.pais) : null].filter(Boolean);
  return partes.length ? ` · ${partes.join(', ')}` : '';
}

// Una dirección tiene calle Y número. Así «C1425» (un CP) no se ofrece como calle.
const pareceDireccion = (t: string) => t.length >= 6 && /\d/.test(t) && /[A-Za-zÁÉÍÓÚáéíóúñÑ]{3,}/.test(t);

// Las opciones del radio, con el valor ACTUAL adentro aunque no esté en la lista (la regla
// del <select> de AGENTS.md). Hasta la #715 no hacía falta: los lugares nacían acá y el
// radio salía de esta misma lista. Un conjunto que ya corre trae los suyos —12, 8 y 16 km
// en los pines medidos el 07/10, o millas—, y sin esto el desplegable mostraba
// «Seleccionar…» sobre un radio guardado, y el primer clic escribía otro.
// Con el «(actual)» el rótulo es más largo: el desplegable se ensancha sólo en ese caso
// (en la creación nunca aparece, y ahí el ancho queda como estaba).
const fueraDeLista = (base: readonly number[], l: LugarMeta) => !!l.radioKm && !base.includes(l.radioKm);
function opcionesRadio(base: readonly number[], l: LugarMeta, cero?: string) {
  const ops = [...(cero ? [{ value: '0', label: cero }] : []), ...base.map((km) => ({ value: String(km), label: `+${km} km` }))];
  if (fueraDeLista(base, l)) {
    ops.push({ value: String(l.radioKm), label: `${rotuloRadio(l)} (actual)` });
    ops.sort((a, b) => Number(a.value) - Number(b.value));
  }
  return ops;
}

export function LugarPicker({ lugares, setLugares, sugerido, onValidez, compacto = false }: {
  lugares: LugarMeta[];
  setLugares: (l: LugarMeta[]) => void;
  /** ISO-2 del país de la cuenta: sus resultados van primero. */
  sugerido: string | null;
  /** true = Meta lo acepta · false = Meta lo rechaza · null = midiendo o no se pudo medir. Pasar un setState (estable). */
  onValidez?: (v: boolean | null) => void;
  compacto?: boolean;
}) {
  const [q, setQ] = useState('');
  const [modo, setModo] = useState<'incluir' | 'excluir'>('incluir');
  const [resultados, setResultados] = useState<LugarMeta[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [errBusqueda, setErrBusqueda] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [alcance, setAlcance] = useState<Alcance>({ estado: 'nada' });
  const busRef = useRef(0);
  const alcRef = useRef(0);

  // ── búsqueda (con debounce; el token descarta respuestas viejas) ──
  useEffect(() => {
    const t = q.trim();
    setErrBusqueda(null);
    if (t.length < 2) { busRef.current++; setResultados(null); setBuscando(false); return; }
    const id = ++busRef.current;
    const timer = setTimeout(async () => {
      setBuscando(true);
      try {
        // `pais`: el server busca también DENTRO del país de la cuenta y lo pone
        // primero. «Córdoba» es Argentina, Colombia, España y México, y la búsqueda
        // mundial sola ni siquiera trae la Provincia de Córdoba (ordenarLugares).
        const r = await fetch(`/api/ads-manager/targeting?kind=lugares&q=${encodeURIComponent(t)}${sugerido ? `&pais=${sugerido}` : ''}`, { cache: 'no-store' });
        const j = await r.json();
        if (busRef.current !== id) return;
        if (j.ok && Array.isArray(j.items)) {
          setResultados(j.items as LugarMeta[]);
        } else {
          // «No pude preguntar» no es «no hay»: se dice el porqué, no una lista vacía.
          setResultados([]);
          setErrBusqueda(`No pude buscar en Meta: ${j.error || 'error desconocido'}`);
        }
      } catch (e) {
        if (busRef.current === id) { setResultados([]); setErrBusqueda(`No pude buscar en Meta: ${String(e)}`); }
      } finally {
        if (busRef.current === id) setBuscando(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [q, sugerido]);

  // ── alcance + validación en vivo ──
  const firma = JSON.stringify(geoSpecDe(lugares));
  const hayIncluidos = lugares.some((l) => !l.excluir);
  useEffect(() => {
    if (!hayIncluidos) { alcRef.current++; setAlcance({ estado: 'nada' }); onValidez?.(null); return; }
    const id = ++alcRef.current;
    setAlcance({ estado: 'midiendo' });
    onValidez?.(null);
    const timer = setTimeout(async () => {
      try {
        const r = await fetch(`/api/ads-manager/targeting?kind=alcance&geo=${encodeURIComponent(firma)}`, { cache: 'no-store' });
        const j = await r.json();
        if (alcRef.current !== id) return;
        if (j.ok && j.alcance) { setAlcance({ estado: 'ok', min: j.alcance.min ?? null, max: j.alcance.max ?? null, frase: j.alcance.frase ?? null }); onValidez?.(true); }
        else if (j.rechazoGeo) { setAlcance({ estado: 'rechazado', mensaje: String(j.error) }); onValidez?.(false); }
        else { setAlcance({ estado: 'sin-medir', mensaje: String(j.error || 'error desconocido') }); onValidez?.(null); }
      } catch (e) {
        if (alcRef.current === id) { setAlcance({ estado: 'sin-medir', mensaje: String(e) }); onValidez?.(null); }
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [firma, hayIncluidos, onValidez]);

  function sumar(l: LugarMeta) {
    const nuevo: LugarMeta = { ...l, excluir: modo === 'excluir' };
    const { lista, quitados, ensancha } = agregarLugar(lugares, nuevo);
    setLugares(lista);
    setQ(''); setResultados(null);
    const nombres = quitados.map((x) => x.nombre).join(', ');
    setAviso(!quitados.length ? null
      : ensancha ? `Quité ${nombres}: ya queda adentro de ${nuevo.nombre}.`
        : `Quité ${nombres}: ${nuevo.nombre} está adentro, y Meta no deja incluir los dos. Si querías todo ${nombres} menos una parte, búscala en «Excluir».`);
  }
  // Por FILA (lugar y lado), no por lugar: un conjunto leído de Meta puede traer el mismo
  // pin incluido y excluido (la dona), y por lugar tocar uno tocaba los dos (lib/meta-geo.ts).
  const quitar = (l: LugarMeta) => { setLugares(quitarLugar(lugares, l)); setAviso(null); };
  const setRadio = (l: LugarMeta, km: number | null) => setLugares(cambiarRadio(lugares, l, km));

  const fs = compacto ? { titulo: 14, sub: 11, input: 14 } : { titulo: 15.5, sub: 11.5, input: 16 };
  const alinear = compacto ? 'left' : 'center';
  const pill = (on: boolean, color: 'primary' | 'bad'): CSSProperties => ({
    padding: compacto ? '5px 12px' : '7px 15px', borderRadius: 999, fontFamily: SANS, fontSize: compacto ? 12.5 : 13.5, cursor: 'pointer',
    border: `1px solid ${on ? `var(--${color})` : 'var(--border-strong)'}`,
    background: on ? (color === 'bad' ? 'var(--bad-bg)' : 'rgba(47,111,237,.10)') : 'var(--surface)',
    color: on ? (color === 'bad' ? 'var(--bad)' : 'var(--primary-strong)') : 'var(--dim)',
  });
  const textoBusqueda = q.trim();
  const ofrecerDireccion = pareceDireccion(textoBusqueda);

  return (
    <div style={{ width: '100%', maxWidth: compacto ? undefined : 500, display: 'flex', flexDirection: 'column', gap: compacto ? 10 : 14, alignSelf: 'center' }}>
      {/* buscador */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', gap: 6, justifyContent: compacto ? 'flex-start' : 'center' }}>
          <button type="button" onClick={() => setModo('incluir')} style={pill(modo === 'incluir', 'primary')}>Incluir</button>
          <button type="button" onClick={() => setModo('excluir')} style={pill(modo === 'excluir', 'bad')}>Excluir</button>
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} autoFocus={!compacto}
          placeholder={modo === 'excluir' ? 'Buscar un lugar para excluir…' : 'País, provincia, ciudad, barrio, código postal o dirección'}
          style={{ width: '100%', boxSizing: 'border-box', padding: compacto ? '11px 13px' : '14px 16px', borderRadius: 13, border: `1px solid ${modo === 'excluir' ? 'var(--bad)' : 'var(--border-strong)'}`, background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: SANS, fontSize: fs.input, outline: 'none', textAlign: alinear }} />
      </div>

      {/* resultados */}
      {textoBusqueda.length >= 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: compacto ? 200 : 240, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 12, padding: 4, background: 'var(--surface)' }}>
          {buscando && resultados === null && <div style={{ padding: '10px 12px', fontSize: 13, color: 'var(--faint)' }}>Buscando en Meta…</div>}
          {errBusqueda && <div style={{ padding: '10px 12px', fontSize: 13, color: 'var(--bad)' }}>{errBusqueda}</div>}
          {resultados?.map((l) => {
            const ya = lugares.some((x) => mismoLugar(x, l));
            return (
              <button key={`${l.tipo}:${l.key}`} type="button" disabled={ya} onClick={() => sumar(l)}
                onMouseEnter={(e) => { if (!ya) e.currentTarget.style.background = 'var(--surface-2)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                style={{ textAlign: 'left', padding: '9px 12px', borderRadius: 9, border: 'none', background: 'transparent', cursor: ya ? 'default' : 'pointer', opacity: ya ? 0.45 : 1 }}>
                <div style={{ fontFamily: SANS, fontSize: fs.titulo - 1, color: 'var(--ink)', fontWeight: 500 }}>{l.nombre}</div>
                <div style={{ fontFamily: MONO, fontSize: fs.sub, color: 'var(--faint)' }}>{ETIQUETA_TIPO[l.tipo]}{contexto(l)}{ya ? ' · ya está' : ''}</div>
              </button>
            );
          })}
          {ofrecerDireccion && (
            <button type="button" onClick={() => sumar(lugarDireccion(textoBusqueda))}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-2)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              style={{ textAlign: 'left', padding: '9px 12px', borderRadius: 9, border: 'none', background: 'transparent', cursor: 'pointer' }}>
              <div style={{ fontFamily: SANS, fontSize: fs.titulo - 1, color: 'var(--ink)', fontWeight: 500 }}>Usar «{textoBusqueda}» como dirección</div>
              <div style={{ fontFamily: MONO, fontSize: fs.sub, color: 'var(--faint)' }}>Dirección · con un radio alrededor</div>
            </button>
          )}
          {resultados !== null && !buscando && !errBusqueda && resultados.length === 0 && !ofrecerDireccion && (
            <div style={{ padding: '10px 12px', fontSize: 13, color: 'var(--dim)' }}>Meta no encontró lugares con «{textoBusqueda}».</div>
          )}
        </div>
      )}

      {aviso && <div style={{ fontSize: 12.5, color: 'var(--dim)', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '9px 12px', lineHeight: 1.45 }}>{aviso}</div>}

      {/* elegidos */}
      {lugares.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {lugares.map((l) => (
            <div key={claveFila(l)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: compacto ? '8px 10px 8px 12px' : '10px 12px 10px 15px', borderRadius: 13, border: `1px solid ${l.excluir ? 'var(--bad)' : 'var(--border-strong)'}`, background: l.excluir ? 'var(--bad-bg)' : 'var(--surface-2)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: SANS, fontSize: fs.titulo, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.nombre}</div>
                <div style={{ fontFamily: MONO, fontSize: fs.sub, color: l.excluir ? 'var(--bad)' : 'var(--faint)' }}>{l.excluir ? 'Excluido · ' : ''}{ETIQUETA_TIPO[l.tipo]}{contexto(l)}</div>
              </div>
              {l.tipo === 'city' && (
                <Dropdown value={String(l.radioKm ?? 0)} width={fueraDeLista(RADIOS_CIUDAD_KM, l) ? '175px' : '140px'}
                  options={opcionesRadio(RADIOS_CIUDAD_KM, l, 'Solo la ciudad')}
                  onChange={(v) => setRadio(l, Number(v) || null)} />
              )}
              {/* El pin lleva el radio de la dirección: Meta les pone el mismo piso (1 km). */}
              {(l.tipo === 'address' || l.tipo === 'pin') && (
                <Dropdown value={String(l.radioKm ?? 5)} width={fueraDeLista(RADIOS_DIRECCION_KM, l) ? '175px' : '110px'}
                  options={opcionesRadio(RADIOS_DIRECCION_KM, l)}
                  onChange={(v) => setRadio(l, Number(v))} />
              )}
              <button type="button" aria-label={`Quitar ${l.nombre}`} onClick={() => quitar(l)}
                style={{ width: 28, height: 28, flex: 'none', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 13, cursor: 'pointer' }}>✕</button>
            </div>
          ))}
        </div>
      )}

      {/* alcance (y validación) de Meta */}
      {!hayIncluidos && lugares.length > 0 && (
        <p style={{ fontSize: 12.5, color: 'var(--warn)', margin: 0, textAlign: alinear }}>Solo hay lugares excluidos: incluye al menos uno.</p>
      )}
      {!lugares.length && (
        <p style={{ fontSize: 12.5, color: 'var(--warn)', margin: 0, textAlign: alinear }}>Elige al menos un lugar: es donde Meta va a mostrar los anuncios.</p>
      )}
      {alcance.estado === 'midiendo' && <p style={{ fontFamily: MONO, fontSize: 12, color: 'var(--faint)', margin: 0, textAlign: alinear }}>Midiendo el alcance en Meta…</p>}
      {alcance.estado === 'ok' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: compacto ? 'flex-start' : 'center' }}>
          {alcance.max === 0
            ? <span style={{ fontSize: 13, color: 'var(--warn)' }}>Meta calcula 0 personas para estos lugares.</span>
            : alcance.min != null && alcance.max != null && <span style={{ fontFamily: MONO, fontSize: 12.5, color: 'var(--dim)' }}>≈ {fmtPersonas(alcance.min)} – {fmtPersonas(alcance.max)} personas</span>}
          {/* Un pin son coordenadas: la frase de Meta es lo único que dice DÓNDE cae. */}
          {lugares.some((l) => l.tipo === 'address' || l.tipo === 'pin') && alcance.frase && (
            <span style={{ fontSize: 12, color: 'var(--faint)', textAlign: alinear, lineHeight: 1.4 }}>Meta lo ubicó así: {alcance.frase}</span>
          )}
        </div>
      )}
      {alcance.estado === 'rechazado' && (
        <div style={{ fontSize: 13, color: 'var(--bad)', background: 'var(--bad-bg)', border: '1px solid var(--bad)', borderRadius: 10, padding: '10px 12px', lineHeight: 1.45 }}>{alcance.mensaje}</div>
      )}
      {alcance.estado === 'sin-medir' && (
        <p style={{ fontSize: 12, color: 'var(--faint)', margin: 0, textAlign: alinear }}>No pude medir el alcance en Meta ({alcance.mensaje}). Puedes seguir igual.</p>
      )}
    </div>
  );
}

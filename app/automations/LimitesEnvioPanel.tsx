'use client';

// =============================================================================
// LimitesEnvioPanel — los LÍMITES de las automatizaciones (Automations › Configuraciones › Límites)
// =============================================================================
// Décima tanda (11/10/2026, GENERAL 4), textual: «configuraciones sobre todo para limitaciones de todos los
// flujos, si estoy prospectando en frio con esto, que se tenga en cuenta las configuraciones que en su
// momento tuvimos en cuenta, como que no se envien más de X cantidad de mensajes... Que todo eso sea
// configurable.»
//
// Tres bloques —WhatsApp, Email y «MaKo contesta sola»— con un número y sus flechas por límite, rótulos de
// 1-3 palabras, la línea de uso («24 h: 6 de 40») y «Restaurar» (vuelve todo a lo de fábrica). Las reglas, los
// rangos y lo de fábrica viven en lib/limites-envio.ts; esto sólo los dibuja.
//
// ⚠️ SE GUARDA SOLO, CADA CAMBIO, como el horario de oficina (HorarioEnvioPanel: «elimina el botón de
// guardar, si se hace un cambio ya se debe quedar guardado»). Lo que está fuera de rango NO se guarda: se
// dice al lado y lo de antes sigue mandando. Mientras un guardado está en vuelo el panel está «sucio»
// (`onSucio`): el modal de Configuraciones no se cierra hasta que termina.
//
// ⚠️ SÓLO UN ADMIN EDITA (`puedeEditar` sale del server, y guardar lo vuelve a exigir). El setter lo ve.

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Icon } from '@/app/_components/icons';
import { Spinner } from '@/app/_ui';
import { getLimitesEnvioAction, saveLimitesEnvioAction } from '@/app/configuraciones/limites-actions';
import { BLOQUES_LIMITES, conLimite, difiereDeFabrica, leerLimite, leerNumero, lineaDeUso, rangoDe, type LimitesEnvio, type UsoDelCupo } from '@/lib/limites-envio';

const SANS = "'Geist', sans-serif";
const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 18 };

type Grupo = keyof LimitesEnvio;
type Uso = UsoDelCupo | null;

/** El número con sus dos flechas. Las flechas no pasan del rango; lo escrito a mano se valida al salir. */
function Numero({ valor, min, max, disabled, etiqueta, onCambio, onInvalido }: {
  valor: number; min: number; max: number; disabled: boolean; etiqueta: string;
  onCambio: (n: number) => void; onInvalido: (error: string | null) => void;
}) {
  const [texto, setTexto] = useState(String(valor));
  // Lo guardado cambió por otro lado («Restaurar», la lectura): el campo lo sigue.
  const [visto, setVisto] = useState(valor);
  if (visto !== valor) { setVisto(valor); setTexto(String(valor)); }
  const escribir = (t: string) => {
    setTexto(t);
    const r = leerNumero(t, min, max);
    if (r.ok) { onInvalido(null); onCambio(r.n); } else onInvalido(r.error);
  };
  const flecha = (d: 1 | -1) => {
    const n = Math.min(max, Math.max(min, valor + d));
    setTexto(String(n)); onInvalido(null);
    if (n !== valor) onCambio(n);
  };
  const btn: CSSProperties = {
    width: 22, height: 15, padding: 0, border: 'none', background: 'transparent', color: 'var(--dim)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: disabled ? 'default' : 'pointer',
  };
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid var(--border-strong)', borderRadius: 10, background: 'var(--surface)', height: 34, boxSizing: 'border-box', overflow: 'hidden' }}>
      <input value={texto} disabled={disabled} inputMode="numeric" aria-label={etiqueta}
        onChange={(e) => escribir(e.target.value.replace(/[^\d]/g, ''))}
        onKeyDown={(e) => { if (e.key === 'ArrowUp') { e.preventDefault(); flecha(1); } else if (e.key === 'ArrowDown') { e.preventDefault(); flecha(-1); } }}
        style={{ width: 52, height: '100%', border: 'none', outline: 'none', background: 'transparent', textAlign: 'center', fontFamily: SANS, fontSize: 14.5, fontWeight: 600, color: 'var(--ink)' }} />
      <div style={{ display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--border)' }}>
        <button type="button" aria-label={`Subir ${etiqueta}`} disabled={disabled || valor >= max} onClick={() => flecha(1)} style={btn}>
          <span style={{ display: 'flex', transform: 'rotate(180deg)' }}><Icon name="chevron" size={13} /></span>
        </button>
        <button type="button" aria-label={`Bajar ${etiqueta}`} disabled={disabled || valor <= min} onClick={() => flecha(-1)} style={{ ...btn, borderTop: '1px solid var(--border)' }}>
          <Icon name="chevron" size={13} />
        </button>
      </div>
    </div>
  );
}

/** `onSucio`: hay un guardado en vuelo (el modal no se cierra mientras tanto). */
export function LimitesEnvioPanel({ onSucio }: { onSucio?: (sucio: boolean) => void }) {
  const [l, setL] = useState<LimitesEnvio | null>(null);
  const [fabrica, setFabrica] = useState<LimitesEnvio | null>(null);
  const [uso, setUso] = useState<Uso>(null);
  const [puedeEditar, setPuedeEditar] = useState(false);
  const [aviso, setAviso] = useState('');
  /** Los campos escritos a mano que no valen, por `grupo.campo`: mientras haya uno, no se guarda nada. */
  const [invalidos, setInvalidos] = useState<Record<string, string>>({});
  const [enVuelo, setEnVuelo] = useState(false);
  /** Sube con «Restaurar»: los números vuelven a leer lo guardado aunque tuvieran algo escrito que no valía. */
  const [vuelta, setVuelta] = useState(0);
  const respiro = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pedido = useRef(0);

  useEffect(() => {
    let vivo = true;
    getLimitesEnvioAction()
      .then((d) => { if (!vivo) return; setL(d.limites); setFabrica(d.fabrica); setUso(d.uso); setPuedeEditar(d.puedeEditar); })
      .catch(() => { if (vivo) setAviso('No pude leer los límites.'); });
    return () => { vivo = false; if (respiro.current) clearTimeout(respiro.current); };
  }, []);

  // ⚠️ ANTES DEL `return` de abajo (AGENTS.md: ningún hook detrás de un return temprano).
  useEffect(() => { onSucio?.(enVuelo); }, [enVuelo, onSucio]);

  if (!l || !fabrica) return aviso ? <p role="alert" style={{ fontSize: 13.5, color: 'var(--bad)', fontFamily: SANS }}>{aviso}</p> : <Spinner />;

  /** Cada cambio se GUARDA, con un respiro: tres flechas seguidas son un guardado, no tres. */
  const guardar = (nuevo: LimitesEnvio) => {
    setL(nuevo);
    setAviso('');
    if (respiro.current) clearTimeout(respiro.current);
    setEnVuelo(true);
    const n = ++pedido.current;
    respiro.current = setTimeout(() => {
      void saveLimitesEnvioAction(nuevo)
        .catch(() => ({ ok: false, error: 'No se pudo guardar.' } as const))
        .then((r) => {
          if (n !== pedido.current) return;
          setEnVuelo(false);
          if (!r.ok) { setAviso(r.error || 'No se pudo guardar.'); return; }
          if ('limites' in r && r.limites) setL(r.limites);
        });
    }, 350);
  };
  const cambiar = (grupo: Grupo, campo: string, n: number) => {
    if (Object.keys(invalidos).some((k) => k !== `${grupo}.${campo}`)) { setL(conLimite(l, grupo, campo, n)); return; }
    guardar(conLimite(l, grupo, campo, n));
  };
  const marcarInvalido = (clave: string, error: string | null) => setInvalidos((prev) => {
    if (!error) { if (!(clave in prev)) return prev; const { [clave]: _, ...resto } = prev; void _; return resto; }
    return prev[clave] === error ? prev : { ...prev, [clave]: error };
  });

  const off = !puedeEditar;
  return (
    <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 16, fontFamily: SANS }}>
      {BLOQUES_LIMITES.map((b, i) => {
        const usoTxt = lineaDeUso(b.titulo, uso, l);
        return (
          <section key={b.titulo} aria-label={b.titulo} style={{ display: 'flex', flexDirection: 'column', gap: 10, ...(i ? { borderTop: '1px solid var(--border)', paddingTop: 14 } : null) }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{b.titulo}</span>
              {usoTxt && <span data-uso style={{ fontSize: 12.5, color: 'var(--dim)' }}>{usoTxt}</span>}
            </div>
            {b.filas.map((f) => {
              const clave = `${f.grupo}.${f.campo}`;
              const [min, max] = rangoDe(f.grupo, f.campo);
              return (
                <div key={clave} title={f.ayuda} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ flex: '1 1 120px', minWidth: 0, fontSize: 14, color: 'var(--ink)' }}>{f.rotulo}</span>
                  <Numero key={`${clave}:${vuelta}`} valor={leerLimite(l, f.grupo, f.campo)} min={min} max={max} disabled={off} etiqueta={`${b.titulo} · ${f.rotulo}`}
                    onCambio={(n) => cambiar(f.grupo, f.campo, n)} onInvalido={(e) => marcarInvalido(clave, e)} />
                  <span style={{ flex: '0 0 64px', fontSize: 13, color: 'var(--dim)' }}>{f.unidad}</span>
                  {invalidos[clave] && <span role="alert" style={{ flexBasis: '100%', fontSize: 12.5, color: 'var(--bad)' }}>{invalidos[clave]}</span>}
                </div>
              );
            })}
          </section>
        );
      })}
      {(aviso || (!off && difiereDeFabrica(l, fabrica))) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <span role={aviso ? 'alert' : undefined} style={{ fontSize: 13, color: 'var(--bad)' }}>{aviso}</span>
          {!off && difiereDeFabrica(l, fabrica) && (
            <button type="button" onClick={() => { setInvalidos({}); setVuelta((v) => v + 1); guardar(fabrica); }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', background: 'transparent', padding: 0, fontFamily: SANS, fontSize: 13, fontWeight: 600, color: 'var(--primary)', cursor: 'pointer' }}>
              Restaurar
            </button>
          )}
        </div>
      )}
    </div>
  );
}

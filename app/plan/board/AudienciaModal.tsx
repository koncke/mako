'use client';

// =============================================================================
// AudienciaModal — pedirle al Perro un número, y que te lo pueda negar
// =============================================================================
// Reemplaza al camino de score de `ProyectoDebateModal` y `DebateModal`. Lo que cambia,
// y las tres cosas se ven en la pantalla:
//
//  1. LA EXIGENCIA SE VE ANTES DE ARGUMENTAR. Apenas movés el slider, abajo aparece qué
//     hace falta para pedir ESE número. En el flujo viejo el dueño escribía un párrafo, lo
//     mandaba, esperaba, y recién ahí se enteraba de que no alcanzaba. Peor: casi nunca se
//     enteraba, porque el Perro cedía.
//  2. EL BOTÓN QUEDA APAGADO HASTA QUE LA CARGA ESTÁ CUMPLIDA. Ese es el rechazo más
//     frecuente y no lo hace el modelo: cuesta cero tokens, es instantáneo, y no se puede
//     negociar porque no hay nadie del otro lado a quien insistirle.
//  3. ACEPTAR MUESTRA LA CASCADA ANTES DE ESCRIBIR. El tablero no tiene huecos, así que
//     subir uno corre a todos los de abajo. Cuántos se mueven se lee antes del click.
//
// ⚠️ La exigencia se calcula ACÁ y OTRA VEZ en el server, con la misma función. No es
// duplicación: el navegador la dibuja, el server la hace cumplir. Un gate que solo vive en
// la UI es un botón escondido, y el que decide siempre es el server.
// =============================================================================

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { WizardShell } from '@/app/_components/WizardShell';
import { GuardianIcon } from './GuardianIcon';
import { textareaStyle } from './guardian-form';
import { exigenciaDe, cumpleLaCarga, NOMBRE_CLASE, type ClasePrueba, type Prueba } from '@/lib/plan-prueba';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

type Item = { id: string; titulo: string; score: number; emoji?: string };
type Movimiento = { id: string; nombre: string; antes: number; despues: number };
type Resultado = {
  estado: 'falta-prueba' | 'rechazado' | 'propuesto' | 'error';
  reprioId?: string; veredicto?: string; scoreActual: number; scoreFinal?: number;
  razon?: string; respuesta?: string; repregunta?: string; falta?: string;
  preguntas?: Array<{ pregunta: string; opciones: string[] }>;
  cascada?: Movimiento[]; error?: string; usage?: unknown;
};

const api = async (body: Record<string, unknown>): Promise<Record<string, unknown>> =>
  fetch('/api/mako-guardian', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    .then((r) => r.json()).catch((e) => ({ ok: false, error: String(e) }));

const BANDA = (s: number) => (s >= 75 ? 'Alta' : s >= 50 ? 'Media' : s >= 25 ? 'Baja' : 'A futuro');
const chip: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 999, fontSize: 12.5, fontFamily: MONO, border: '1px solid var(--border)' };

export function AudienciaModal({ entidad, item, otros, tareas, onAplicado, onUsage, onClose }: {
  entidad: 'proyecto' | 'tarea';
  item: Item;
  /** los del MISMO nivel, para comparar y para elegir como prueba */
  otros: Item[];
  /** las tareas abiertas, para nombrar una como prueba desde un proyecto */
  tareas: Item[];
  onAplicado: (movidos: number) => void;
  onUsage?: (u: unknown) => void;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const [pedido, setPedido] = useState(item.score);
  const [motivo, setMotivo] = useState('');
  const [pruebas, setPruebas] = useState<Prueba[]>([]);
  const [clientes, setClientes] = useState<Array<{ id: string; nombre: string; etapa: string }>>([]);
  const [fase, setFase] = useState<'form' | 'pensando' | 'veredicto' | 'aplicando'>('form');
  const [res, setRes] = useState<Resultado | null>(null);
  const [err, setErr] = useState('');

  const topes = useMemo(() => otros.slice().sort((a, b) => b.score - a.score), [otros]);
  const esNorteHoy = topes.length > 0 && item.score > topes[0].score;
  const ex = useMemo(() => exigenciaDe(entidad, item.score, pedido, esNorteHoy), [entidad, item.score, pedido, esNorteHoy]);
  const carga = useMemo(() => cumpleLaCarga(ex, pruebas), [ex, pruebas]);
  // Las clases que esta exigencia acepta, aplanadas: son las pestañas del selector.
  const clases = useMemo(() => [...new Set(ex.clases.flat())], [ex]);

  useEffect(() => {
    if (clases.includes('cliente') && !clientes.length) {
      api({ action: 'reprio-clientes' }).then((j) => { if (Array.isArray(j.clientes)) setClientes(j.clientes as typeof clientes); });
    }
  }, [clases, clientes.length]);

  const togglePrueba = (clase: ClasePrueba, ref: string, etiqueta: string) =>
    setPruebas((s) => (s.some((p) => p.clase === clase && p.ref === ref) ? s.filter((p) => !(p.clase === clase && p.ref === ref)) : [...s, { clase, ref, etiqueta }]));

  const preguntar = async () => {
    setFase('pensando'); setErr('');
    const j = await api({
      action: 'reprio-proponer',
      pedido: { entidad, itemId: item.id, scorePedido: pedido, motivo, pruebas: pruebas.map((p) => ({ clase: p.clase, ref: p.ref })), respuestas: [] },
    });
    if (j.usage) onUsage?.(j.usage);
    if (j.estado === 'error' || (!j.ok && !j.estado)) { setErr(String(j.error || 'MaKo no pudo responder ahora.')); setFase('form'); return; }
    setRes(j as unknown as Resultado); setFase('veredicto');
  };

  const aplicar = async () => {
    if (!res?.reprioId) return;
    setFase('aplicando');
    const j = await api({ action: 'reprio-aplicar', reprioId: res.reprioId });
    if (!j.ok) { setErr(String(j.error || 'No se pudo aplicar.')); setFase('veredicto'); return; }
    onAplicado(Number(j.movidos) || 0);
    onClose();
  };

  // ── el veredicto ───────────────────────────────────────────────────────────────────
  if (fase === 'veredicto' || fase === 'aplicando') {
    const gano = res?.estado === 'propuesto';
    const mueve = res?.cascada?.length ?? 0;
    const otrosMovidos = Math.max(0, mueve - 1);
    return (
      <WizardShell
        titulo={`MaKo · ${entidad === 'proyecto' ? 'prioridad del proyecto' : 'prioridad de la tarea'}`}
        pasos={['Veredicto']} pasoActual="Veredicto"
        pregunta={gano ? (res?.veredicto === 'acepta' ? 'Tienes razón.' : 'Te doy una parte.') : 'No te lo doy.'}
        sub={gano ? `${item.titulo} · ${res?.scoreActual} → ${res?.scoreFinal}` : `${item.titulo} · queda en ${res?.scoreActual}`}
        error={err || null}
        puedeAvanzar enUltimo
        confirmLabel={gano ? `Aplicar ${res?.scoreFinal}${otrosMovidos ? ` y correr ${otrosMovidos} más` : ''} →` : 'Entendido, lo dejo →'}
        pending={fase === 'aplicando'}
        hideAtras atrasLabel=""
        onAtras={() => undefined}
        onSiguiente={() => undefined}
        onConfirmar={gano ? aplicar : onClose}
        onClose={onClose}
      >
        <div style={{ display: 'grid', gap: 14 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px' }}>
            <GuardianIcon size={26} />
            <div style={{ fontSize: 14.5, lineHeight: 1.6, color: 'var(--ink)' }}>{res?.respuesta}</div>
          </div>

          {res?.razon && (
            <div style={{ fontSize: 13.5, lineHeight: 1.55, color: 'var(--dim)', borderLeft: '3px solid var(--mako-ink, var(--primary))', paddingLeft: 12 }}>{res.razon}</div>
          )}

          {/* La salida que deja un «no»: la UNA cosa que le haría cambiar de opinión. Sin
              esto el mismo pedido vuelve mañana con las mismas palabras. */}
          {res?.repregunta && (
            <div style={{ background: 'var(--warn-bg, var(--surface-2))', border: '1px solid var(--warn, var(--border-strong))', borderRadius: 12, padding: '13px 15px' }}>
              <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 6 }}>Lo que me haría cambiar de opinión</div>
              <div style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--ink)' }}>{res.repregunta}</div>
            </div>
          )}

          {/* Lo que falta, cuando ni siquiera llegó a preguntarle: acá no gastó un token. */}
          {res?.estado === 'falta-prueba' && (
            <div style={{ fontSize: 13.5, color: 'var(--dim)' }}>{res.falta}</div>
          )}

          {/* LA CASCADA, ANTES DE ESCRIBIRLA. La consecuencia de lo irreversible va pegada
              al botón y en tinta normal, no arriba de todo y en gris. */}
          {gano && mueve > 0 && (
            <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '10px 14px', background: 'var(--surface-2)', fontSize: 13, color: 'var(--ink)', borderBottom: '1px solid var(--border)' }}>
                Esto mueve <b>{mueve}</b> {entidad === 'proyecto' ? 'proyectos' : 'tareas'}. El orden entre {otrosMovidos > 1 ? 'ellos' : 'los demás'} no cambia: se corren para hacerle lugar.
              </div>
              <div className="mk-scroll-x" style={{ maxHeight: 190, overflowY: 'auto' }}>
                {res?.cascada?.map((m) => (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '8px 14px', borderBottom: '1px solid var(--border)', fontSize: 13, background: m.id === item.id ? 'var(--surface-2)' : 'transparent' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: m.id === item.id ? 700 : 400, color: 'var(--ink)' }}>{m.nombre}</span>
                    <span style={{ fontFamily: MONO, fontSize: 12.5, color: 'var(--dim)', flex: 'none' }}>{m.antes} → <b style={{ color: 'var(--ink)' }}>{m.despues}</b></span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </WizardShell>
    );
  }

  // ── el formulario ──────────────────────────────────────────────────────────────────
  const pasos = ['A cuánto', ...(clases.length ? ['Con qué'] : []), 'Por qué'];
  const enUltimo = idx === pasos.length - 1;
  const paso = pasos[idx];

  const cuerpo = paso === 'A cuánto' ? (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 12 }}>
        <span style={{ fontFamily: MONO, fontSize: 44, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-.02em' }}>{pedido}</span>
        <span style={{ fontSize: 14, color: 'var(--faint)' }}>hoy en {item.score} · {BANDA(pedido)}</span>
      </div>
      <input type="range" min={1} max={100} value={pedido} onChange={(e) => setPedido(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--primary)' }} />
      {/* LA EXIGENCIA, EN VIVO. Es la pieza: el precio se ve antes de pagar, no después. */}
      <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '13px 15px' }}>
        <GuardianIcon size={22} />
        <div style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--ink)' }}>{ex.texto}</div>
      </div>
      {topes.length > 0 && (
        <div style={{ fontSize: 12.5, color: 'var(--faint)', textAlign: 'center' }}>
          Con {pedido} quedaría {pedido > topes[0].score ? 'arriba de todo' : `entre «${topes.filter((t) => t.score > pedido).slice(-1)[0]?.titulo ?? '—'}» y «${topes.find((t) => t.score < pedido)?.titulo ?? '—'}»`}
        </div>
      )}
    </div>
  ) : paso === 'Con qué' ? (
    <div style={{ display: 'grid', gap: 14 }}>
      {pruebas.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
          {pruebas.map((p) => (
            <button key={`${p.clase}:${p.ref}`} onClick={() => togglePrueba(p.clase, p.ref, p.etiqueta)}
              style={{ ...chip, cursor: 'pointer', background: 'var(--primary)', borderColor: 'var(--primary)', color: '#fff' }}>
              {p.etiqueta} <span style={{ opacity: .7 }}>✕</span>
            </button>
          ))}
        </div>
      )}
      {clases.includes('proyecto') && (
        <Selector titulo="¿Cuál deja de ser lo primero?" opciones={otros.slice().sort((a, b) => b.score - a.score).slice(0, 8).map((o) => ({ ref: o.id, etiqueta: o.titulo, nota: `${o.score}` }))}
          activos={pruebas} clase="proyecto" onPick={togglePrueba} />
      )}
      {clases.includes('tarea') && tareas.length > 0 && (
        <Selector titulo="¿Qué tarea se destraba con esto?" opciones={tareas.slice(0, 8).map((o) => ({ ref: o.id, etiqueta: o.titulo, nota: `${o.score}` }))}
          activos={pruebas} clase="tarea" onPick={togglePrueba} />
      )}
      {clases.includes('cliente') && (
        <Selector titulo="¿Qué cliente está esperando esto?" opciones={clientes.slice(0, 12).map((c) => ({ ref: c.id, etiqueta: c.nombre, nota: c.etapa }))}
          activos={pruebas} clase="cliente" onPick={togglePrueba} vacio="No hay clientes cargados todavía." />
      )}
      {clases.includes('fecha') && (
        <Campo titulo="¿Hay una fecha comprometida con alguien de afuera?" tipo="date"
          valor={pruebas.find((p) => p.clase === 'fecha')?.ref ?? ''}
          onSet={(v) => setPruebas((s) => [...s.filter((p) => p.clase !== 'fecha'), ...(v ? [{ clase: 'fecha' as const, ref: v, etiqueta: v }] : [])])} />
      )}
      {clases.includes('plata') && (
        <Campo titulo="¿Cuánta plata hay atada a esto? (US$)" tipo="number" placeholder="3500"
          valor={pruebas.find((p) => p.clase === 'plata')?.ref ?? ''}
          onSet={(v) => setPruebas((s) => [...s.filter((p) => p.clase !== 'plata'), ...(v ? [{ clase: 'plata' as const, ref: v, etiqueta: `US$ ${v}` }] : [])])} />
      )}
      {!carga.ok && <div style={{ fontSize: 13, color: 'var(--faint)' }}>Falta: {carga.detalle}</div>}
    </div>
  ) : (
    <div style={{ display: 'grid', gap: 10 }}>
      <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} autoFocus rows={5}
        placeholder={pedido < item.score ? 'Por qué puede esperar…' : 'Qué pasa si esto no se hace…'} style={textareaStyle} />
      <div style={{ fontSize: 12.5, color: 'var(--faint)', lineHeight: 1.55 }}>
        MaKo lee esto contra {otros.length} {entidad === 'proyecto' ? 'proyectos' : 'tareas'} más y decide. Puede decirte que no.
      </div>
    </div>
  );

  return (
    <WizardShell
      titulo={`MaKo · ${item.titulo.slice(0, 40)}`}
      pasos={pasos} pasoActual={paso}
      pregunta={paso === 'A cuánto' ? '¿A cuánto lo quieres?' : paso === 'Con qué' ? '¿Con qué lo sostienes?' : '¿Por qué?'}
      sub={paso === 'Con qué' ? 'Elígelo de la lista: un nombre escrito a mano no prueba nada.' : undefined}
      error={err || null}
      puedeAvanzar={paso === 'A cuánto' ? pedido !== item.score : paso === 'Con qué' ? carga.ok : motivo.trim().length >= 10}
      enUltimo={enUltimo}
      confirmLabel="Que decida MaKo →"
      pending={fase === 'pensando'}
      cargando={fase === 'pensando' ? 'MaKo lo está pensando…' : null}
      atrasLabel={idx === 0 ? 'Cancelar' : 'Atrás'}
      onAtras={() => setIdx((i) => Math.max(0, i - 1))}
      onSiguiente={() => setIdx((i) => i + 1)}
      onConfirmar={preguntar}
      onClose={onClose}
    >
      {cuerpo}
    </WizardShell>
  );
}

// ── piezas ───────────────────────────────────────────────────────────────────────────

function Selector({ titulo, opciones, activos, clase, onPick, vacio }: {
  titulo: string; opciones: Array<{ ref: string; etiqueta: string; nota?: string }>;
  activos: Prueba[]; clase: ClasePrueba; onPick: (c: ClasePrueba, ref: string, et: string) => void; vacio?: string;
}) {
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>{titulo}</div>
      {opciones.length === 0 ? <div style={{ fontSize: 13, color: 'var(--faint)' }}>{vacio ?? 'No hay de dónde elegir.'}</div> : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
          {opciones.map((o) => {
            const on = activos.some((p) => p.clase === clase && p.ref === o.ref);
            return (
              <button key={o.ref} onClick={() => onPick(clase, o.ref, o.etiqueta)} style={{
                ...chip, cursor: 'pointer', fontFamily: SANS, maxWidth: '100%',
                background: on ? 'var(--primary)' : 'var(--surface)', color: on ? '#fff' : 'var(--ink)',
                borderColor: on ? 'var(--primary)' : 'var(--border-strong)',
              }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 240 }}>{o.etiqueta}</span>
                {o.nota && <span style={{ opacity: .6, fontFamily: MONO, fontSize: 11 }}>{o.nota}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Campo({ titulo, tipo, valor, onSet, placeholder }: { titulo: string; tipo: string; valor: string; onSet: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>{titulo}</div>
      <input type={tipo} value={valor} placeholder={placeholder} onChange={(e) => onSet(e.target.value)}
        style={{ width: '100%', padding: '10px 13px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 14.5, outline: 'none', fontFamily: SANS }} />
    </div>
  );
}

/** Los nombres de clase, para que el catálogo viva en un solo lado también en la UI. */
export { NOMBRE_CLASE };

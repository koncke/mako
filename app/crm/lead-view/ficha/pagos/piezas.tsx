'use client';

// =============================================================================
// ficha/pagos/piezas — lo que comparten los bloques de Pagos: la tarjeta y los modales de cobro a mano
// =============================================================================
// Los modales vienen de DealDetailsCard (app/crm/[id]/DealDetailsCard.tsx), con dos cosas que allá no tenían:
//   · LA MONEDA (decisión 7: la moneda va por negocio y cada pago guarda la suya). Allá decía «Monto (USD)» y nada
//     más. Acá el valor inicial es la moneda del negocio (`useMonedaDelNegocio`); en otra que no sea USD se pide
//     también cuánto es en dólares, que es lo que suman el Dashboard y la cobranza (lib/pagos-campo.ts,
//     `pagoEnMoneda`: nunca una tasa inventada). Para una cuota, el valor en dólares por defecto es el de la cuota.
//   · EL MÉTODO (transferencia, efectivo…), que el server guarda desde el 14/10 y ninguna pantalla preguntaba.
// Lo que NO cambia y fijan los tests: un pago de menos pregunta qué pasa con la diferencia (queda pendiente o es
// descuento) y, sólo sin diferencia, se puede deshacer (tests/pagos-diferencia.test.ts).
//
// ⚠️ Los modales se dibujan con `Modal` (app/_ui) `anidada`: en el pop-up la ficha es un modal y tiene que verse
//    detrás. Y el clic no sube: el fondo de la ficha en modal la cierra (CobrarConLink hace lo mismo).
// =============================================================================

import { useRef, useState, useTransition, type CSSProperties, type ReactNode } from 'react';
import { Button, Field, Input, Modal, Status } from '@/app/_ui';
import type { Tono as TonoUi } from '@/app/_ui/tokens';
import type { Tono } from '@/lib/cobrado-lead';
import type { Pago } from '@/lib/pagos';
import { METODOS_PAGO, ROTULO_METODO, nombreCuota, type MetodoPago } from '@/lib/pagos-campo';
import { fmtDDMMYYYY } from '@/lib/date-utils';
import { usd } from '@/lib/pagos-vistazo';
import { marcarPagoManualAction, registrarPagoSueltoAction } from '@/app/crm/[id]/deal-actions';

export const SANS = "'Geist', sans-serif";
export const MONO = "'Geist Mono', monospace";

/** El tono de lib/cobrado-lead.ts en el de la casa (app/_ui/tokens). */
export const TONO_UI: Readonly<Record<Tono, TonoUi>> = { verde: 'good', ambar: 'warn', rojo: 'bad', gris: 'neutral' };

export const tarjeta: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 };
export const rotulo: CSSProperties = { fontFamily: MONO, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' };
export const nada: CSSProperties = { margin: 0, fontSize: 13.5, color: 'var(--faint)' };

/** La caja de un bloque: su rótulo, lo que va a la derecha del rótulo (el botón del bloque) y el cuerpo. */
export function Tarjeta({ titulo, derecha, marca, children, style }: { titulo: string; derecha?: ReactNode; marca?: string; children: ReactNode; style?: CSSProperties }) {
  return (
    <section style={{ ...tarjeta, ...style }} data-recorrido={marca}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', minHeight: 30 }}>
        <span style={rotulo}>{titulo}</span>
        {derecha}
      </div>
      {children}
    </section>
  );
}

/** Un aviso dentro de un bloque: una línea con su color, que pide que alguien haga algo. */
export function Aviso({ tono, children }: { tono: 'rojo' | 'ambar' | 'verde'; children: ReactNode }) {
  const c = tono === 'rojo' ? { bg: 'var(--bad-bg)', ink: 'var(--bad)' } : tono === 'ambar' ? { bg: 'var(--warn-bg)', ink: 'var(--warn)' } : { bg: 'var(--good-bg)', ink: 'var(--good)' };
  return <div role={tono === 'rojo' ? 'alert' : 'status'} style={{ borderRadius: 11, padding: '10px 14px', fontSize: 13.5, lineHeight: 1.5, fontWeight: 600, background: c.bg, color: c.ink }}>{children}</div>;
}

export function Semaforo({ tono, children }: { tono: Tono; children: ReactNode }) {
  return <Status tono={TONO_UI[tono]}>{children}</Status>;
}

const hoyISO = (): string => new Date().toISOString().slice(0, 10);
const horaAhora = (): string => new Date().toTimeString().slice(0, 5);
const numero = (s: string): number | null => {
  const n = Number(String(s).replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
};
const msg = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/** El modal de la casa, sin que el clic suba a la ficha en modal (que se cerraría). */
function Caja({ titulo, onCerrar, pie, children, ancho = 460 }: { titulo: string; onCerrar: () => void; pie?: ReactNode; children: ReactNode; ancho?: number }) {
  return (
    <div onClick={(e) => e.stopPropagation()}>
      <Modal titulo={titulo} onCerrar={onCerrar} pie={pie} ancho={ancho} anidada>{children}</Modal>
    </div>
  );
}

/**
 * La moneda y el monto de un pago a mano. `monto` es lo que se cobró EN ESA moneda; `usd`, cuánto es en dólares
 * (sólo si la moneda no es USD). `usdPorDefecto`: para una cuota, su valor; vacío, se cobra eso.
 */
type Plata = { moneda: string; monto: string; usd: string };

function CamposDePlata({ plata, set, monedaNegocio, usdPorDefecto }: { plata: Plata; set: (p: Plata) => void; monedaNegocio: string; usdPorDefecto: number | null }) {
  const monedas = [...new Set(['USD', monedaNegocio.toUpperCase()])];
  const enOtra = plata.moneda !== 'USD';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {monedas.length > 1 && (
        <div role="group" aria-label="Moneda" style={{ display: 'flex', gap: 6 }}>
          {monedas.map((m) => (
            <Button key={m} size="sm" variant={plata.moneda === m ? 'primary' : 'secondary'} onClick={() => set({ ...plata, moneda: m })}>{m}</Button>
          ))}
        </div>
      )}
      <Field label={`Monto (${plata.moneda})`}>
        <Input type="number" inputMode="decimal" min={0} step="0.01" value={plata.monto} onChange={(e) => set({ ...plata, monto: e.target.value })} />
      </Field>
      {enOtra && (
        <Field label="Cuánto es en dólares" hint={usdPorDefecto != null ? `Vacío, ${usd(usdPorDefecto)} (el de la cuota). Es lo que suma a tus reportes.` : 'Es lo que suma a tus reportes.'}>
          <Input type="number" inputMode="decimal" min={0} step="0.01" value={plata.usd} placeholder={usdPorDefecto != null ? String(usdPorDefecto) : 'US$'} onChange={(e) => set({ ...plata, usd: e.target.value })} />
        </Field>
      )}
    </div>
  );
}

/** Lo que va al server desde los campos de plata: `monto` SIEMPRE en dólares (lib/pagos.ts, `cobrarCuota`). */
function plataParaServer(p: Plata, usdPorDefecto: number | null): { ok: true; monto: number | null; moneda: string | null; montoOriginal: number | null } | { ok: false; error: string } {
  const monto = numero(p.monto);
  if (p.moneda === 'USD') return monto == null ? { ok: false, error: 'Falta el monto.' } : { ok: true, monto, moneda: null, montoOriginal: null };
  if (monto == null) return { ok: false, error: `Falta cuánto se cobró en ${p.moneda}.` };
  const dolares = numero(p.usd) ?? usdPorDefecto;
  if (dolares == null) return { ok: false, error: '¿Cuánto es en dólares? Hace falta para tus reportes.' };
  return { ok: true, monto: dolares, moneda: p.moneda, montoOriginal: monto };
}

function CamposDeCuando({ fecha, hora, metodo, setFecha, setHora, setMetodo }: {
  fecha: string; hora: string; metodo: MetodoPago | ''; setFecha: (v: string) => void; setHora: (v: string) => void; setMetodo: (v: MetodoPago | '') => void;
}) {
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
        <Field label="Fecha"><Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></Field>
        <Field label="Hora"><Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} /></Field>
      </div>
      <div role="group" aria-label="Cómo pagó" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {METODOS_PAGO.map((m) => (
          <Button key={m} size="sm" variant={metodo === m ? 'primary' : 'secondary'} onClick={() => setMetodo(metodo === m ? '' : m)}>{ROTULO_METODO[m]}</Button>
        ))}
      </div>
    </>
  );
}

/**
 * «Marcar pagada» una cuota: con el comprobante (la IA lee monto, fecha y hora) o a mano.
 * ⚠️ UN PAGO DE MENOS PREGUNTA QUÉ PASA CON LA DIFERENCIA (Mauricio, 13/10/2026): queda pendiente (el default: el
 * cliente la sigue debiendo) o es un descuento. Con CUALQUIER diferencia no hay Deshacer: desmarcar dejaría viva la
 * cuota nueva de la diferencia, o la cuota con el monto cobrado en vez del suyo.
 */
export function MarcarPagada({ cuota, leadId, monedaNegocio, onCerrar, onHecho }: {
  cuota: Pago; leadId: number; monedaNegocio: string; onCerrar: () => void;
  /** `deshacer`: la cuota quedó pagada entera y se puede volver atrás. */
  onHecho: (mensaje: string, deshacer: boolean) => void;
}) {
  const nombre = nombreCuota(cuota.numero);
  const valorUsd = Number(cuota.monto_usd);
  const [paso, setPaso] = useState<'elegir' | 'datos'>('elegir');
  const [leyendo, setLeyendo] = useState(false);
  const [leido, setLeido] = useState<string | null>(null);
  const [plata, setPlata] = useState<Plata>({ moneda: 'USD', monto: String(valorUsd), usd: '' });
  const [fecha, setFecha] = useState(hoyISO());
  const [hora, setHora] = useState(horaAhora());
  const [metodo, setMetodo] = useState<MetodoPago | ''>('');
  const [resto, setResto] = useState<'pendiente' | 'descuento'>('pendiente');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const archivo = useRef<HTMLInputElement | null>(null);

  const subir = async (file: File) => {
    setError(null); setLeyendo(true);
    try {
      const fd = new FormData(); fd.append('file', file); fd.append('pagoId', String(cuota.id)); fd.append('leadId', String(leadId));
      const r = await fetch('/api/extract-receipt', { method: 'POST', body: fd });
      const j: { error?: string; monto?: number | null; fecha?: string | null; hora?: string | null; comprobante_nombre?: string | null } = await r.json();
      if (j.error) throw new Error(j.error);
      // Lo leído llena el formulario y se revisa ahí: el comprobante dice el monto en SU moneda, que puede no ser USD.
      if (j.monto != null && Number.isFinite(Number(j.monto))) setPlata((p) => ({ ...p, monto: String(j.monto) }));
      if (j.fecha && /^\d{4}-\d{2}-\d{2}/.test(j.fecha)) setFecha(j.fecha.slice(0, 10));
      if (j.hora) setHora(j.hora.slice(0, 5));
      setLeido(j.comprobante_nombre ?? file.name);
      setPaso('datos');
    } catch (e) { setError(`No pude leer el comprobante: ${msg(e)}`); }
    finally { setLeyendo(false); if (archivo.current) archivo.current.value = ''; }
  };

  const p = plataParaServer(plata, valorUsd);
  const falta = p.ok && p.monto != null && p.monto < valorUsd ? Math.round((valorUsd - p.monto) * 100) / 100 : 0;
  const guardar = () => {
    if (!p.ok) { setError(p.error); return; }
    setError(null);
    start(async () => {
      try {
        const r = await marcarPagoManualAction(cuota.id, leadId, { monto: p.monto, fecha, hora: hora || null, resto, moneda: p.moneda, montoOriginal: p.montoOriginal, metodo: metodo || null });
        // ⚠️ DESHACER SÓLO SI SE COBRÓ EXACTO LO DE LA CUOTA (revisión del 16/10/2026): con un descuento o un pago de
        // más el pendiente también es null, y desmarcar no devuelve el monto: la cuota quedaba debiendo lo cobrado.
        onHecho(r.pendiente != null ? `${nombre} cobrada · quedan ${usd(r.pendiente)} pendientes` : `${nombre} marcada como pagada`, r.pendiente == null && p.monto === valorUsd);
      } catch (e) { setError(msg(e)); }
    });
  };

  return (
    <Caja titulo={`Marcar ${nombre.toLowerCase()} como pagada`} onCerrar={onCerrar}
      pie={paso === 'datos' ? (
        <>
          <Button variant="secondary" onClick={() => setPaso('elegir')} disabled={pending}>Volver</Button>
          <Button variant="primary" onClick={guardar} loading={pending} disabled={!fecha}>Guardar el pago</Button>
        </>
      ) : <Button variant="secondary" onClick={onCerrar}>Cancelar</Button>}>
      <input ref={archivo} type="file" accept=".pdf,image/*" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) void subir(f); }} />
      {paso === 'elegir' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ margin: 0, fontSize: 13.5, color: 'var(--dim)' }}>{nombre} · {usd(valorUsd)}{cuota.fecha_esperada ? ` · vence el ${fmtDDMMYYYY(cuota.fecha_esperada)}` : ''}</p>
          <Button variant="primary" full loading={leyendo} onClick={() => archivo.current?.click()}>Subir el comprobante</Button>
          <Button variant="secondary" full disabled={leyendo} onClick={() => setPaso('datos')}>Cargarlo a mano</Button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {leido && <p style={{ margin: 0, fontSize: 12.5, color: 'var(--dim)' }}>Leído de <b>{leido}</b>. Revísalo antes de guardar.</p>}
          <CamposDePlata plata={plata} set={setPlata} monedaNegocio={monedaNegocio} usdPorDefecto={valorUsd} />
          <CamposDeCuando fecha={fecha} hora={hora} metodo={metodo} setFecha={setFecha} setHora={setHora} setMetodo={setMetodo} />
          {falta > 0 && (
            <div role="radiogroup" aria-label="Qué pasa con la diferencia" style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 14px', borderRadius: 11, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>Faltan {usd(falta)} de la cuota</span>
              {([['pendiente', 'Quedan pendientes'], ['descuento', 'Es un descuento']] as const).map(([v, l]) => (
                <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: 'var(--ink)', cursor: 'pointer' }}>
                  <input type="radio" name={`resto-${cuota.id}`} checked={resto === v} onChange={() => setResto(v)} />{l}
                </label>
              ))}
            </div>
          )}
        </div>
      )}
      {error && <div style={{ marginTop: 12 }}><Aviso tono="rojo">{error}</Aviso></div>}
    </Caja>
  );
}

/**
 * «Registrar un pago» que no es una cuota del plan (un adelanto, un extra, el pago de una venta sin cuotas), o la
 * MENSUALIDAD cobrada de una suscripción manual. Entra como una cuota nueva ya cobrada por `marcarPago`, el mismo
 * camino que cualquier cobro: suma a lo cobrado y corta los recordatorios. No toca el monto de la venta.
 */
export function RegistrarPago({ leadId, monedaNegocio, modo, sugeridoUsd, onCerrar, onHecho }: {
  leadId: number; monedaNegocio: string;
  /** 'mensualidad': el título, el concepto y el monto sugerido son los de la suscripción. */
  modo: 'pago' | 'mensualidad';
  sugeridoUsd?: number | null;
  onCerrar: () => void; onHecho: (mensaje: string) => void;
}) {
  const [plata, setPlata] = useState<Plata>({ moneda: 'USD', monto: sugeridoUsd ? String(sugeridoUsd) : '', usd: '' });
  const [fecha, setFecha] = useState(hoyISO());
  const [hora, setHora] = useState(horaAhora());
  const [metodo, setMetodo] = useState<MetodoPago | ''>('');
  const [concepto, setConcepto] = useState(modo === 'mensualidad' ? 'Mensualidad' : '');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const guardar = () => {
    const p = plataParaServer(plata, null);
    if (!p.ok || p.monto == null) { setError(p.ok ? 'Falta el monto.' : p.error); return; }
    setError(null);
    start(async () => {
      try {
        await registrarPagoSueltoAction(leadId, { monto: p.monto as number, fecha, hora: hora || null, moneda: p.moneda, montoOriginal: p.montoOriginal, metodo: metodo || null, concepto: concepto.trim() || null });
        onHecho(`${modo === 'mensualidad' ? 'Mensualidad' : 'Pago'} de ${usd(p.monto as number)} registrado`);
      } catch (e) { setError(msg(e)); }
    });
  };
  return (
    <Caja titulo={modo === 'mensualidad' ? 'Registrar la mensualidad cobrada' : 'Registrar un pago'} onCerrar={onCerrar}
      pie={<><Button variant="secondary" onClick={onCerrar} disabled={pending}>Cancelar</Button><Button variant="primary" onClick={guardar} loading={pending} disabled={!fecha}>Registrar</Button></>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <CamposDePlata plata={plata} set={setPlata} monedaNegocio={monedaNegocio} usdPorDefecto={null} />
        <CamposDeCuando fecha={fecha} hora={hora} metodo={metodo} setFecha={setFecha} setHora={setHora} setMetodo={setMetodo} />
        <Field label="Concepto (opcional)"><Input value={concepto} maxLength={200} onChange={(e) => setConcepto(e.target.value)} placeholder="Adelanto, extra…" /></Field>
      </div>
      {error && <div style={{ marginTop: 12 }}><Aviso tono="rojo">{error}</Aviso></div>}
    </Caja>
  );
}

/** El comprobante de una cuota cobrada a mano, con «Descargar». */
export function VerComprobante({ cuota, leadId, onCerrar }: { cuota: Pago; leadId: number; onCerrar: () => void }) {
  const src = `/api/doc?leadId=${leadId}&kind=comprobante&pagoId=${cuota.id}`;
  return (
    <Caja titulo={`Comprobante · ${nombreCuota(cuota.numero)}`} onCerrar={onCerrar} ancho={600}
      pie={<><a href={`${src}&download=1`} style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--primary)', textDecoration: 'none', alignSelf: 'center' }}>Descargar</a><Button variant="primary" onClick={onCerrar}>Cerrar</Button></>}>
      <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', padding: '9px 13px', fontFamily: MONO, fontSize: 12, color: 'var(--dim)', display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cuota.comprobante_nombre ?? 'comprobante'}</span>
          <span>{usd(Number(cuota.monto_usd))}{cuota.fecha_pago ? ` · ${fmtDDMMYYYY(cuota.fecha_pago)}` : ''}{cuota.pago_hora ? ` · ${cuota.pago_hora.slice(0, 5)}` : ''}</span>
        </div>
        <iframe src={src} title="Comprobante" style={{ display: 'block', width: '100%', height: 380, border: 'none', background: 'var(--surface-2)' }} />
      </div>
    </Caja>
  );
}

/**
 * «Cobrar la cuota N»: las dos maneras, una al lado de la otra. Ya pagó (por fuera) → marcarla; todavía no →
 * mandarle el link de ESA cuota. Sin pasarela conectada no se pregunta: va directo a marcarla.
 */
export function ElegirComoCobrar({ nombre, montoUsd, conLink, onMarcar, onLink, onCerrar }: {
  nombre: string; montoUsd: number; conLink: boolean; onMarcar: () => void; onLink: () => void; onCerrar: () => void;
}) {
  return (
    <Caja titulo={`Cobrar ${nombre.toLowerCase()}`} onCerrar={onCerrar} ancho={440} pie={<Button variant="secondary" onClick={onCerrar}>Cancelar</Button>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <p style={{ margin: 0, fontSize: 13.5, color: 'var(--dim)' }}>{nombre} · {usd(montoUsd)}</p>
        <Button variant="primary" full onClick={onMarcar}>Ya pagó: marcarla pagada</Button>
        {conLink && <Button variant="secondary" full onClick={onLink}>Mandarle el link de pago</Button>}
      </div>
    </Caja>
  );
}

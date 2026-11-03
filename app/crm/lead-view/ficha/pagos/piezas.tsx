'use client';

// =============================================================================
// ficha/pagos/piezas — lo que comparten los bloques de Pagos: la tarjeta y los modales de cobro a mano
// =============================================================================
// Los modales vinieron de DealDetailsCard (la tarjeta vieja del deal, borrada el 17/10/2026), con dos cosas que allá no tenían:
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

import { useEffect, useRef, useState, useTransition, type CSSProperties, type ReactNode } from 'react';
import type { ComprobanteDelChat } from './comprobante-del-chat';
import { plataDeRecibo, reciboLeido } from './recibo-leido';
import { Button, Field, Input, Modal, Status } from '@/app/_ui';
import type { Tono as TonoUi } from '@/app/_ui/tokens';
import type { Tono } from '@/lib/cobrado-lead';
import type { Pago } from '@/lib/pagos';
import { METODOS_PAGO, ROTULO_METODO, nombreCuota, type MetodoPago } from '@/lib/pagos-campo';
import { dolaresALaTasaDeLaCuota, restoEnLaMonedaDeLaCuota } from '@/lib/pagos-diferencia';
import { formatoMonto } from '@/lib/pasarela-moneda';
import { fechaEnPalabras, horaEnTz } from '@/lib/date-utils';
import { useTzWorkspace } from '../../useTzWorkspace';
import { usd } from '@/lib/pagos-vistazo';
import { marcarPagoManualAction, registrarPagoSueltoAction } from '@/app/crm/[id]/deal-actions';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';

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
  return <div role={tono === 'rojo' ? 'alert' : 'status'} style={{ borderRadius: 11, padding: '10px 14px', fontSize: 13.5, lineHeight: 1.5, fontWeight: 600, background: c.bg, color: c.ink }}>{children}<ReportarASoporte /></div>;
}

export function Semaforo({ tono, children }: { tono: Tono; children: ReactNode }) {
  return <Status tono={TONO_UI[tono]}>{children}</Status>;
}

/** La hora del NEGOCIO (20/10/2026): con la del navegador, alguien en otra zona anotaba el día del negocio con su hora. */
const useHoraDelNegocio = (): string => { const tz = useTzWorkspace(); return horaEnTz(tz); };
const numero = (s: string): number | null => {
  const n = Number(String(s).replace(',', '.'));
  // Lo que redondea a 0 (0,004) es «falta el monto», no un cobro de 0 (21/10/2026).
  const r = Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
  return r > 0 ? r : null;
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

function CamposDePlata({ plata, set, monedaNegocio, usdPorDefecto, monedaCuota = null, aLaTasa = false }: {
  plata: Plata; set: (p: Plata) => void; monedaNegocio: string; usdPorDefecto: number | null; monedaCuota?: string | null;
  /** `usdPorDefecto` sale de la tasa de la cuota (cobrada en su moneda), no es el valor entero de la cuota. */
  aLaTasa?: boolean;
}) {
  // La de la cuota también (un tramo en pesos, 29/10/2026), aunque no sea la del negocio.
  const monedas = [...new Set(['USD', monedaNegocio.toUpperCase(), ...(monedaCuota ? [monedaCuota.toUpperCase()] : [])])];
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
        <Field label="Cuánto es en dólares" hint={usdPorDefecto != null ? `Vacío, ${usd(usdPorDefecto)} (${aLaTasa ? 'a la tasa de la cuota' : 'el de la cuota'}). Es lo que suma a tus reportes.` : 'Es lo que suma a tus reportes.'}>
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
export function MarcarPagada({ cuota, leadId, monedaNegocio, hoy, comprobante = null, onCerrar, onHecho }: {
  cuota: Pago; leadId: number; onCerrar: () => void;
  /** null mientras no se sabe (`useMonedaDelNegocio`): un comprobante no se lee hasta saberla. */
  monedaNegocio: string | null;
  /** El día del NEGOCIO (`ctx.hoy`), la fecha que se propone: con el UTC, de noche el cobro caía mañana. */
  hoy: string;
  /** El comprobante que la persona adjuntó en el chat con MaKo (la 2.28): se lee solo al abrir, como «Subir el comprobante». */
  comprobante?: ComprobanteDelChat | null;
  /** `deshacer`: la cuota quedó pagada entera y se puede volver atrás. */
  onHecho: (mensaje: string, deshacer: boolean) => void;
}) {
  const nombre = nombreCuota(cuota.numero);
  const valorUsd = Number(cuota.monto_usd);
  const [paso, setPaso] = useState<'elegir' | 'datos'>('elegir');
  // Con un comprobante del chat, «leyendo» desde que abre: espera la moneda del negocio y lo lee solo.
  const [leyendo, setLeyendo] = useState(!!comprobante);
  const [leido, setLeido] = useState<{ nombre: string; nota: string | null } | null>(null);
  // Una cuota pactada en otra moneda (un tramo en pesos) se propone en ESA moneda y monto; los dólares, vacíos = los de la cuota.
  const monedaCuota = !cuota.pagado && cuota.moneda && cuota.moneda.toUpperCase() !== 'USD' && cuota.monto_original != null ? cuota.moneda.toUpperCase() : null;
  const [plata, setPlata] = useState<Plata>(monedaCuota ? { moneda: monedaCuota, monto: String(Number(cuota.monto_original)), usd: '' } : { moneda: 'USD', monto: String(valorUsd), usd: '' });
  const [fecha, setFecha] = useState(hoy);
  const horaNegocio = useHoraDelNegocio();
  const [hora, setHora] = useState(horaNegocio);
  const [metodo, setMetodo] = useState<MetodoPago | ''>('');
  const [resto, setResto] = useState<'pendiente' | 'descuento'>('pendiente');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const archivo = useRef<HTMLInputElement | null>(null);

  const subir = async (file: File, moneda: string) => {
    setError(null); setLeyendo(true);
    try {
      const fd = new FormData(); fd.append('file', file); fd.append('pagoId', String(cuota.id)); fd.append('leadId', String(leadId));
      const r = await fetch('/api/extract-receipt', { method: 'POST', body: fd });
      const j = reciboLeido(await r.json().catch(() => ({ error: `respondió ${r.status}` })));
      if ('error' in j) throw new Error(j.error);
      // Lo leído llena el formulario y se revisa ahí: el monto en SU moneda (dólares, o la del negocio con el valor en
      // dólares de la cuota), nunca convertido por la IA (./recibo-leido.ts).
      const p = plataDeRecibo(j, moneda, valorUsd);
      if (p.plata) setPlata(p.plata);
      if (j.fecha) setFecha(j.fecha);
      if (j.hora) setHora(j.hora);
      setLeido({ nombre: j.nombre ?? file.name, nota: [j.nota, p.aviso].filter(Boolean).join(' · ') || null });
      setPaso('datos');
    } catch (e) { setError(`No pude leer el comprobante: ${msg(e)}`); }
    finally { setLeyendo(false); if (archivo.current) archivo.current.value = ''; }
  };
  // El del chat se lee UNA vez al abrir (un ref: el doble montaje de React en desarrollo no lo sube dos veces), CUANDO
  // SE SABE LA MONEDA del negocio (revisión de 1b6fc9ad8, baja: se leía con la del primer render, 'USD'). Si no se puede
  // bajar, queda el paso de elegir, con el error: se sube a mano o se carga a mano.
  const delChat = useRef(false);
  useEffect(() => {
    if (!comprobante || delChat.current || monedaNegocio == null) return;
    delChat.current = true;
    setLeyendo(true);
    comprobante.leer().then((f) => subir(f, monedaNegocio), (e) => { setLeyendo(false); setError(`No pude traer el comprobante del chat: ${msg(e)}`); });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- una sola vez, con el comprobante con que se abrió
  }, [comprobante, monedaNegocio]);

  // Los dólares vacíos de un cobro en la moneda de la cuota van a SU tasa, no son la cuota entera (lib/pagos-diferencia.ts): un
  // cobro a medias en pesos pregunta por la diferencia, como uno en dólares (revisión de 9fc4030dd, alta).
  const aLaTasa = dolaresALaTasaDeLaCuota(cuota, { moneda: plata.moneda, montoOriginal: numero(plata.monto) });
  const p = plataParaServer(plata, aLaTasa ?? valorUsd);
  const falta = p.ok && p.monto != null && p.monto < valorUsd ? Math.round((valorUsd - p.monto) * 100) / 100 : 0;
  // En la moneda de la cuota, lo que falta es en ESA moneda: así queda la diferencia (mig 0347; revisión de 7f79a4e6c, B13).
  const faltaEnSuMoneda = falta > 0 && p.ok ? restoEnLaMonedaDeLaCuota(cuota, p) : null;
  const guardar = () => {
    if (!p.ok) { setError(p.error); return; }
    setError(null);
    start(async () => {
      try {
        const r = await marcarPagoManualAction(cuota.id, leadId, { monto: p.monto, fecha, hora: hora || null, resto, moneda: p.moneda, montoOriginal: p.montoOriginal, metodo: metodo || null });
        // ⚠️ DESHACER SÓLO SI SE COBRÓ EXACTO LO DE LA CUOTA (revisión del 16/10/2026): con un descuento o un pago de
        // más el pendiente también es null, y desmarcar no devuelve el monto: la cuota quedaba debiendo lo cobrado.
        // El link ya se había cobrado (17/10/2026): quedó con ese pago y no hay nada que deshacer acá.
        if (r.porLink) { onHecho('Ya pagada por link', false); return; }
        // Alguien la cobró mientras el modal estaba abierto: no se tocó nada, y no hay nada que deshacer.
        if (r.yaEstaba) { onHecho(`${nombre} ya estaba cobrada`, false); return; }
        const quedan = r.pendienteEnSuMoneda ? formatoMonto(r.pendienteEnSuMoneda.monto, r.pendienteEnSuMoneda.moneda) : usd(r.pendiente ?? 0);
        onHecho(r.pendiente != null ? `${nombre} cobrada · quedan ${quedan} pendientes` : `${nombre} marcada como pagada`, r.pendiente == null && p.monto === valorUsd);
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
      <input ref={archivo} type="file" accept=".pdf,image/*" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f && monedaNegocio != null) void subir(f, monedaNegocio); }} />
      {paso === 'elegir' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ margin: 0, fontSize: 13.5, color: 'var(--dim)' }}>{nombre} · {usd(valorUsd)}{cuota.fecha_esperada ? ` · vence el ${fechaEnPalabras(cuota.fecha_esperada)}` : ''}</p>
          {comprobante && leyendo && <p style={{ margin: 0, fontSize: 13, color: 'var(--dim)' }}>Leyendo <b>{comprobante.nombre}</b>, el comprobante del chat…</p>}
          <Button variant="primary" full loading={leyendo || monedaNegocio == null} onClick={() => archivo.current?.click()}>Subir el comprobante</Button>
          <Button variant="secondary" full disabled={leyendo} onClick={() => setPaso('datos')}>Cargarlo a mano</Button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {leido && <p style={{ margin: 0, fontSize: 12.5, color: 'var(--dim)' }}>Leído de <b>{leido.nombre}</b>{leido.nota ? ` (${leido.nota})` : ''}. Revísalo antes de guardar.</p>}
          <CamposDePlata plata={plata} set={setPlata} monedaNegocio={monedaNegocio ?? 'USD'} usdPorDefecto={aLaTasa ?? valorUsd} monedaCuota={monedaCuota} aLaTasa={aLaTasa != null} />
          <CamposDeCuando fecha={fecha} hora={hora} metodo={metodo} setFecha={setFecha} setHora={setHora} setMetodo={setMetodo} />
          {falta > 0 && (
            <div role="radiogroup" aria-label="Qué pasa con la diferencia" style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 14px', borderRadius: 11, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>Faltan {faltaEnSuMoneda ? `${formatoMonto(faltaEnSuMoneda.monto, faltaEnSuMoneda.moneda)} (${formatoMonto(falta, 'USD')})` : usd(falta)} de la cuota</span>
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
export function RegistrarPago({ leadId, crm = null, monedaNegocio, modo, sugeridoUsd, hoy, onCerrar, onHecho }: {
  leadId: number; monedaNegocio: string;
  /** El CRM agregado que mira la tab (mig 0324): el pago es de ese trato. null = la casa. */
  crm?: number | null;
  /** El día del NEGOCIO (`ctx.hoy`), la fecha que se propone: con el UTC, de noche el pago caía mañana. */
  hoy: string;
  /** 'mensualidad': el título, el concepto y el monto sugerido son los de la suscripción. */
  modo: 'pago' | 'mensualidad';
  sugeridoUsd?: number | null;
  onCerrar: () => void; onHecho: (mensaje: string) => void;
}) {
  const [plata, setPlata] = useState<Plata>({ moneda: 'USD', monto: sugeridoUsd ? String(sugeridoUsd) : '', usd: '' });
  const [fecha, setFecha] = useState(hoy);
  const horaNegocio = useHoraDelNegocio();
  const [hora, setHora] = useState(horaNegocio);
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
        await registrarPagoSueltoAction(leadId, { monto: p.monto as number, fecha, hora: hora || null, moneda: p.moneda, montoOriginal: p.montoOriginal, metodo: metodo || null, concepto: concepto.trim() || null, mensualidad: modo === 'mensualidad', crm });
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
          <span>{usd(Number(cuota.monto_usd))}{cuota.fecha_pago ? ` · ${fechaEnPalabras(cuota.fecha_pago)}` : ''}{cuota.pago_hora ? ` · ${cuota.pago_hora.slice(0, 5)}` : ''}</span>
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

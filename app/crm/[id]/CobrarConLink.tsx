'use client';

// =============================================================================
// CobrarConLink — «Cobrar con link» desde la ficha del lead (Stripe o Mercado Pago)
// =============================================================================
// Una pregunta por pantalla (WizardShell, la regla de la casa), y sólo las que hacen falta:
//
//   ¿Qué cobras?              los productos del catálogo + «Otro monto»
//   ¿Con qué cobras?          sólo si hay DOS pasarelas conectadas
//   ¿Cuánto cobras?           sólo si el precio no sale del producto (sin precio, o en otra moneda)
//   ¿Cuánto es en dólares?    sólo si la moneda no es USD y no hay producto con precio
//   ¿Una vez o todos los meses?  sólo si no lo define el producto
//   ¿A qué email le llega?    sólo si Mercado Pago lo exige (suscripción) y el lead no tiene
//   → el link, con «Copiar» y «Abrir WhatsApp»
//
// ⚠️ LA PASARELA SE ELIGE ANTES DEL MONTO, no al final: la MONEDA depende de ella. Mercado Pago cobra
// en la moneda del sitio de SU cuenta (una cuenta argentina, en ARS) y un precio en dólares no se
// convierte solo a pesos (`decidirCobro`, lib/cobros-reglas.ts). Preguntar el monto antes de saber la
// pasarela era pedir US$ 47 y descubrir después que había que escribirlos en pesos.
//
// ⚠️ LA MONEDA LA DICE LA CUENTA, no una constante (AGENTS.md «Un campo con una moneda en el NOMBRE»):
// el asistente le pregunta a cada pasarela al abrirse (`monedasCobroAction`). Stripe cobra en dólares
// por defecto (el catálogo está en USD) y ofrece también la moneda de su cuenta.
//
// ⚠️ «¿Cuánto es en dólares?» NO es obligatoria y lo dice: sin ese valor el cobro se registra igual,
// pero no puede sumar al cash del CRM (`pagos.monto_usd` es en USD y nunca se inventa una tasa).
//
// Sin ninguna pasarela conectada no hay asistente: un renglón corto que lleva a /integraciones.

import { useEffect, useState, type CSSProperties } from 'react';
import Link from '@/app/_ui/Link';
import { Button, ButtonLink, useOkFlash } from '@/app/_ui';
import { WizardShell, wizardInput } from '@/app/_components/WizardShell';
import { NOMBRE_PASARELA, type Pasarela, type TipoCobro } from '@/lib/cobros-tipos';
import { formatoMonto } from '@/lib/pasarela-moneda';
import { crearCobroAction, monedasCobroAction, type MonedasCobro, type ProductoCobrable } from './cobros-actions';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

type LeadCobro = { id: number; nombre: string; email: string | null; telefono: string | null };

export function CobrarConLink({ lead, pasarelas, productos, onCreado }: {
  lead: LeadCobro;
  pasarelas: Pasarela[];
  productos: ProductoCobrable[];
  /** Se creó un link: quien lo monta relee la lista de cobros. */
  onCreado: () => void;
}) {
  const [abierto, setAbierto] = useState(false);

  if (!pasarelas.length) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 13, color: 'var(--dim)', fontFamily: SANS }}>
        Conecta Stripe o Mercado Pago para cobrar con un link.
        <Link href="/integraciones" style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>Conectar →</Link>
      </span>
    );
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setAbierto(true)}>Cobrar con link</Button>
      {/* El clic no puede subir hasta el fondo de la ficha en modal (que la cierra): ver el mismo
          envoltorio del wizard de etapas en app/crm/LeadSheet.tsx. */}
      {abierto && (
        <div onClick={(e) => e.stopPropagation()}>
          <Asistente lead={lead} pasarelas={pasarelas} productos={productos} onCreado={onCreado} onCerrar={() => setAbierto(false)} />
        </div>
      )}
    </>
  );
}

type Que = { tipo: 'producto'; id: number } | { tipo: 'otro' };
type PasoId = 'que' | 'pasarela' | 'monto' | 'usd' | 'frecuencia' | 'email' | 'listo';

const PREGUNTA: Record<Exclude<PasoId, 'monto'>, string> = {
  que: '¿Qué cobras?',
  pasarela: '¿Con qué cobras?',
  usd: '¿Cuánto es en dólares?',
  frecuencia: '¿Una vez o todos los meses?',
  email: '¿A qué email le llega el cobro?',
  listo: 'Link listo',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const numero = (s: string): number | null => {
  const n = Number(String(s).replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** Una opción clickeable: el mismo botón que usan los pasos de la casa (ExportarLeadsModal). */
function Opcion({ on, titulo, sub, onClick }: { on: boolean; titulo: string; sub?: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      style={{ width: '100%', padding: '12px 15px', borderRadius: 12, textAlign: 'left', fontFamily: SANS, display: 'flex', alignItems: 'center', gap: 11, cursor: 'pointer', transition: 'border-color .12s, background .12s', border: `1px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`, background: on ? 'var(--primary-bg)' : 'var(--surface-2)', color: on ? 'var(--primary)' : 'var(--ink)' }}>
      <span style={{ width: 18, height: 18, flex: 'none', borderRadius: '50%', border: `1.5px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`, background: on ? 'var(--primary)' : 'transparent', color: '#fff', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{on ? '✓' : ''}</span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 14.5, fontWeight: on ? 700 : 600, overflowWrap: 'anywhere' }}>{titulo}</span>
        {sub && <span style={{ display: 'block', fontSize: 12, color: 'var(--faint)', marginTop: 1 }}>{sub}</span>}
      </span>
    </button>
  );
}

const chipMoneda = (on: boolean): CSSProperties => ({
  padding: '7px 13px', borderRadius: 9, border: `1px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`,
  background: on ? 'var(--primary-bg)' : 'var(--surface)', color: on ? 'var(--primary)' : 'var(--dim)',
  fontFamily: MONO, fontSize: 12, fontWeight: 700, cursor: 'pointer',
});

function Asistente({ lead, pasarelas, productos, onCreado, onCerrar }: {
  lead: LeadCobro; pasarelas: Pasarela[]; productos: ProductoCobrable[]; onCreado: () => void; onCerrar: () => void;
}) {
  const [paso, setPaso] = useState<PasoId>('que');
  const [que, setQue] = useState<Que | null>(null);
  const [pasarelaElegida, setPasarelaElegida] = useState<Pasarela | null>(null);
  const [monto, setMonto] = useState('');
  const [concepto, setConcepto] = useState('');
  const [monedaElegida, setMonedaElegida] = useState<string | null>(null);
  const [usd, setUsd] = useState('');
  const [frecuencia, setFrecuencia] = useState<TipoCobro | null>(null);
  const [email, setEmail] = useState('');
  const [monedas, setMonedas] = useState<MonedasCobro | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<{ link: string; prueba: boolean } | null>(null);
  const { ok: copiado, flash } = useOkFlash();

  // La moneda de cada cuenta: habla con la pasarela, así que va al abrir y no al montar la ficha.
  useEffect(() => {
    let vivo = true;
    monedasCobroAction().then((m) => { if (vivo) setMonedas(m); }).catch(() => { if (vivo) setMonedas({}); });
    return () => { vivo = false; };
  }, []);

  const producto = que?.tipo === 'producto' ? productos.find((p) => p.id === que.id) ?? null : null;
  const pasarela: Pasarela | null = pasarelas.length === 1 ? pasarelas[0] : pasarelaElegida;
  const monedaMp = monedas?.mercadopago ?? null;
  const monedasStripe = [...new Set(['USD', ...(monedas?.stripe ? [monedas.stripe] : [])])];
  const moneda: string | null = pasarela === 'mercadopago'
    ? monedaMp
    : monedaElegida && monedasStripe.includes(monedaElegida) ? monedaElegida : 'USD';
  const precioUsd = producto?.monto_usd ?? null;
  const necesitaMonto = !producto || precioUsd == null || moneda !== 'USD';
  const necesitaUsd = !!moneda && moneda !== 'USD' && precioUsd == null;
  const tipo: TipoCobro | null = producto ? producto.tipo : frecuencia;
  const necesitaEmail = pasarela === 'mercadopago' && tipo === 'suscripcion' && !lead.email?.trim();

  const pasos: PasoId[] = [
    'que',
    ...(pasarelas.length > 1 ? ['pasarela' as const] : []),
    ...(necesitaMonto ? ['monto' as const] : []),
    ...(necesitaUsd ? ['usd' as const] : []),
    ...(!producto ? ['frecuencia' as const] : []),
    ...(necesitaEmail ? ['email' as const] : []),
  ];
  const mapa: PasoId[] = hecho ? [...pasos, 'listo'] : pasos;
  const actual: PasoId = hecho ? 'listo' : pasos.includes(paso) ? paso : pasos[pasos.length - 1];
  const idx = pasos.indexOf(actual);
  const enUltimo = hecho ? true : idx === pasos.length - 1;
  // Mercado Pago sin su moneda todavía: el paso del monto espera (o dice que no pudo leerla).
  const esperandoMoneda = actual === 'monto' && pasarela === 'mercadopago' && monedas === null;
  const sinMonedaMp = pasarela === 'mercadopago' && monedas !== null && !monedaMp;

  const puedeAvanzar = (() => {
    switch (actual) {
      case 'que': return que != null;
      case 'pasarela': return pasarelaElegida != null && !(pasarelaElegida === 'mercadopago' && sinMonedaMp);
      case 'monto': return numero(monto) != null && !!moneda;
      case 'usd': return usd.trim() === '' || numero(usd) != null;
      case 'frecuencia': return frecuencia != null;
      case 'email': return EMAIL_RE.test(email.trim());
      case 'listo': return true;
      default: return false;
    }
  })();

  const crear = async () => {
    setPending(true);
    setError(null);
    const r = await crearCobroAction(lead.id, {
      pasarela,
      productoId: producto?.id ?? null,
      concepto: producto ? null : concepto.trim() || null,
      monto: necesitaMonto ? numero(monto) : null,
      moneda,
      montoUsd: necesitaUsd ? numero(usd) : null,
      tipo,
      email: necesitaEmail ? email.trim() : null,
    }).catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : String(e) }));
    setPending(false);
    if (!r.ok) { setError(r.error); return; }
    setHecho({ link: r.link, prueba: r.prueba });
    onCreado();
  };

  const primerNombre = lead.nombre.trim().split(/\s+/)[0] ?? '';
  const queSeCobra = producto?.nombre ?? (concepto.trim() || null);
  const textoWa = hecho
    ? `Hola${primerNombre ? ` ${primerNombre}` : ''}, te paso el link para pagar${queSeCobra ? ` ${queSeCobra}` : ''}: ${hecho.link}`
    : '';
  const tel = (lead.telefono ?? '').replace(/\D/g, '');
  const linkWa = `https://wa.me/${tel}?text=${encodeURIComponent(textoWa)}`;

  const copiar = async () => {
    if (!hecho) return;
    try { await navigator.clipboard.writeText(hecho.link); flash(); } catch { setError('No pude copiar: selecciona el link y cópialo a mano.'); }
  };

  const pregunta = actual === 'monto'
    ? (producto ? `¿Cuánto cobras por ${producto.nombre}?` : '¿Cuánto cobras?')
    : PREGUNTA[actual];
  const sub = (() => {
    if (actual === 'monto' && pasarela === 'mercadopago' && monedaMp) {
      return precioUsd != null
        ? `Tu precio es ${formatoMonto(precioUsd, 'USD')}${producto?.tipo === 'suscripcion' ? ' al mes' : ''}. Mercado Pago cobra en ${monedaMp}.`
        : `En ${monedaMp}, la moneda de tu cuenta de Mercado Pago.`;
    }
    if (actual === 'usd') return 'Para sumarlo al cash del CRM. Si lo dejas vacío, el pago se registra igual pero no suma al cash.';
    if (actual === 'email') return 'Mercado Pago lo pide para cobrar todos los meses.';
    if (actual === 'listo') return hecho?.prueba ? 'Es un link de PRUEBA: el pago no es real.' : `Mándaselo${primerNombre ? ` a ${primerNombre}` : ''}. Cuando pague, se marca solo en el CRM.`;
    return undefined;
  })();

  const columna = { display: 'flex', flexDirection: 'column', gap: 9 } as const;

  const cuerpo = () => {
    switch (actual) {
      case 'que':
        return (
          <div style={columna}>
            {productos.map((p) => (
              <Opcion key={p.id} on={que?.tipo === 'producto' && que.id === p.id} titulo={p.nombre}
                sub={p.monto_usd != null ? `${formatoMonto(p.monto_usd, 'USD')}${p.tipo === 'suscripcion' ? ' al mes' : ''}` : p.tipo === 'suscripcion' ? 'Todos los meses · sin precio cargado' : 'Sin precio cargado'}
                onClick={() => setQue({ tipo: 'producto', id: p.id })} />
            ))}
            <Opcion on={que?.tipo === 'otro'} titulo="Otro monto" sub="Escribes cuánto y por qué" onClick={() => setQue({ tipo: 'otro' })} />
          </div>
        );
      case 'pasarela':
        return (
          <div style={columna}>
            {pasarelas.map((p) => (
              <Opcion key={p} on={pasarelaElegida === p} titulo={NOMBRE_PASARELA[p]}
                sub={p === 'mercadopago' ? (monedas === null ? 'Leyendo tu cuenta…' : monedaMp ? `Cobra en ${monedaMp}` : 'No pude leer la moneda de tu cuenta') : 'Tarjeta, en dólares'}
                onClick={() => setPasarelaElegida(p)} />
            ))}
          </div>
        );
      case 'monto':
        return (
          <div style={{ ...columna, gap: 12 }}>
            {pasarela !== 'mercadopago' && monedasStripe.length > 1 && (
              <div role="group" aria-label="Moneda" style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
                {monedasStripe.map((m) => (
                  <button key={m} type="button" style={chipMoneda(moneda === m)} onClick={() => setMonedaElegida(m)}>{m}</button>
                ))}
              </div>
            )}
            <input autoFocus value={monto} onChange={(e) => setMonto(e.target.value)} inputMode="decimal"
              placeholder={moneda ? `Monto en ${moneda}` : 'Monto'} style={wizardInput} aria-label="Monto" />
            {/* Lo que se va a cobrar, ESCRITO como lo va a ver quien paga: «49.900» con punto de miles
                se lee como 49,9 (el punto es el decimal acá), y en una pantalla de cobro eso es cobrar
                mil veces menos sin que nada lo diga. */}
            {numero(monto) != null && moneda && (
              <span style={{ fontSize: 13, color: 'var(--dim)', textAlign: 'center' }}>Se cobra <b style={{ color: 'var(--ink)' }}>{formatoMonto(numero(monto)!, moneda)}</b>{tipo === 'suscripcion' ? ' al mes' : ''}</span>
            )}
            {!producto && (
              <input value={concepto} onChange={(e) => setConcepto(e.target.value)} maxLength={200}
                placeholder="Concepto (opcional)" style={wizardInput} aria-label="Concepto" />
            )}
            {sinMonedaMp && <span style={{ fontSize: 13, color: 'var(--bad)' }}>No pude leer la moneda de tu cuenta de Mercado Pago. Cierra y prueba de nuevo.</span>}
          </div>
        );
      case 'usd':
        return (
          <input autoFocus value={usd} onChange={(e) => setUsd(e.target.value)} inputMode="decimal"
            placeholder="US$" style={wizardInput} aria-label="Valor en dólares" />
        );
      case 'frecuencia':
        return (
          <div style={columna}>
            <Opcion on={frecuencia === 'unico'} titulo="Una vez" onClick={() => setFrecuencia('unico')} />
            <Opcion on={frecuencia === 'suscripcion'} titulo="Todos los meses" sub="Se cobra solo cada mes, hasta que se cancele" onClick={() => setFrecuencia('suscripcion')} />
          </div>
        );
      case 'email':
        return (
          <input autoFocus value={email} onChange={(e) => setEmail(e.target.value)} type="email"
            placeholder="Email de quien paga" style={wizardInput} aria-label="Email de quien paga" />
        );
      case 'listo':
        return hecho ? (
          <div style={{ ...columna, gap: 12 }}>
            <input readOnly value={hecho.link} onFocus={(e) => e.currentTarget.select()} style={{ ...wizardInput, fontFamily: MONO, fontSize: 13 }} aria-label="Link de pago" />
            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
              <Button variant="primary" ok={copiado} okLabel="Copiado" onClick={() => void copiar()}>Copiar</Button>
              <ButtonLink href={linkWa} variant="secondary" newTab>Abrir WhatsApp</ButtonLink>
            </div>
          </div>
        ) : null;
      default:
        return null;
    }
  };

  return (
    <WizardShell
      titulo={`Cobrar a ${lead.nombre}`}
      pasos={mapa}
      pasoActual={actual}
      pregunta={pregunta}
      sub={sub}
      error={error}
      cargando={esperandoMoneda ? 'Leyendo tu cuenta de Mercado Pago…' : null}
      puedeAvanzar={puedeAvanzar}
      enUltimo={enUltimo}
      confirmLabel={hecho ? 'Listo' : 'Crear link'}
      pending={pending}
      hideAtras={!!hecho}
      atrasLabel={idx <= 0 ? 'Cancelar' : 'Atrás'}
      onAtras={() => { setError(null); if (idx <= 0) onCerrar(); else setPaso(pasos[idx - 1]); }}
      onSiguiente={() => { setError(null); setPaso(pasos[Math.min(idx + 1, pasos.length - 1)]); }}
      onConfirmar={() => { if (hecho) onCerrar(); else if (!pending) void crear(); }}
      onClose={onCerrar}
      ancho={520}
    >
      {cuerpo()}
    </WizardShell>
  );
}

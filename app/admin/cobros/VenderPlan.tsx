'use client';

// =============================================================================
// VenderPlan — el link de pago de un plan de MaKo, una pregunta por pantalla
// =============================================================================
// ¿Qué plan? → (¿con qué cobras?, sólo si hay dos pasarelas) → ¿cuánto y cada cuánto? → ¿a quién?
// → el link listo para copiar. Al pagarse, lib/cobros.ts crea la cuenta sola con ese plan.
//
// ⚠️ LA PASARELA VA ANTES DEL MONTO, no al final. La moneda depende de ella: Stripe cobra en la que
// se le diga (USD por defecto) y Mercado Pago SÓLO en la de su cuenta (MLA = ARS). Elegirla después
// de escribir «97 USD» era ofrecer una combinación que Mercado Pago rechaza al crear el link.
//
// ⚠️ LOS PLANES SON `CAPAS_VENDIBLES`, nunca el catálogo entero: la capa `superadmin` no es un plan,
// es cómo se identifica la plataforma (lib/capas.ts). Lo fija tests/admin-cobros.test.ts, y la action
// lo vuelve a preguntar (la pantalla no protege nada).

import { useState, type CSSProperties, type ReactNode } from 'react';
import { WizardShell, wizardInput } from '@/app/_components/WizardShell';
import { Button } from '@/app/_ui';
import { useRouter } from '@/app/_ui/Link';
import { CAPAS_VENDIBLES } from '@/lib/capas';
import { NOMBRE_PASARELA, type Pasarela, type TipoCobro } from '@/lib/cobros-tipos';
import { formatoMonto } from '@/lib/pasarela-moneda';
import { venderPlanAction } from './actions';

type Paso = 'plan' | 'pasarela' | 'monto' | 'quien' | 'listo';

/** Lo que Stripe cobra desde acá. Mercado Pago no elige: cobra en la moneda de su cuenta. */
const MONEDAS_STRIPE = ['USD', 'MXN', 'EUR'] as const;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ROTULO_PASO: Record<Paso, string> = {
  plan: 'Plan', pasarela: 'Pasarela', monto: 'Monto', quien: 'Quién paga', listo: 'Link',
};

export default function VenderPlan({ pasarelas, sugeridos }: {
  /** Las pasarelas conectadas en el workspace de la plataforma (una o dos: sin ninguna no se monta). */
  pasarelas: Pasarela[];
  /** Montos en USD de la grilla vigente (app/admin/estrategia/datos.ts), como atajo. */
  sugeridos: number[];
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [paso, setPaso] = useState<Paso>('plan');
  const [capa, setCapa] = useState<string | null>(null);
  const [pasarela, setPasarela] = useState<Pasarela | null>(null);
  const [tipo, setTipo] = useState<TipoCobro>('suscripcion');
  const [monto, setMonto] = useState('');
  const [moneda, setMoneda] = useState<string>('USD');
  const [montoUsd, setMontoUsd] = useState('');
  const [email, setEmail] = useState('');
  const [nombre, setNombre] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<{ link: string; monto: number; moneda: string } | null>(null);
  const [copiado, setCopiado] = useState<'si' | 'no' | null>(null);

  // Con UNA pasarela no se pregunta: es ésa (y lib/cobros.ts elige igual).
  const efectiva: Pasarela | null = pasarelas.length === 1 ? pasarelas[0] : pasarela;
  const enMp = efectiva === 'mercadopago';
  // null = la moneda de la cuenta de Mercado Pago, que decide el server.
  const monedaFinal: string | null = enMp ? null : moneda;
  const pideUsd = monedaFinal !== 'USD';

  const pasos: Paso[] = ['plan', ...(pasarelas.length > 1 ? (['pasarela'] as const) : []), 'monto', 'quien', 'listo'];
  const idx = pasos.indexOf(paso);
  const ir = (d: 1 | -1) => { setError(null); setPaso(pasos[Math.min(Math.max(idx + d, 0), pasos.length - 1)]); };

  const montoNum = Number(monto.replace(',', '.'));
  const montoOk = Number.isFinite(montoNum) && montoNum > 0;
  const quienOk = EMAIL_RE.test(email.trim()) && nombre.trim().length > 1;
  const puedeAvanzar =
    paso === 'plan' ? !!capa
      : paso === 'pasarela' ? !!pasarela
        : paso === 'monto' ? montoOk
          : paso === 'quien' ? quienOk
            : true;

  function abrir() {
    setPaso('plan'); setCapa(null); setPasarela(null); setTipo('suscripcion'); setMonto(''); setMoneda('USD');
    setMontoUsd(''); setEmail(''); setNombre(''); setError(null); setHecho(null); setCopiado(null);
    setAbierto(true);
  }
  const cerrar = () => { if (!pending) setAbierto(false); };

  async function crear() {
    if (!capa || !montoOk || !quienOk) return;
    setPending(true); setError(null);
    const usd = Number(montoUsd.replace(',', '.'));
    const r = await venderPlanAction({
      capa, monto: montoNum, moneda: monedaFinal, tipo,
      montoUsd: pideUsd && Number.isFinite(usd) && usd > 0 ? usd : null,
      email: email.trim(), nombre: nombre.trim(), pasarela: efectiva,
    }).catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : 'No pude crear el link.' }));
    setPending(false);
    if (!r.ok) { setError(r.error); return; }
    setHecho({ link: r.link, monto: r.monto, moneda: r.moneda });
    setPaso('listo');
    // La lista de abajo es del server: que se vuelva a leer con el cobro nuevo.
    router.refresh();
  }

  async function copiar() {
    if (!hecho) return;
    try { await navigator.clipboard.writeText(hecho.link); setCopiado('si'); }
    catch { setCopiado('no'); }
  }

  const planNombre = CAPAS_VENDIBLES.find((c) => c.id === capa)?.nombre ?? '';

  return (
    <>
      <Button onClick={abrir}>Vender un plan</Button>
      {abierto && (
        <WizardShell
          titulo="Vender un plan"
          pasos={pasos.map((p) => ROTULO_PASO[p])}
          pasoActual={ROTULO_PASO[paso]}
          pregunta={
            paso === 'plan' ? '¿Qué plan?'
              : paso === 'pasarela' ? '¿Con qué cobras?'
                : paso === 'monto' ? '¿Cuánto y cada cuánto?'
                  : paso === 'quien' ? '¿A quién?'
                    : 'Link listo'
          }
          sub={
            paso === 'pasarela' ? 'Mercado Pago cobra en la moneda de su cuenta.'
              : paso === 'quien' ? 'A ese email le llega el acceso: entra con Google.'
                : paso === 'listo' && hecho ? `${planNombre} · ${formatoMonto(hecho.monto, hecho.moneda)}${tipo === 'suscripcion' ? ' por mes' : ''} · ${nombre.trim()}`
                  : undefined
          }
          error={error}
          puedeAvanzar={puedeAvanzar}
          enUltimo={paso === 'quien' || paso === 'listo'}
          confirmLabel={paso === 'listo' ? 'Listo' : 'Crear el link'}
          pending={pending}
          atrasLabel={idx === 0 ? 'Cancelar' : 'Atrás'}
          hideAtras={paso === 'listo'}
          onAtras={() => (idx === 0 ? cerrar() : ir(-1))}
          onSiguiente={() => ir(1)}
          onConfirmar={() => (paso === 'listo' ? setAbierto(false) : void crear())}
          onClose={cerrar}
          ancho={540}
        >
          {paso === 'plan' && (
            <Opciones>
              {CAPAS_VENDIBLES.map((c) => (
                <Opcion key={c.id} activa={capa === c.id} onClick={() => { setCapa(c.id); setError(null); setPaso(pasos[1]); }}
                  titulo={c.nombre} detalle={c.descripcion} />
              ))}
            </Opciones>
          )}

          {paso === 'pasarela' && (
            <Opciones>
              {pasarelas.map((p) => (
                <Opcion key={p} activa={pasarela === p} onClick={() => { setPasarela(p); setError(null); setPaso('monto'); }}
                  titulo={NOMBRE_PASARELA[p]} detalle={p === 'stripe' ? 'En dólares, o en la moneda que elijas.' : 'En la moneda de tu cuenta.'} />
              ))}
            </Opciones>
          )}

          {paso === 'monto' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Chips
                valor={tipo}
                opciones={[{ v: 'suscripcion', l: 'Todos los meses' }, { v: 'unico', l: 'Una vez' }]}
                onChange={(v) => setTipo(v as TipoCobro)}
              />
              {enMp ? (
                <p style={{ margin: 0, fontSize: 13, color: 'var(--dim)' }}>En la moneda de tu cuenta de Mercado Pago.</p>
              ) : (
                <Chips valor={moneda} opciones={MONEDAS_STRIPE.map((m) => ({ v: m, l: m }))} onChange={setMoneda} />
              )}
              <input autoFocus value={monto} onChange={(e) => setMonto(e.target.value)} inputMode="decimal"
                placeholder={enMp ? 'Monto' : `Monto en ${moneda}`} style={wizardInput} aria-label="Monto" />
              {!enMp && moneda === 'USD' && sugeridos.length > 0 && (
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                  {sugeridos.map((s) => (
                    <button key={s} type="button" onClick={() => setMonto(String(s))} style={chip(montoNum === s)}>
                      {formatoMonto(s, 'USD')}
                    </button>
                  ))}
                </div>
              )}
              {pideUsd && (
                // Sin el valor en dólares el cobro se hace igual, pero no entra al cash del CRM: nunca
                // se inventa una tasa (lib/cobros-reglas.ts, montoUsdDelCobro).
                <input value={montoUsd} onChange={(e) => setMontoUsd(e.target.value)} inputMode="decimal"
                  placeholder="Equivale a US$ (opcional)" style={wizardInput} aria-label="Equivale a dólares" />
              )}
            </div>
          )}

          {paso === 'quien' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input autoFocus value={email} onChange={(e) => setEmail(e.target.value)} type="email"
                placeholder="Email" style={wizardInput} aria-label="Email de quien paga" />
              <input value={nombre} onChange={(e) => setNombre(e.target.value)}
                placeholder="Nombre" style={wizardInput} aria-label="Nombre de quien paga" />
            </div>
          )}

          {paso === 'listo' && hecho && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'stretch' }}>
              <input readOnly value={hecho.link} onFocus={(e) => e.currentTarget.select()} style={{ ...wizardInput, fontSize: 13 }} aria-label="Link de pago" />
              <div style={{ alignSelf: 'center' }}>
                <Button variant="secondary" onClick={() => void copiar()}>{copiado === 'si' ? 'Copiado' : 'Copiar'}</Button>
              </div>
              {copiado === 'no' && <p style={{ margin: 0, fontSize: 13, color: 'var(--dim)' }}>No pude copiarlo: selecciónalo y cópialo a mano.</p>}
              <p style={{ margin: 0, fontSize: 13, color: 'var(--dim)' }}>Al pagar, MaKo crea su cuenta y le manda el acceso.</p>
            </div>
          )}
        </WizardShell>
      )}
    </>
  );
}

function Opciones({ children }: { children: ReactNode }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>;
}

function Opcion({ activa, onClick, titulo, detalle }: { activa: boolean; onClick: () => void; titulo: string; detalle?: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={activa} style={{
      textAlign: 'left', padding: '12px 16px', borderRadius: 12, cursor: 'pointer',
      border: `1px solid ${activa ? 'var(--primary)' : 'var(--border-strong)'}`,
      background: activa ? 'var(--primary-bg)' : 'var(--surface)', color: 'var(--ink)', fontFamily: 'inherit',
    }}>
      <div style={{ fontSize: 15, fontWeight: 650 }}>{titulo}</div>
      {detalle && <div style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: 3, lineHeight: 1.45 }}>{detalle}</div>}
    </button>
  );
}

function Chips({ valor, opciones, onChange }: { valor: string; opciones: { v: string; l: string }[]; onChange: (v: string) => void }) {
  return (
    <div role="radiogroup" style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
      {opciones.map((o) => (
        <button key={o.v} type="button" role="radio" aria-checked={valor === o.v} onClick={() => onChange(o.v)} style={chip(valor === o.v)}>
          {o.l}
        </button>
      ))}
    </div>
  );
}

const chip = (activa: boolean): CSSProperties => ({
  padding: '7px 14px', borderRadius: 999, cursor: 'pointer', fontSize: 13.5, fontWeight: 600, fontFamily: 'inherit',
  border: `1px solid ${activa ? 'var(--primary)' : 'var(--border-strong)'}`,
  background: activa ? 'var(--primary-bg)' : 'var(--surface)', color: activa ? 'var(--primary)' : 'var(--dim)',
});

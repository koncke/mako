'use client';

// =============================================================================
// Calcular presupuesto — el modal del Ads Manager (⋯ → «Calcular presupuesto»)
// =============================================================================
// Pedido de Martín (22/10/2026): «la mayoría de emprendedores siempre tienen la duda de
// cuánto debo invertir». Entra lo que hay para pautar y lo que cuesta un resultado; sale
// cuántos avatares y funcionalidades se testean, cuánto por anuncio y por cuántos días.
//
// La cuenta NO vive acá: lib/calculadora-presupuesto-ads.ts (pura, con tests). Esta
// pantalla sólo junta los números y dibuja el plan. «Preguntarle a MaKo» manda el plan
// con sus números a la estrella de la tab (el `pedido` de MakoEnLaTab, el molde del
// Dashboard), y MaKo tiene la misma cuenta en la API (`calcular_presupuesto_anuncios`).
//
// Estructura copiada de las calculadoras de presupuesto (Omni Calculator, el «Planificador»
// de Google Ads): las entradas a la izquierda, el resultado a la derecha y se recalcula al
// tipear, sin botón «Calcular». En el teléfono se apilan.
// =============================================================================

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Button, Modal, Select, TextField, Alert, MONO } from '@/app/_ui';
import { MakoStar } from '../_components/MakoBrand';
import {
  calcularPresupuestoAds, titularDelPlan, textoParaMako, usd, plural, RESULTADOS_PARA_DECIDIR, RESULTADOS_APRENDIZAJE,
  type EntradaCalculadora, type Evento, type PlanCalculadora,
} from '@/lib/calculadora-presupuesto-ads';

type Campos = {
  presupuesto: string; dias: string; costo: string; evento: Evento; ticket: string; cierre: string;
  avatares: string; funcionalidades: string;
};
const INICIAL: Campos = { presupuesto: '', dias: '30', costo: '', evento: 'lead', ticket: '', cierre: '', avatares: '3', funcionalidades: '3' };
// Lo último que tipeó, en ESTE navegador: una comodidad, no un dato (se pierde en una ventana privada y está bien).
const CLAVE_LOCAL = 'mako.calculadora-presupuesto';

const numero = (s: string) => Number(s.replace(/\s/g, '').replace(',', '.'));

export function entradaDeCampos(c: Campos): EntradaCalculadora {
  return {
    presupuesto: numero(c.presupuesto), dias: numero(c.dias), costoPorResultado: numero(c.costo),
    evento: c.evento, ticket: numero(c.ticket), cierre: c.evento === 'lead' ? numero(c.cierre) : undefined,
    avatares: numero(c.avatares), funcionalidades: numero(c.funcionalidades),
  };
}

export function CalculadoraPresupuesto({ onCerrar, onPreguntarMako }: {
  onCerrar: () => void;
  /** Abre la estrella de la tab con el plan. Sin esto, el botón no se dibuja. */
  onPreguntarMako?: (texto: string) => void;
}) {
  const [c, setC] = useState<Campos>(INICIAL);
  useEffect(() => {
    try { const g = localStorage.getItem(CLAVE_LOCAL); if (g) setC({ ...INICIAL, ...JSON.parse(g) }); } catch { /* sin storage: arranca vacío */ }
  }, []);
  const poner = (k: keyof Campos) => (v: string) => setC((x) => {
    const n = { ...x, [k]: v };
    try { localStorage.setItem(CLAVE_LOCAL, JSON.stringify(n)); } catch { /* idem */ }
    return n;
  });

  const entrada = useMemo(() => entradaDeCampos(c), [c]);
  const plan = useMemo(() => calcularPresupuestoAds(entrada), [entrada]);
  const vacio = !c.presupuesto || !c.costo || !c.ticket;

  const campo = (k: keyof Campos, label: string, extra: { prefix?: string; suffix?: string; placeholder?: string } = {}) => (
    <TextField label={label} inputMode="decimal" value={c[k]} onChange={(e) => poner(k)(e.target.value)} {...extra} />
  );

  return (
    <Modal titulo="Calcular presupuesto" ancho={720} onCerrar={onCerrar}
      pie={<>
        {onPreguntarMako && plan.ok && !vacio && (
          <Button variant="mako" icon={<MakoStar size={13} />} onClick={() => onPreguntarMako(textoParaMako(entrada, plan))}>Preguntarle a MaKo</Button>
        )}
        <Button variant="secondary" onClick={onCerrar}>Cerrar</Button>
      </>}>
      <div style={GRILLA}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {campo('presupuesto', 'Presupuesto', { prefix: 'US$', placeholder: '2000' })}
          {campo('dias', 'Días de pauta', { suffix: 'días' })}
          <Select label="Optimizas a" value={c.evento} onChange={(v) => poner('evento')(String(v))}
            options={[{ value: 'lead', label: 'Lead o conversación' }, { value: 'venta', label: 'Venta' }]} />
          {campo('costo', c.evento === 'lead' ? 'Costo por lead' : 'Costo por venta', { prefix: 'US$', placeholder: c.evento === 'lead' ? '2.5' : '150' })}
          {campo('ticket', 'Ticket', { prefix: 'US$', placeholder: '1500' })}
          {c.evento === 'lead' && campo('cierre', 'Compran de cada 100', { placeholder: '1' })}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {campo('avatares', 'Avatares')}
            {campo('funcionalidades', 'Funcionalidades')}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
          {vacio ? (
            <div style={{ ...CAJA, color: 'var(--dim)', fontSize: 13.5 }}>Pon tu presupuesto, el costo por resultado y el ticket.</div>
          ) : !plan.ok ? (
            <div style={{ ...CAJA, color: 'var(--dim)', fontSize: 13.5 }}>{plan.error}</div>
          ) : (
            <Resultado plan={plan} />
          )}
        </div>
      </div>
    </Modal>
  );
}

function Resultado({ plan: p }: { plan: PlanCalculadora }) {
  const porAnuncio = p.rondas[0];
  return (
    <>
      <div style={CAJA}>
        <div style={EYEBROW}>Testea</div>
        <div style={{ fontSize: 22, fontWeight: 650, letterSpacing: '-0.01em', color: 'var(--ink)' }}>{titularDelPlan(p)}</div>
        {p.rondas.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
            {p.rondas.map((r, i) => (
              <div key={i} style={{ fontSize: 13, color: 'var(--dim)' }}>
                <span style={{ fontFamily: MONO, color: 'var(--faint)' }}>Semana {i + 1}</span>{' · '}
                {r.que === 'matriz' ? `${r.anuncios} anuncios` : r.que === 'avatares' ? `${r.anuncios} avatares` : `${r.anuncios} funcionalidades del avatar ganador`}
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
        {porAnuncio && <Stat label="Por anuncio" valor={`${usd(porAnuncio.diarioPorAnuncio)}/día`} sub={`${porAnuncio.dias} días · ${RESULTADOS_PARA_DECIDIR} resultados`} />}
        <Stat label="Testeo" valor={usd(p.testeo.gasto)} sub={plural(p.testeo.dias, 'día', 'días')} />
        <Stat label="Escala al ganador" valor={`${usd(p.escala.diario)}/día`} sub={plural(p.escala.dias, 'día', 'días')} />
        <Stat label="Ventas esperadas" valor={String(p.ventas)} sub={usd(p.facturacion)} />
      </div>
      {p.avisos.map((a) => <Alert key={a} tono="warn">{a}</Alert>)}
      <div style={{ fontSize: 12, color: 'var(--faint)' }}>
        Con {RESULTADOS_APRENDIZAJE} por ángulo (aprendizaje de Meta): {plural(p.angulosEstricto, 'ángulo', 'ángulos')}
      </div>
    </>
  );
}

function Stat({ label, valor, sub }: { label: string; valor: string; sub?: string }) {
  return (
    <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px', minWidth: 0 }}>
      <div style={{ fontSize: 11.5, color: 'var(--faint)' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 600, marginTop: 3, fontVariantNumeric: 'tabular-nums', color: 'var(--ink)' }}>{valor}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--dim)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

const GRILLA: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 22, alignItems: 'start' };
const CAJA: CSSProperties = { background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '13px 15px' };
const EYEBROW: CSSProperties = { fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 6 };

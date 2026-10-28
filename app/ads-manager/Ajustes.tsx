'use client';

// =============================================================================
// Media Buyer — Ajustes (/ads-manager/ajustes): la página «AI Marketer settings» de Madgicx, con lo que MaKo suma
// =============================================================================
// En Madgicx la tuerca abre una PÁGINA (vivo-ai-marketer-ajustes.jpg): «AI Marketer settings» con «Back», y una tarjeta
// «Optimization KPIs» por cuenta con «Primary KPI» y «Target value» (el recomendado por la IA o uno propio). Se copia esa
// estructura —título, volver, tarjetas— y en tarjetas aparte va lo que MaKo agrega y Madgicx no tiene (dicho acá): cómo
// trabaja (propone o piloto automático, y el interruptor), los topes del dinero, las metas del mes y la cuenta publicitaria.
// Lo que se guarda pasa por la misma puerta que siempre (POST /api/media-buyer, op config → lib/media-buyer/store.ts).
// =============================================================================

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button, RadioGroup, Select, Switch, TextField, Toast, useToast } from '@/app/_ui';
import { ConectarViaZernio } from '@/app/_components/ConectarViaZernio';
import type { ConfigMediaBuyer, KpiMediaBuyer } from '@/lib/media-buyer/tipos';
import { textoCupo, type CupoMediaBuyer } from '@/lib/media-buyer/plan';
import { RUTA_CAMBIAR_PLAN } from '@/lib/topes-plan';
import { leerMonto } from '@/lib/media-buyer/monto';

type Config = ConfigMediaBuyer & { ultimaCorrida: string | null; ultimaCorridaInfo: Record<string, unknown> | null; existeTabla: boolean };
type EstadoZernio = { tieneClave: boolean; cuenta: string | null; conectado: boolean };

const COSTO: Record<KpiMediaBuyer, string> = { lead: 'Costo por lead', agenda: 'Costo por agenda', venta: 'Costo por venta' };

async function api<T = Record<string, unknown>>(body: Record<string, unknown>): Promise<T & { ok: boolean; error?: string }> {
  const r = await fetch('/api/media-buyer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return (await r.json().catch(() => ({ ok: false, error: `Error ${r.status}` }))) as T & { ok: boolean; error?: string };
}

export function Ajustes({ config, cupo }: { config: Config; cupo: CupoMediaBuyer }) {
  const txt = (n: number | null) => (n == null ? '' : String(n));
  const [modo, setModo] = useState(config.modo);
  const [encendido, setEncendido] = useState(config.encendido);
  const [kpi, setKpi] = useState<KpiMediaBuyer>(config.kpi);
  const [objetivo, setObjetivo] = useState(txt(config.objetivo));
  const [subida, setSubida] = useState(String(config.subidaMaxPctDia));
  const [maxDia, setMaxDia] = useState(txt(config.presupuestoMaxDia));
  const [ventas, setVentas] = useState(txt(config.metaVentasMes));
  const [gasto, setGasto] = useState(txt(config.metaGastoMes));
  const [cuenta, setCuenta] = useState(config.cuentaPublicitaria ?? '');
  const [zernio, setZernio] = useState<EstadoZernio | null>(null);
  const [guardando, setGuardando] = useState(false);
  const { toast, show, clear } = useToast();
  const leerZernio = () => { void api<EstadoZernio>({ op: 'estado_zernio' }).then((r) => { if (r.ok) setZernio({ tieneClave: r.tieneClave, cuenta: r.cuenta, conectado: r.conectado }); }); };
  useEffect(leerZernio, []);

  // «1,500» es mil quinientos (revisión de tren-l, falla 4): un objetivo leído 1,5 disparaba el Stop Loss con US$3. Lo que
  // no se entiende va como NaN y el servidor lo rechaza con su mensaje.
  const num = (s: string): number | null => (s.trim() === '' ? null : leerMonto(s) ?? Number.NaN);
  const recomendado = config.ultimaCorridaInfo && typeof config.ultimaCorridaInfo.objetivo === 'number' && config.ultimaCorridaInfo.objetivoEsRecomendado ? config.ultimaCorridaInfo.objetivo as number : null;
  const guardar = async () => {
    setGuardando(true);
    const r = await api({ op: 'config', cambio: {
      modo, encendido, kpi, objetivo: num(objetivo), subidaMaxPctDia: Number(subida || 0), presupuestoMaxDia: num(maxDia),
      metaVentasMes: num(ventas), metaGastoMes: num(gasto), cuentaPublicitaria: cuenta.trim() || null,
    } });
    setGuardando(false);
    if (r.ok) show('Guardado', undefined, 'good'); else show(r.error ?? 'No se pudo guardar.', undefined, 'bad');
  };

  return (
    <div className="mb">
      <div className="mba-ajustes">
        <header className="mba-ajustes-cab">
          <h1><span aria-hidden>⚙️</span> Ajustes del Media Buyer</h1>
          <span style={{ display: 'flex', gap: 10 }}>
            <Link href="/ads-manager" className="mb-secundario mba-volver-btn">Volver</Link>
            <Button loading={guardando} disabled={!config.existeTabla} onClick={() => void guardar()}>Guardar</Button>
          </span>
        </header>

        {/* «Optimization KPIs» de Madgicx: el resultado que se busca y su valor objetivo, recomendado o propio. */}
        <section className="mba-card">
          <h2>KPI de optimización</h2>
          <div className="mba-card-cuenta"><span aria-hidden>📣</span>{config.cuentaPublicitaria ?? zernio?.cuenta ?? 'Tu cuenta publicitaria'}</div>
          <div className="mba-grilla">
            <Select label="Resultado principal" value={kpi} onChange={(v) => setKpi(v as KpiMediaBuyer)} options={[
              { value: 'lead', label: 'Leads' }, { value: 'agenda', label: 'Agendas (tu CRM)' }, { value: 'venta', label: 'Ventas (tu CRM)' },
            ]} />
            <TextField label={`${COSTO[kpi]} objetivo`} inputMode="decimal" value={objetivo} onChange={(e) => setObjetivo(e.target.value)}
              placeholder={recomendado ? `Recomendado por MaKo: ${recomendado}` : 'Recomendado por MaKo'} hint="En dólares. Vacío: lo calcula MaKo con tu cuenta." />
          </div>
        </section>

        <section className="mba-card">
          <h2>Cómo trabaja</h2>
          <RadioGroup label="Modo" value={modo} disabled={!cupo.piloto} onChange={(v) => setModo(v === 'piloto' ? 'piloto' : 'propone')} options={[
            { value: 'propone', label: 'Propone y yo apruebo', hint: 'Cada recomendación espera tu «Lanzar».' },
            { value: 'piloto', label: 'Piloto automático', hint: 'MaKo lanza solo, una vez por día, dentro de tus topes. Todo queda en «Hechas» con su «Deshacer».' },
          ]} />
          {cupo.piloto
            ? <p className="mk-hint" style={{ margin: 0 }}>Cada táctica puede tener el suyo en <Link href="/ads-manager/automatizaciones" className="mb-pro-link">Automatizaciones</Link>.</p>
            : <p className="mk-hint" style={{ margin: 0 }}>{cupo.recomendacionesDia != null ? textoCupo(cupo.recomendacionesDia) : 'El piloto automático es de MaKo Pro.'} <Link href={RUTA_CAMBIAR_PLAN} className="mb-pro-link">Pasar a Pro</Link></p>}
          <Switch checked={encendido} onChange={setEncendido} label="Media Buyer encendido" hint="Apagado, MaKo no mira tu cuenta ni lanza nada." />
        </section>

        <section className="mba-card">
          <h2>Topes</h2>
          <div className="mba-grilla">
            <TextField label="Subida máxima por día" inputMode="numeric" value={subida} onChange={(e) => setSubida(e.target.value)} suffix="%" />
            <TextField label="Presupuesto máximo por día" inputMode="decimal" value={maxDia} onChange={(e) => setMaxDia(e.target.value)} placeholder="Sin tope" hint="La suma de lo prendido, en dólares." />
          </div>
        </section>

        <section className="mba-card">
          <h2>Metas del mes</h2>
          <div className="mba-grilla">
            <TextField label="Meta de ventas del mes" inputMode="decimal" value={ventas} onChange={(e) => setVentas(e.target.value)} placeholder="Sin meta" />
            <TextField label="Gasto previsto del mes" inputMode="decimal" value={gasto} onChange={(e) => setGasto(e.target.value)} placeholder="Sin meta" />
          </div>
        </section>

        <section className="mba-card">
          <h2>Cuenta publicitaria</h2>
          <TextField label="Cuenta (act_…)" value={cuenta} onChange={(e) => setCuenta(e.target.value)} placeholder={zernio?.cuenta ?? 'act_123456789'}
            hint="Sólo si no está en Integraciones: la de Integraciones manda." />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: 14, color: 'var(--dim)' }}>
            {zernio?.conectado ? <span>Conectada por Zernio: MaKo puede crear anuncios nuevos.</span> : <span>Conéctala con tu Facebook para que MaKo cree anuncios nuevos.</span>}
            <ConectarViaZernio red="metaads" volver="/ads-manager/ajustes" adAccountId={zernio?.cuenta ?? null} size="sm" variant="secondary" onConectado={leerZernio}>
              {zernio?.conectado ? 'Reconectar' : 'Conectar con Facebook'}
            </ConectarViaZernio>
          </div>
        </section>
      </div>
      <Toast state={toast} onClose={clear} />
    </div>
  );
}

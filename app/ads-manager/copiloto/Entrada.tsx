'use client';

// =============================================================================
// Marketing CoPilot — la entrada (14/11/2026)
// =============================================================================
// La maqueta que Martín le mostró a Julio el 13/11: antes de los dos pasos, una pregunta por pantalla (por dónde vendes; con anuncios,
// qué campañas y cuánto inviertes; cuánto tiempo tienes para crear) y después «Lo que tienes»: conectar las redes que eligió. Lo que
// decide el código está en lib/copiloto/entrada.ts (puro, con test); se guarda con POST /api/copiloto/entrada. Aparece mientras el
// perfil no diga por dónde vende (`faltaLaEntrada`), y quien respondió la charla vieja la ve con lo que ya sabía marcado.
// Sin subtítulos chicos (14/11, el Cerebro mirando producción): cada pantalla es la pregunta y sus tarjetas.
// =============================================================================

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogoRed } from '@/app/competitor-spy/LogoRed';
import { BrandDefs } from '@/app/_components/ServicioVisual';
import { ConectarViaZernio } from '@/app/_components/ConectarViaZernio';
import { CriaturaMako } from '@/app/onboarding/CriaturaMako';
import { CSS_COPILOTO } from './copiloto-css';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import {
  CAMPANAS_ENTRADA, CANALES_ENTRADA, PRESUPUESTOS_ENTRADA, TIEMPOS_ENTRADA, pantallaLista, pantallasEntrada,
  type PantallaEntrada, type RespuestasEntrada,
} from '@/lib/copiloto/entrada';
import type { CanalEntrada } from '@/lib/media-buyer/copiloto';

export type ConexionesEntrada = Record<CanalEntrada, boolean>;

const CSS = `
.cop-ent { min-height: calc(100vh - 40px); display: flex; flex-direction: column; align-items: center; padding: clamp(24px, 6vh, 64px) 20px 48px; box-sizing: border-box; }
.cop-ent__col { width: 100%; max-width: 720px; display: flex; flex-direction: column; align-items: center; gap: 28px; margin: auto 0; }
.cop-ent__barra { display: flex; gap: 4px; width: 100%; max-width: 520px; }
.cop-ent__barra span { flex: 1; height: 3px; border-radius: 2px; background: var(--hair); transition: background .35s ease; }
.cop-ent__barra span[data-si="true"] { background: var(--ink); }
.cop-ent h2 { margin: 0; font-size: clamp(24px, 2.4vw, 32px); font-weight: 640; letter-spacing: -.02em; line-height: 1.2; text-align: center; color: var(--ink); }
.cop-ent__ops { width: 100%; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.cop-ent__ops[data-tres="true"] { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.cop-ent__op { position: relative; display: flex; flex-direction: column; align-items: flex-start; justify-content: center; gap: 6px; min-height: 84px;
  padding: 18px 52px 18px 20px; box-sizing: border-box; text-align: left; border-radius: 16px; border: 1px solid var(--hair); background: var(--card);
  color: var(--ink); font: inherit; cursor: pointer; transition: border-color .14s, box-shadow .14s; }
.cop-ent__op:hover { border-color: var(--ink); }
.cop-ent__op[aria-pressed="true"] { border-color: var(--ink); box-shadow: 0 0 0 1px var(--ink); }
.cop-ent__op[data-canal="true"] { min-height: 128px; justify-content: flex-start; gap: 14px; }
.cop-ent__t { font-size: 18px; font-weight: 600; }
.cop-ent__d { font-size: 15px; color: var(--muted); line-height: 1.4; }
.cop-ent__marca { position: absolute; top: 16px; right: 16px; width: 22px; height: 22px; border-radius: 50%; border: 1.5px solid var(--hair);
  display: grid; place-items: center; font-size: 13px; color: transparent; }
.cop-ent__op[aria-pressed="true"] .cop-ent__marca { background: var(--ink); border-color: var(--ink); color: var(--card); }
.cop-ent__pie { display: flex; justify-content: center; align-items: center; gap: 16px; min-height: 48px; }
.cop-ent__atras { background: none; border: 0; color: var(--muted); font: inherit; font-size: 15px; font-weight: 600; cursor: pointer; padding: 8px 4px; }
.cop-ent__atras:hover { color: var(--ink); }
.cop-ent__seguir:disabled { opacity: .45; cursor: default; }
.cop-ent__error { margin: 0; color: var(--bad); font-size: 15px; text-align: center; }
.cop-ent__fuentes { width: 100%; display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
.cop-ent__fuente { display: flex; flex-direction: column; gap: 14px; padding: 20px; border-radius: 16px; border: 1px solid var(--hair); background: var(--card); }
.cop-ent__fuente-cab { display: flex; align-items: center; gap: 12px; }
.cop-ent__ok { font-size: 15px; font-weight: 600; color: var(--good); }
@media (max-width: 640px) {
  .cop-ent__ops, .cop-ent__ops[data-tres="true"] { grid-template-columns: minmax(0, 1fr); }
  .cop-ent__op[data-canal="true"] { min-height: 0; flex-direction: row; align-items: center; }
}
`;

const NOMBRE_CANAL = Object.fromEntries(CANALES_ENTRADA) as Record<CanalEntrada, string>;
const RED_ZERNIO = { anuncios: 'metaads', instagram: 'instagram', youtube: 'youtube' } as const;

function Opcion({ sel, onClick, t, d, logo }: { sel: boolean; onClick: () => void; t: string; d?: string; logo?: CanalEntrada }) {
  return (
    <button type="button" className="cop-ent__op" aria-pressed={sel} data-canal={logo ? 'true' : undefined} onClick={onClick}>
      <span className="cop-ent__marca" aria-hidden="true">✓</span>
      {logo && <LogoRed red={logo} box={40} />}
      <span className="cop-ent__t">{t}</span>
      {d && <span className="cop-ent__d">{d}</span>}
    </button>
  );
}

export function Entrada({ inicial, conexiones }: { inicial: RespuestasEntrada; conexiones: ConexionesEntrada }) {
  const router = useRouter();
  const [r, setR] = useState<RespuestasEntrada>(inicial);
  const [i, setI] = useState(0);
  const [fuentes, setFuentes] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pantallas = pantallasEntrada(r.canales);
  const p: PantallaEntrada = pantallas[Math.min(i, pantallas.length - 1)];
  // Con ?entrada=1 (para cambiarla) un refresh volvería a la entrada: se va a la ruta limpia y se relee.
  const alAnalisis = () => { router.replace('/ads-manager/copiloto'); router.refresh(); };
  const alternar = <T,>(xs: readonly T[], x: T): T[] => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]);

  async function seguir() {
    if (i < pantallas.length - 1) { setI(i + 1); return; }
    setGuardando(true); setError(null);
    try {
      const res = await (await fetch('/api/copiloto/entrada', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(r) })).json() as { ok: boolean; error?: string };
      if (!res.ok) { setError(res.error || 'No pude guardarlo. Vuelve a intentarlo.'); return; }
      // Si ya está todo conectado, no hay nada que pedir: directo al análisis.
      if (r.canales.every((c) => conexiones[c])) alAnalisis(); else setFuentes(true);
    } catch {
      setError('No pude conectarme. Vuelve a intentarlo.');
    } finally {
      setGuardando(false);
    }
  }

  let cuerpo: React.ReactNode;
  if (fuentes) {
    cuerpo = (
      <>
        <h2>Conecta lo que tienes</h2>
        <div className="cop-ent__fuentes">
          {r.canales.map((c) => (
            <div key={c} className="cop-ent__fuente">
              <div className="cop-ent__fuente-cab"><LogoRed red={c} box={36} /><span className="cop-ent__t">{NOMBRE_CANAL[c]}</span></div>
              {conexiones[c]
                ? <span className="cop-ent__ok">✓ Conectado</span>
                : <ConectarViaZernio red={RED_ZERNIO[c]} volver="/ads-manager/copiloto" size="sm">Conectar</ConectarViaZernio>}
            </div>
          ))}
        </div>
        <div className="cop-ent__pie"><button type="button" className="frn-btn frn-btn--primary" onClick={() => alAnalisis()}>Ver mi análisis</button></div>
      </>
    );
  } else {
    const lista = pantallaLista(p, r);
    let titulo = '', ops: React.ReactNode = null;
    if (p === 'canales') {
      titulo = '¿Por dónde vendes?';
      ops = <div className="cop-ent__ops" data-tres="true">{CANALES_ENTRADA.map(([k, t]) => <Opcion key={k} sel={r.canales.includes(k)} t={t} logo={k} onClick={() => setR({ ...r, canales: alternar(r.canales, k) })} />)}</div>;
    } else if (p === 'campanas') {
      titulo = '¿Qué campañas haces o quieres hacer?';
      ops = <div className="cop-ent__ops">{CAMPANAS_ENTRADA.map((c) => <Opcion key={c.id} sel={r.campanas.includes(c.id)} t={c.t} d={c.d} onClick={() => setR({ ...r, campanas: alternar(r.campanas, c.id) })} />)}</div>;
    } else if (p === 'presupuesto') {
      titulo = '¿Cuánto quieres invertir en anuncios por mes?';
      ops = <div className="cop-ent__ops">{PRESUPUESTOS_ENTRADA.map(([v, t]) => <Opcion key={v} sel={r.presupuestoMes === v} t={t} onClick={() => setR({ ...r, presupuestoMes: v })} />)}</div>;
    } else {
      titulo = '¿Cuánto tiempo tienes para crear contenido?';
      ops = <div className="cop-ent__ops">{TIEMPOS_ENTRADA.map((x) => <Opcion key={x.id} sel={r.tiempo === x.id} t={x.t} onClick={() => setR({ ...r, tiempo: x.id })} />)}</div>;
    }
    cuerpo = (
      <>
        <div className="cop-ent__barra" aria-hidden="true">{[...pantallas, 'fuentes'].map((_, k) => <span key={k} data-si={k <= i} />)}</div>
        <h2>{titulo}</h2>
        {ops}
        {error && <p className="cop-ent__error" role="alert">{error}<ReportarASoporte error={error} accion="Guardar la entrada del Marketing CoPilot" /></p>}
        <div className="cop-ent__pie">
          {i > 0 && <button type="button" className="cop-ent__atras" onClick={() => setI(i - 1)}>← Atrás</button>}
          <button type="button" className="frn-btn frn-btn--primary cop-ent__seguir" disabled={!lista || guardando} onClick={() => void seguir()}>{guardando ? 'Guardando…' : 'Seguir'}</button>
        </div>
      </>
    );
  }
  return (
    <div className="frn frn--mono cop">
      <style>{CSS_COPILOTO}</style>
      <style>{CSS}</style>
      <BrandDefs />
      <main className="cop-ent">
        <div className="cop-ent__col">
          <CriaturaMako size={48} />
          {cuerpo}
        </div>
      </main>
    </div>
  );
}

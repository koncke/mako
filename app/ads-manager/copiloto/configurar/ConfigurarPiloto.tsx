'use client';

// =============================================================================
// Configurar el piloto automático (13/11/2026, vuelta 20 de la maqueta)
// =============================================================================
// La pantalla de la maqueta (`configuraciones()` en bloque-veinte.js), con lo de verdad del Media Buyer:
//   · «¿Cuánto inviertes por mes?» → la meta de gasto del mes y el tope por día (el mes / 30): «nunca gasto más que esto»;
//   · «¿Cuánto pagas como mucho por una agenda?» → el objetivo, ESCRITO (Martín: «el costo por agenda se escribe»), en la unidad
//     del resultado del negocio (agenda, lead o venta);
//   · «¿Cuánto subo el presupuesto por vez, en cada campaña?» → el tope de subida por campaña y el salto de Surf;
//   · «Qué hago solo»: cada táctica en «Lo hago solo» (automática) o «Te pregunto» (propone). Sin el plan que trae el piloto, todo
//     queda en «Te pregunto» (lib/media-buyer/plan.ts → modoEfectivo).
// «Guardar y prender el piloto» manda UN cambio a /api/media-buyer (`op: 'config'`), el mismo que usan sus Ajustes.
// Instagram y YouTube (14/11, lib/copiloto/piloto-redes.ts): cuánto publica (el ritmo de la nevera), lo que hago solo (publicar lo
// programado, avisar si se acaba el contenido) y lo que te propongo como tarea. Se guarda con POST /api/copiloto/piloto (op 'redes'
// y 'aviso-nevera'). La web y la oferta todavía no tienen piloto.
// =============================================================================

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Toast, useToast } from '@/app/_ui';
import { LogoRed } from '@/app/competitor-spy/LogoRed';
import type { KpiMediaBuyer } from '@/lib/media-buyer/tipos';
import type { ConfigTacticas } from '@/lib/media-buyer/tacticas';
import type { NumeroDelReel } from '@/lib/copiloto/piloto';
import { TOPES_PILOTO, type PilotoInstagram, type PilotoYoutube } from '@/lib/copiloto/piloto-redes';

type Canal = 'anuncios' | 'instagram' | 'youtube';
export type RedesPiloto = { instagram: PilotoInstagram; youtube: PilotoYoutube; avisoNevera: boolean };

/** Un número con − y +, entre sus topes. */
function Paso({ valor, tope, set, etiqueta }: { valor: number; tope: readonly [number, number]; set: (n: number) => void; etiqueta: string }) {
  return (
    <div className="mq-paso" role="group" aria-label={etiqueta}>
      <button type="button" aria-label="Menos" disabled={valor <= tope[0]} onClick={() => set(Math.max(tope[0], valor - 1))}>−</button>
      <output className="frn-num">{valor}</output>
      <button type="button" aria-label="Más" disabled={valor >= tope[1]} onClick={() => set(Math.min(tope[1], valor + 1))}>+</button>
    </div>
  );
}
/** Un interruptor con sus dos palabras («Lo hago solo» / «No», «Te pregunto» / «No»). */
function Interr({ on, set, si, no = 'No', fijo }: { on: boolean; set?: (v: boolean) => void; si: string; no?: string; fijo?: boolean }) {
  return (
    <button type="button" className="mq-interr" role="switch" aria-checked={on} disabled={fijo} onClick={() => set?.(!on)}>
      <i /><span>{on ? si : no}</span>
    </button>
  );
}
import { CSS_COPILOTO } from '../copiloto-css';

type TacticaSola = 'stop_loss' | 'surf' | 'sunsetting' | 'ganador';
export type InicialPiloto = {
  encendido: boolean; kpi: KpiMediaBuyer; objetivo: number | null; metaGastoMes: number | null;
  subida: number; solo: Record<TacticaSola, boolean>;
  /** Lo guardado de TODAS las tácticas: el cambio las manda enteras, así que se parte de lo que había (calidad y revive incluidas). */
  tacticas: ConfigTacticas;
};

const RESULTADO: Record<KpiMediaBuyer, [string, string]> = { lead: ['un lead', 'leads'], agenda: ['una agenda', 'agendas'], venta: ['una venta', 'ventas'] };
// Lo que hay que saber va en la frase misma: sin renglón gris debajo (Martín: «no pongas subtítulos abajo en ningún lugar»).
const QUE_HAGO: ReadonlyArray<readonly [TacticaSola, (r: string) => string]> = [
  ['stop_loss', (r) => `Apagar el anuncio que gastó el doble de tu costo sin traer ${r}`],
  ['surf', (r) => `Subir la campaña que trae ${r} baratas`],
  ['sunsetting', () => 'Bajar lo que se encarece, y apagarlo si no se recupera'],
  ['ganador', () => 'Probar variaciones del anuncio que mejor convierte'],
];

const CSS = `
.frn .mq-cfg__cab { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 16px; }
.frn .mq-cfg__cab h1 { margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -.02em; color: var(--ink); text-align: center; }
.frn .mq-cfg__cab .frn-btn { min-width: 0; }
.frn .mq-cfg__cuerpo { display: grid; grid-template-columns: 260px minmax(0, 1fr); gap: var(--gap); align-items: start; margin-top: var(--gap); }
.frn .mq-cfg__nav { display: flex; flex-direction: column; gap: 6px; padding: 10px; border-radius: var(--r-md); background: var(--card); box-shadow: inset 0 0 0 1px var(--hair); }
.frn .mq-cfg__nav button, .frn .mq-cfg__nav .mq-cfg__item { all: unset; box-sizing: border-box; display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 12px; font-size: 15.5px; font-weight: 600; color: var(--ink); cursor: pointer; }
.frn .mq-cfg__nav [aria-current="page"] { background: var(--ink); color: var(--card); }
.frn .mq-cfg__hoja { padding: 24px 28px; }
.frn .mq-cfg__hoja h3 { margin: 22px 0 2px; font-size: 14px; letter-spacing: .04em; text-transform: uppercase; color: var(--muted); font-weight: 700; }
.frn .mq-cfg__hoja .frn-card__t + h3 { margin-top: 10px; }
.frn .mq-aj { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px 0; border-bottom: 1px solid var(--hair); }
.frn .mq-aj > div:first-child { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.frn .mq-aj b { font-size: 16px; font-weight: 600; color: var(--ink); }
.frn .mq-aj span { font-size: 14.5px; line-height: 1.45; color: var(--muted); }
.frn .mq-paso { display: inline-flex; align-items: center; border-radius: 12px; box-shadow: inset 0 0 0 1.5px var(--hair); flex: none; }
.frn .mq-paso button { width: 36px; height: 40px; border: 0; background: transparent; font-size: 18px; color: var(--ink); cursor: pointer; border-radius: 12px; }
.frn .mq-paso output { min-width: 96px; text-align: center; font-size: 17px; font-weight: 700; color: var(--ink); }
.frn .mq-escribe { display: inline-flex; align-items: center; gap: 8px; height: 40px; padding: 0 12px; border-radius: 12px; box-shadow: inset 0 0 0 1.5px var(--ink); flex: none; }
.frn .mq-escribe span { font-size: 15px; font-weight: 700; color: var(--ink); }
.frn .mq-escribe input { all: unset; width: 72px; font: 700 17px/1 var(--font); color: var(--ink); }
.frn .mq-interr { all: unset; display: inline-flex; align-items: center; gap: 10px; cursor: pointer; flex: none; }
.frn .mq-interr i { position: relative; width: 42px; height: 24px; border-radius: 999px; background: var(--hair); transition: background .15s; }
.frn .mq-interr i::after { content: ''; position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: var(--card); box-shadow: 0 1px 2px #0003; transition: transform .15s; }
.frn .mq-interr[aria-checked="true"] i { background: var(--ink); }
.frn .mq-interr[aria-checked="true"] i::after { transform: translateX(18px); }
.frn .mq-interr[disabled] { cursor: default; opacity: .6; }
.frn .mq-interr > span { font-size: 15px; color: var(--muted); min-width: 92px; }
.frn .mq-seguidos { list-style: none; margin: 12px 0; padding: 12px 14px; border-radius: 14px; background: var(--panel); display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px 18px; }
.frn .mq-seguidos li { display: flex; justify-content: space-between; gap: 10px; font-size: 15px; color: var(--muted); }
.frn .mq-seguidos b { color: var(--ink); }
.frn .mq-cfg__nota { margin: 14px 0 0; padding: 12px 14px; border-radius: 12px; background: var(--panel); font-size: 15px; line-height: 1.5; color: var(--muted); }
.frn .mq-cfg__pie { display: flex; justify-content: flex-end; margin-top: var(--gap); }
.frn .mq-cfg__par { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
.frn .mq-paso button:disabled { color: var(--hair); cursor: default; }
@container frn (max-width: 900px) {
  .frn .mq-cfg__cuerpo { grid-template-columns: minmax(0, 1fr); } /* con 1fr, lo ancho de adentro la estiraba más que la pantalla */
  .frn .mq-cfg__nav { flex-direction: row; overflow-x: auto; }
  /* Con YouTube son tres (14/11): a 375 la tercera quedaba cortada. Repartidas, y sólo el nombre. */
  .frn .mq-cfg__nav { overflow-x: visible; }
  .frn .mq-cfg__nav > button { flex: 1 1 0; min-width: 0; justify-content: center; padding: 10px 6px; }
  .frn .mq-cfg__nav > button > :first-child { display: none !important; } /* el logo trae su display en línea */
  .frn .mq-cfg__hoja { padding: 18px 16px; }
  .frn .mq-cfg__cab h1 { font-size: 18px; text-align: left; }
  .frn .mq-cfg__cab { grid-template-columns: auto minmax(0, 1fr); }
  .frn .mq-aj { flex-direction: column; align-items: flex-start; }
  .frn .mq-cfg__pie .frn-btn { width: 100%; }
}
`;

const plata = (n: number) => `US$ ${n.toLocaleString('es')}`;

export function ConfigurarPiloto({ inicial, pilotoPermitido, reel, canalInicial, publicosMeta, redes }: {
  inicial: InicialPiloto; pilotoPermitido: boolean; reel: NumeroDelReel | null; canalInicial: Canal;
  /** El piloto de Instagram y YouTube, o null si no se pudo leer (las pestañas quedan sólo con lo de antes). */
  redes: RedesPiloto | null;
  /** Los dos públicos de Meta del retargeting (lib/retargeting.ts), o null si no se pudo leer (no se muestra el interruptor). */
  publicosMeta: boolean | null;
}) {
  const [publicos, setPublicos] = useState(publicosMeta ?? false);
  const router = useRouter();
  const [canal, setCanal] = useState<Canal>(canalInicial === 'youtube' && !redes ? 'instagram' : canalInicial);
  const [ig, setIg] = useState<PilotoInstagram | null>(redes?.instagram ?? null);
  const [yt, setYt] = useState<PilotoYoutube | null>(redes?.youtube ?? null);
  const [aviso, setAviso] = useState(redes?.avisoNevera ?? true);
  const [numero, setNumero] = useState(reel?.numero ?? 1000);
  const { toast, show, clear } = useToast();
  const [mes, setMes] = useState(inicial.metaGastoMes ?? 1000);
  const [costo, setCosto] = useState(inicial.objetivo != null ? String(inicial.objetivo) : '');
  const [subida, setSubida] = useState(Math.min(50, Math.max(5, inicial.subida || 20)));
  const [solo, setSolo] = useState(inicial.solo);
  const [guardando, setGuardando] = useState(false);
  const [r1, rN] = RESULTADO[inicial.kpi];

  const guardar = async () => {
    const objetivo = Number(costo.replace(/[^\d.,]/g, '').replace(',', '.'));
    if (!Number.isFinite(objetivo) || objetivo <= 0) { show(`Escribe cuánto pagas como mucho por ${r1}.`, undefined, 'bad'); return; }
    const tacticas: ConfigTacticas = { ...inicial.tacticas };
    for (const [t] of QUE_HAGO) {
      const antes = inicial.tacticas[t] ?? {};
      tacticas[t] = { ...antes, estado: solo[t] && pilotoPermitido ? 'automatica' : 'propone', ...(t === 'surf' ? { parametros: { ...(antes.parametros ?? {}), subidaPct: subida } } : {}) };
    }
    setGuardando(true);
    try {
      const r = await (await fetch('/api/media-buyer', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ op: 'config', cambio: {
          encendido: true, modo: pilotoPermitido ? 'piloto' : 'propone', objetivo, metaGastoMes: mes,
          presupuestoMaxDia: Math.max(1, Math.round(mes / 30)), subidaMaxPctDia: subida, tacticas,
        } }),
      })).json() as { ok: boolean; error?: string };
      if (!r.ok) { show(r.error || 'No se pudo guardar.', undefined, 'bad'); return; }
      // Los públicos del retargeting, sólo si cambiaron (lo pide el botón de quien administra: nunca la carga de la página).
      if (publicosMeta != null && publicos !== publicosMeta) {
        const rt = await (await fetch('/api/copiloto/piloto', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ op: 'retargeting', publicosMeta: publicos }) })).json() as { ok: boolean; error?: string };
        if (!rt.ok) { show(rt.error || 'Guardé el piloto, pero no pude cambiar los públicos de Meta.', undefined, 'bad'); return; }
      }
      show('Listo: el piloto está prendido.', undefined, 'good');
      router.push('/ads-manager/copiloto?paso=piloto&tarjeta=anuncios');
    } catch (e) {
      show(e instanceof Error ? e.message : 'No pude conectarme.', undefined, 'bad');
    } finally { setGuardando(false); }
  };

  const pedir = async (body: Record<string, unknown>) => (await (await fetch('/api/copiloto/piloto', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).json()) as { ok: boolean; error?: string };
  const guardarRed = async (red: 'instagram' | 'youtube') => {
    setGuardando(true);
    try {
      if (red === 'instagram') {
        const r = await pedir({ op: 'reel', numero });
        if (!r.ok) { show(r.error || 'No se pudo guardar.', undefined, 'bad'); return; }
      }
      if (redes) {
        const r = await pedir({ op: 'redes', [red]: red === 'instagram' ? ig : yt });
        if (!r.ok) { show(r.error || 'No se pudo guardar.', undefined, 'bad'); return; }
        if (aviso !== redes.avisoNevera) {
          const a = await pedir({ op: 'aviso-nevera', prendido: aviso });
          if (!a.ok) { show(a.error || 'Guardé el piloto, pero no pude cambiar el aviso.', undefined, 'bad'); return; }
        }
      }
      show(`Listo: guardé el piloto de ${red === 'instagram' ? 'Instagram' : 'YouTube'}.`, undefined, 'good');
      router.push(`/ads-manager/copiloto?paso=piloto&tarjeta=${red}`);
    } catch (e) {
      show(e instanceof Error ? e.message : 'No pude conectarme.', undefined, 'bad');
    } finally { setGuardando(false); }
  };

  return (
    <div className="frn frn--mono cop">
      <style>{CSS_COPILOTO}</style>
      <style>{CSS}</style>
      <main className="frn-board mq-cfg">
        <div className="frn-head mq-cfg__cab">
          <Link className="frn-btn frn-btn--ghost" href="/ads-manager/copiloto?paso=piloto&tarjeta=anuncios">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m15 6-6 6 6 6" /></svg>Volver
          </Link>
          <h1>Configurar el piloto automático</h1><span />
        </div>
        <div className="mq-cfg__cuerpo">
          <nav className="mq-cfg__nav" aria-label="Qué configuras">
            <button type="button" aria-current={canal === 'anuncios' ? 'page' : undefined} onClick={() => setCanal('anuncios')}><LogoRed red="anuncios" box={26} /><span>Anuncios</span></button>
            <button type="button" aria-current={canal === 'instagram' ? 'page' : undefined} onClick={() => setCanal('instagram')}><LogoRed red="instagram" box={26} /><span>Instagram</span></button>
            {redes && <button type="button" aria-current={canal === 'youtube' ? 'page' : undefined} onClick={() => setCanal('youtube')}><LogoRed red="youtube" box={26} /><span>YouTube</span></button>}
          </nav>
          {canal === 'instagram' ? (
            <section className="frn-card mq-cfg__hoja">
              <h2 className="frn-card__t">Instagram</h2>
              <h3>Cuánto</h3>
              <div className="mq-aj">
                <div><b>¿Con cuántas vistas se publica un reel de prueba?</b></div>
                <div className="mq-paso"><button type="button" aria-label="Menos" onClick={() => setNumero((n) => Math.max(100, n - 100))}>−</button><output className="frn-num">{numero.toLocaleString('es')}</output><button type="button" aria-label="Más" onClick={() => setNumero((n) => n + 100)}>+</button></div>
              </div>
              {/* De dónde sale lo que propongo: las cuentas que sigues en Competitor Spy y lo que suele hacer cada una. */}
              <p className="mq-cfg__nota">{reel?.propuesto != null ? `Te propongo ${reel.propuesto.toLocaleString('es')}: el promedio de las cuentas que sigues.` : reel?.explicacion ?? 'Elige a tus competidores en Competitor Spy y te propongo el número.'}</p>
              {reel && reel.competidores.length > 0 && (
                <ul className="mq-seguidos">{reel.competidores.map((c) => <li key={c.nombre}><span>{c.nombre}</span><b>{c.mediana != null ? c.mediana.toLocaleString('es') : '—'}</b></li>)}</ul>
              )}
              {reel?.propuesto != null && numero !== reel.propuesto && <button type="button" className="frn-btn frn-btn--ghost" onClick={() => setNumero(reel.propuesto!)}>Volver a lo que propongo</button>}
              {ig && (
                <>
                  <div className="mq-aj"><div><b>¿Cuántos reels publicas por semana?</b></div><Paso etiqueta="Reels por semana" valor={ig.reelsSemana} tope={TOPES_PILOTO.reelsSemana} set={(n) => setIg({ ...ig, reelsSemana: n })} /></div>
                  <div className="mq-aj"><div><b>¿Cuántos carruseles?</b></div><Paso etiqueta="Carruseles por semana" valor={ig.carruselesSemana} tope={TOPES_PILOTO.carruselesSemana} set={(n) => setIg({ ...ig, carruselesSemana: n })} /></div>
                  <div className="mq-aj"><div><b>¿Cuántas historias?</b></div><Paso etiqueta="Historias por semana" valor={ig.historiasSemana} tope={TOPES_PILOTO.historiasSemana} set={(n) => setIg({ ...ig, historiasSemana: n })} /></div>
                  <h3>Qué hago solo</h3>
                  <div className="mq-aj"><div><b>Publicar lo que programas en el Calendario</b></div><Interr on fijo si="Lo hago solo" /></div>
                  <div className="mq-aj"><div><b>Avisarte por WhatsApp y email si se acaba el contenido</b></div><Interr on={aviso} set={setAviso} si="Lo hago solo" /></div>
                  <h3>Qué te pregunto</h3>
                  <div className="mq-aj"><div><b>Variaciones del hook de tu reel más visto, cada semana</b></div><div className="mq-cfg__par">{ig.proponerHook && <Paso etiqueta="Cuántas variaciones" valor={ig.variaciones} tope={TOPES_PILOTO.variaciones} set={(n) => setIg({ ...ig, variaciones: n })} />}<Interr on={ig.proponerHook} set={(v) => setIg({ ...ig, proponerHook: v })} si="Te pregunto" /></div></div>
                  <div className="mq-aj"><div><b>Pasar a carrusel el reel que supera tu número</b></div><Interr on={ig.proponerCarrusel} set={(v) => setIg({ ...ig, proponerCarrusel: v })} si="Te pregunto" /></div>
                </>
              )}
            </section>
          ) : canal === 'youtube' && yt ? (
            <section className="frn-card mq-cfg__hoja">
              <h2 className="frn-card__t">YouTube</h2>
              <h3>Cuánto</h3>
              <div className="mq-aj"><div><b>¿Cuántos videos largos subes por mes?</b></div><Paso etiqueta="Videos largos por mes" valor={yt.largosMes} tope={TOPES_PILOTO.largosMes} set={(n) => setYt({ ...yt, largosMes: n })} /></div>
              <div className="mq-aj"><div><b>¿Cuántos shorts sacas de cada video largo?</b></div><Paso etiqueta="Shorts por video" valor={yt.shortsPorVideo} tope={TOPES_PILOTO.shortsPorVideo} set={(n) => setYt({ ...yt, shortsPorVideo: n })} /></div>
              <h3>Qué hago solo</h3>
              <div className="mq-aj"><div><b>Publicar lo que programas en el Calendario</b></div><Interr on fijo si="Lo hago solo" /></div>
              <div className="mq-aj"><div><b>Avisarte por WhatsApp y email si se acaba el contenido</b></div><Interr on={aviso} set={setAviso} si="Lo hago solo" /></div>
              <h3>Qué te pregunto</h3>
              <div className="mq-aj"><div><b>Sacar shorts de tu último video largo, cada semana</b></div><Interr on={yt.proponerShorts} set={(v) => setYt({ ...yt, proponerShorts: v })} si="Te pregunto" /></div>
            </section>
          ) : (
          <section className="frn-card mq-cfg__hoja">
            <h2 className="frn-card__t">Anuncios</h2>
            <h3>Cuánto</h3>
            <div className="mq-aj">
              <div><b>¿Cuánto puedo gastar por mes, como mucho?</b></div>
              <div className="mq-paso"><button type="button" aria-label="Menos" onClick={() => setMes((m) => Math.max(100, m - 100))}>−</button><output className="frn-num">{plata(mes)}</output><button type="button" aria-label="Más" onClick={() => setMes((m) => m + 100)}>+</button></div>
            </div>
            <div className="mq-aj">
              <div><b>¿Desde qué costo por {r1.replace(/^una? /, '')} freno un anuncio?</b></div>
              <label className="mq-escribe"><span>US$</span><input type="text" inputMode="decimal" value={costo} placeholder="30" aria-label={`Lo que pagas como mucho por ${r1}, en dólares`} onChange={(e) => setCosto(e.target.value)} /></label>
            </div>
            <div className="mq-aj">
              <div><b>Si una campaña trae {rN} baratas, ¿cuánto la subo por vez?</b></div>
              <div className="mq-paso"><button type="button" aria-label="Menos" onClick={() => setSubida((s) => Math.max(5, s - 5))}>−</button><output className="frn-num">+ {subida} %</output><button type="button" aria-label="Más" onClick={() => setSubida((s) => Math.min(50, s + 5))}>+</button></div>
            </div>
            <h3>Qué hago solo</h3>
            {QUE_HAGO.map(([t, titulo]) => {
              const s = solo[t] && pilotoPermitido;
              return (
                <div key={t} className="mq-aj">
                  <div><b>{titulo(rN)}</b></div>
                  <button type="button" className="mq-interr" role="switch" aria-checked={s} disabled={!pilotoPermitido} onClick={() => setSolo((v) => ({ ...v, [t]: !v[t] }))}>
                    <i /><span>{s ? 'Lo hago solo' : 'Te pregunto'}</span>
                  </button>
                </div>
              );
            })}
            {publicosMeta != null && (
              <div className="mq-aj">
                <div><b>Mantener en Meta dos públicos: los que no avanzaron en tus chats y los que ya compraron</b></div>
                <button type="button" className="mq-interr" role="switch" aria-checked={publicos} onClick={() => setPublicos((v) => !v)}>
                  <i /><span>{publicos ? 'Lo hago solo' : 'No'}</span>
                </button>
              </div>
            )}
            {!pilotoPermitido && <p className="mq-cfg__nota">Con tu plan te propongo cada cambio y tú lo apruebas en el piloto.</p>}
          </section>
          )}
        </div>
        <div className="mq-cfg__pie">
          {canal !== 'anuncios'
            ? <button type="button" className="frn-btn frn-btn--primary" disabled={guardando} onClick={() => void guardarRed(canal)}>{guardando ? 'Guardando…' : 'Guardar'}</button>
            : <button type="button" className="frn-btn frn-btn--primary" disabled={guardando} onClick={guardar}>{guardando ? 'Guardando…' : inicial.encendido ? 'Guardar' : 'Guardar y prender el piloto'}</button>}
        </div>
      </main>
      <Toast state={toast} onClose={clear} />
    </div>
  );
}

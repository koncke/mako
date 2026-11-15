// =============================================================================
// La calculadora de MaKo Tokens de /planes (14/11/2026)
// =============================================================================
// Martín (14/11/2026): «estaría bueno como lo tienen otros en pricing, hacer como la calculadora en donde tú puedes arrastrar para
// calcular la cantidad de tokens. Y que vaya cambiando como el pricing según la cantidad de token que quieras».
// La segunda vuelta (14/11/2026, Martín): ARRIBA de las tres columnas, como en toda página de precios; arranca en los MaKo Tokens
// que trae el plan elegido (Esencial o Pro); la cuenta, revisada; y más cosas que la persona entiende, no sólo video e imágenes.
//
// EL DISEÑO, COPIADO DE ElevenLabs (elevenlabs.io/pricing, «Calculate your costs based on your usage needs», mirada el 14/11/2026
// con Chromium sin imágenes): a la izquierda el título y los pasos numerados (1, elegir; 2, una barra GRUESA que se llena, con el
// valor adentro y los extremos debajo); a la derecha UNA tarjeta con el plan, su precio arriba a la derecha, lo que trae con ✓ y el
// botón a todo el ancho abajo. Lo nuestro: el paso 1 elige el plan (no funciones), la parte que ya trae el plan va pintada de azul
// desde el arranque, y el paso 3 dice lo que gasta cada cosa.
//
// LOS NÚMEROS NO SE ESCRIBEN ACÁ:
//   · lo que trae cada plan: `CUPO_MENSUAL` (lib/mako-tokens-reglas.ts) por la capa del plan (`PLAN_DE_CAPA`): 11.750 Esencial,
//     24.250 Pro. ⚠️ Sus claves son `pro` = Esencial y `growth` = Pro (los nombres de agosto).
//   · el video que entra en el plan tiene su propio TOPE: `CLIPS_POR_MES` (lib/mako-tokens-paquetes.ts): 6 clips (1 minuto) en
//     Esencial y 36 (6 minutos) en Pro. Con los tokens solos, el de US$47 diría «23 clips» y el de US$97 «48»: el tope manda.
//   · lo que se suma: `paqueteDeMinutos` (el clip de 10 s a US$2 y 500 MaKo Tokens, Martín, 7/11). Es una compra SUELTA (el
//     ledger la anota como `compra`, supabase/migrations/0412_mako_tokens.sql), no un aumento del abono: por eso el precio dice
//     «este mes» y separa el plan de lo que se suma. Los paquetes se nombran en minutos de video: lo comprado SÍ es video.
//   · lo que gasta cada cosa: `COSTO_POR_ACCION`, abajo, con su fuente.
// Un script chico (`data-visor`) mueve los números: anda sin React y también en el visor de las landings. Sin <button>: el plan
// se elige con dos radios (como el mensual/anual de las tarjetas).
// =============================================================================

import type { CSSProperties } from 'react';
import { botonDelPlan } from '@/lib/compra-plan-reglas';
import { CLIPS_POR_MES, MT_POR_CLIP, paqueteDeMinutos } from '@/lib/mako-tokens-paquetes';
import { CUPO_MENSUAL, PLAN_DE_CAPA, mtDeImagenes } from '@/lib/mako-tokens-reglas';
import { TOPES } from '@/lib/topes-plan';

const mil = (n: number) => n.toLocaleString('es-AR');

/** Los minutos de video que se pueden sumar: de a uno al principio (como los paquetes: 1, 2, 4, 8) y más grueso después. */
const EXTRA_MINUTOS = [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20] as const;

/**
 * LO QUE GASTA CADA COSA, en MaKo Tokens, y lo que NO gasta (14/11/2026). Una sola tabla: la dibuja la calculadora y la cosecha
 * la cita (docs/hallazgos-planes-y-cobro.md). `mt: null` = no gasta MaKo Tokens, y `porque` dice con qué se paga.
 *
 * Sólo DOS cosas gastan MaKo Tokens en el código, y las dos son medios:
 *   · el clip de video de 10 s: `MT_POR_CLIP` = 500 (lib/mako-tokens-paquetes.ts). Costo medido el 7/11: US$0,412 con su imagen
 *     de referencia (Omni Flash, US$0,15 fijos + US$0,025/s). El modelo por defecto de la API de MaKo hoy es MiniMax-Hailuo-2.3-Fast
 *     a US$0,0253/s (lib/apimart-reglas.ts): 253 + 12 = 265 de costo. Los 500 cubren cualquiera de los dos.
 *   · la imagen: `mtDeImagenes(1)` = 12 (US$0,012, FLUX.2 dev, `USD_POR_IMAGEN.normal`, lib/mako-tokens-reglas.ts). La de calidad
 *     alta (`premium`, 47) existe en la regla pero ninguna pantalla la ofrece: no se dibuja.
 * Lo demás que la persona preguntaría NO gasta MaKo Tokens, y ponerle un número sería inventar un cobro:
 *   · seguir a la competencia es un TOPE del plan, no un gasto: 1 competidor en Esencial, sin tope en Pro (`spy.competidores`,
 *     lib/topes-plan.ts). Y cada lectura va con la cuenta de Apify del negocio (lib/spy-claves.ts).
 *   · guiones, copys, transcripciones, respuestas del setter y análisis de ofertas corren con la IA DEL NEGOCIO (su Claude o su
 *     ChatGPT): `conSuIADelNegocio` (lib/ia-del-negocio.ts; decisión de Martín del 22/10: «cada negocio paga su IA»). La
 *     transcripción de un reel de la competencia, igual (lib/spy-transcripcion-servidor.ts: «lo escucha la IA del negocio»).
 * ⚠️ Y NADA DESCUENTA TODAVÍA: la tabla del saldo existe (0412_mako_tokens.sql) pero ningún código acredita el cupo ni resta un
 * gasto (grep `mako_tokens_movimientos`: sólo la nombran las listas de tablas). Esto es la REGLA que va a aplicar el medidor.
 */
export const COSTO_POR_ACCION: ReadonlyArray<{ que: string; mt: number | null; porque?: 'competidores' | 'su-ia' }> = [
  { que: 'Un clip de video de 10 segundos', mt: MT_POR_CLIP },
  { que: 'Una imagen', mt: mtDeImagenes(1) },
  { que: 'Seguir a tu competencia', mt: null, porque: 'competidores' },
  { que: 'Guiones, copys y transcripciones', mt: null, porque: 'su-ia' },
  { que: 'Respuestas del setter y análisis de ofertas', mt: null, porque: 'su-ia' },
];

/** El plan como lo necesita la calculadora (lo pasa la vitrina). */
export type PlanCalculadora = { id: string; nombre: string; capa: string; precioUsd: number; cobrable: boolean; destacado?: boolean };

export type PasoTokens = {
  /** Los MaKo Tokens del mes: los del plan más los que se suman. */
  mt: string;
  /** Lo que sale: el plan, o el plan más lo que se suma. */
  usd: string;
  periodo: string;
  /** Debajo del nombre: de dónde sale el precio. */
  nota: string;
  extra: string;
  video: string;
  img: string;
  /** Lo que dice la barra por dentro. */
  barra: string;
  /** Cuánto de la barra va lleno, de 0 a 100. */
  pct: number;
};

export type DatosPlan = {
  id: string; nombre: string; corto: string; usdPlan: number; incluidos: string; competidores: string; href: string; boton: string;
  pasos: PasoTokens[];
};

/** «6 minutos de video», «1 minuto de video», «50 segundos de video». */
export function textoVideo(clips: number): string {
  const s = clips * 10;
  const m = Math.floor(s / 60), r = s % 60;
  if (m === 0) return `${r} segundos de video`;
  return `${m} ${m === 1 ? 'minuto' : 'minutos'}${r ? ` y ${r} segundos` : ''} de video`;
}

/** Los pasos de la barra para un plan, o null si la capa del plan no trae MaKo Tokens. Puro: lo prueba el test. */
export function datosDelPlan(p: PlanCalculadora, sufijo = ''): DatosPlan | null {
  const clave = PLAN_DE_CAPA[p.capa];
  if (!clave) return null;
  const mtPlan = CUPO_MENSUAL[clave];
  // El video del plan: lo que pagan sus tokens, pero nunca más que su tope de clips (el que el medidor hace cumplir).
  const clipsPlan = Math.min(CLIPS_POR_MES[clave], Math.floor(mtPlan / MT_POR_CLIP));
  const mtImagen = mtDeImagenes(1);
  const maxMt = mtPlan + paqueteDeMinutos(EXTRA_MINUTOS[EXTRA_MINUTOS.length - 1]).mt;
  const base = (mtPlan / maxMt) * 100;
  const pasos = EXTRA_MINUTOS.map((m, i): PasoTokens => {
    const extra = paqueteDeMinutos(m);
    const total = mtPlan + extra.mt;
    return {
      mt: mil(total),
      usd: `US$ ${mil(p.precioUsd + extra.usd)}`,
      periodo: m === 0 ? 'por mes' : 'este mes',
      nota: m === 0 ? 'Lo que trae tu plan' : `US$ ${mil(p.precioUsd)} del plan + US$ ${mil(extra.usd)} de MaKo Tokens`,
      extra: m === 0 ? 'Si te faltan, sumas más cuando quieras' : `+ ${mil(extra.mt)} extra, una sola vez`,
      video: `Hasta ${textoVideo(clipsPlan + extra.clips)}`,
      img: `o hasta ${mil(Math.floor(total / mtImagen))} imágenes`,
      barra: m === 0 ? 'Tu plan' : `+ ${m} min`,
      pct: Math.round((base + (i / (EXTRA_MINUTOS.length - 1)) * (100 - base)) * 10) / 10,
    };
  });
  const tope = (TOPES as Readonly<Record<string, Readonly<Record<string, number | null>>>>)[p.capa]?.['spy.competidores'];
  const boton = botonDelPlan({ id: p.id, nombre: p.nombre, cobrable: p.cobrable, sufijo });
  return {
    id: p.id, nombre: p.nombre, corto: p.nombre.replace(/^MaKo\s+/, ''), usdPlan: p.precioUsd,
    incluidos: `${mil(mtPlan)} incluidos cada mes`,
    competidores: tope == null ? 'No gasta: sin tope' : `No gasta: hasta ${tope} ${tope === 1 ? 'competidor' : 'competidores'}`,
    href: boton.href, boton: boton.texto, pasos,
  };
}

export const CSS_TOKENS = `
.tk{margin:8px 0 64px;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:48px;align-items:start;text-align:left}
.tk h2{margin:0;font-size:36px;line-height:1.12;font-weight:800;letter-spacing:-.02em}
.tk-p{margin:12px 0 0;max-width:480px;font-size:16px;line-height:1.5;color:#5B6472}
.tk-paso{margin:28px 0 12px;display:flex;align-items:center;gap:10px;font-size:15.5px;font-weight:600}
.tk-paso i{flex:none;width:22px;height:22px;border-radius:50%;border:1.5px solid currentColor;display:inline-grid;place-items:center;font-size:12px;font-style:normal;font-weight:700}
.tk-planes{display:flex;flex-wrap:wrap;gap:8px}
.tk-planes input{position:absolute;opacity:0;width:1px;height:1px;pointer-events:none}
.tk-planes label{display:inline-block;cursor:pointer;padding:10px 16px;border-radius:12px;border:1px solid #E3E7EF;background:#fff;color:#12151B;font-size:15px;font-weight:600;transition:border-color .15s ease,box-shadow .15s ease}
.tk-planes label small{margin-left:6px;font-size:13.5px;font-weight:500;color:#5B6472}
.tk-planes input:checked+label{border-color:#12151B;box-shadow:inset 0 0 0 1px #12151B}
.tk-planes input:focus-visible+label{outline:2px solid #2F6FED;outline-offset:2px}
.tk-barra{position:relative;height:46px;border-radius:12px;background:#EEF1F5;overflow:hidden}
.tk-barra:has(.tk-rango:focus-visible){outline:2px solid #2F6FED;outline-offset:3px}
.tk-lleno,.tk-incluido{position:absolute;top:0;bottom:0;left:0;border-radius:12px 0 0 12px}
.tk-lleno{width:var(--tk-pct,30%);background:#12151B;transition:width .12s ease}
.tk-incluido{width:var(--tk-base,30%);background:#2F6FED}
.tk-mango{position:absolute;top:12px;bottom:12px;left:calc(var(--tk-pct,30%) - 9px);width:2px;border-radius:2px;background:#fff;transition:left .12s ease}
.tk-valor{position:absolute;top:50%;transform:translateY(-50%);left:calc(var(--tk-pct,30%) + 12px);font-size:15px;font-weight:700;color:#12151B;white-space:nowrap;pointer-events:none}
.tk-barra[data-adentro] .tk-valor{left:auto;right:calc(100% - var(--tk-pct,30%) + 20px);color:#fff}
.tk-rango{position:absolute;top:0;bottom:0;right:0;left:var(--tk-base,30%);width:auto;height:100%;margin:0;opacity:0;cursor:pointer}
.tk-escala{display:flex;justify-content:space-between;gap:12px;margin-top:8px;font-size:13.5px;color:#7A8291}
.tk-costos{margin:0;padding:0;list-style:none;border-top:1px solid #E3E7EF}
.tk-costos li{display:flex;justify-content:space-between;align-items:baseline;gap:16px;padding:10px 0;border-bottom:1px solid #EEF1F5;font-size:14.5px}
.tk-costos b{flex:none;text-align:right;font-weight:700}
.tk-costos b.no{font-weight:600;color:#1F7A4D}
.tk-card{position:sticky;top:96px;border-radius:20px;padding:28px;background:linear-gradient(160deg,#F2F6FF 0%,#FFFFFF 55%);border:1px solid #D6E2FB;box-shadow:0 18px 40px -24px rgba(16,24,40,.3);color:#12151B}
.tk-cab{display:flex;justify-content:space-between;align-items:flex-start;gap:16px}
.tk-cab h3{margin:0;font-size:28px;line-height:1.1;font-weight:800;letter-spacing:-.02em;color:#12151B}
.tk-precio{text-align:right;white-space:nowrap}
.tk-precio b{display:block;font-size:30px;line-height:1.1;font-weight:800;letter-spacing:-.02em}
.tk-precio span{font-size:13.5px;color:#5B6472}
.tk-nota{margin:6px 0 0;font-size:13.5px;color:#5B6472}
.tk-total{margin:22px 0 4px;font-size:16px;font-weight:600}
.tk-total b{font-size:40px;line-height:1;font-weight:800;letter-spacing:-.03em;margin-right:8px;color:#2F6FED}
.tk-lista{list-style:none;margin:16px 0 24px;padding:0;display:grid;gap:10px;font-size:15px}
.tk-lista li{display:flex;gap:10px;align-items:flex-start}
.tk-lista li::before{content:"✓";flex:none;width:20px;height:20px;border-radius:50%;display:inline-grid;place-items:center;font-size:12px;font-weight:800;color:#1F7A4D;background:#E3F5EB}
.tk-cta{display:block;text-align:center;background:#12151B;color:#fff !important;text-decoration:none;font-weight:700;font-size:15px;padding:14px 20px;border-radius:12px;transition:filter .15s ease}
.tk-cta:hover{filter:brightness(1.15)}
@media (max-width:900px){
  .tk{grid-template-columns:1fr;gap:28px;margin-bottom:48px}
  .tk h2{font-size:28px}
  .tk-card{position:static;padding:22px 20px}
  .tk-cab h3{font-size:24px}
  .tk-precio b{font-size:26px}
  .tk-total b{font-size:34px}
}
`;

export function CalculadoraTokens({ planes, sufijo = '' }: { planes: readonly PlanCalculadora[]; sufijo?: string }) {
  const datos = planes.map((p) => datosDelPlan(p, sufijo)).filter((d): d is DatosPlan => d != null);
  if (!datos.length) return null;
  // Arranca en el plan recomendado (como ElevenLabs, que abre en su «Recommended Plan»), con sus MaKo Tokens.
  const a = datos.find((d) => planes.find((p) => p.id === d.id)?.destacado) ?? datos[0];
  const p0 = a.pasos[0];
  const ultimo = a.pasos.length - 1;
  const script = `(function(){var D=${JSON.stringify(datos)};document.querySelectorAll('[data-tk]').forEach(function(c){var r=c.querySelector('.tk-rango'),b=c.querySelector('.tk-barra'),k=c.querySelector('.tk-cta');function plan(){var x=c.querySelector('input[name=tk-plan]:checked');for(var i=0;i<D.length;i++)if(x&&D[i].id===x.value)return D[i];return D[0];}function pon(){var d=plan(),p=d.pasos[Number(r.value)]||d.pasos[0],u=d.pasos[d.pasos.length-1];c.querySelectorAll('[data-tk-v]').forEach(function(n){var q=n.getAttribute('data-tk-v');n.textContent=q==='max'?u.mt:(q in p?p[q]:d[q]);});b.style.setProperty('--tk-pct',p.pct+'%');b.style.setProperty('--tk-base',d.pasos[0].pct+'%');if(p.pct>58)b.setAttribute('data-adentro','');else b.removeAttribute('data-adentro');k.href=d.href;r.setAttribute('aria-valuetext',p.mt+' MaKo Tokens, '+p.usd+' '+p.periodo);}r.addEventListener('input',pon);c.querySelectorAll('input[name=tk-plan]').forEach(function(x){x.addEventListener('change',function(){r.value='0';pon();});});pon();});})();`;
  const estiloBarra = { '--tk-pct': `${p0.pct}%`, '--tk-base': `${p0.pct}%` } as CSSProperties;
  return (
    <section className="tk" aria-labelledby="tk-titulo" data-tk="">
      <div>
        <h2 id="tk-titulo">Calcula cuántos MaKo Tokens necesitas</h2>
        <p className="tk-p">Con MaKo Tokens generas video e imágenes con IA. Tu plan trae una cantidad cada mes y, si te faltan, sumas más.</p>

        <p className="tk-paso" id="tk-paso-1"><i>1</i>Elige tu plan</p>
        <div className="tk-planes" role="radiogroup" aria-labelledby="tk-paso-1">
          {datos.map((d) => (
            <span key={d.id}>
              <input type="radio" name="tk-plan" id={`tk-plan-${d.id}`} value={d.id} defaultChecked={d.id === a.id} />
              <label htmlFor={`tk-plan-${d.id}`}>{d.corto}<small>US$ {mil(d.usdPlan)}</small></label>
            </span>
          ))}
        </div>

        <p className="tk-paso" id="tk-paso-2"><i>2</i>¿Cuántos MaKo Tokens necesitas este mes?</p>
        {/* data-tema-fijo: el sol y la luna del sitio (TemaSitio) aclaran los fondos oscuros en el modo claro, y la parte negra de la
            barra quedaba gris claro con el «+ 4 min» blanco encima, invisible (mirado en el visor el 14/11/2026). */}
        <div className="tk-barra" style={estiloBarra} data-tema-fijo="">
          <span className="tk-lleno" aria-hidden="true" />
          <span className="tk-incluido" aria-hidden="true" />
          <span className="tk-mango" aria-hidden="true" />
          <span className="tk-valor" aria-hidden="true" data-tk-v="barra">{p0.barra}</span>
          <input className="tk-rango" type="range" min={0} max={ultimo} step={1} defaultValue={0} aria-labelledby="tk-paso-2" aria-valuetext={`${p0.mt} MaKo Tokens, ${p0.usd} ${p0.periodo}`} />
        </div>
        <div className="tk-escala" aria-hidden="true"><span data-tk-v="incluidos">{a.incluidos}</span><span data-tk-v="max">{a.pasos[ultimo].mt}</span></div>

        <p className="tk-paso"><i>3</i>Lo que gasta cada cosa</p>
        <ul className="tk-costos">
          {COSTO_POR_ACCION.map((x) => (
            <li key={x.que}>
              <span>{x.que}</span>
              {x.mt != null
                ? <b>{mil(x.mt)} MaKo Tokens</b>
                : x.porque === 'competidores'
                  ? <b className="no" data-tk-v="competidores">{a.competidores}</b>
                  : <b className="no">No gasta: usa tu IA</b>}
            </li>
          ))}
        </ul>
      </div>

      <div className="tk-card" aria-live="polite">
        <div className="tk-cab">
          <h3 data-tk-v="nombre">{a.nombre}</h3>
          <div className="tk-precio"><b data-tk-v="usd">{p0.usd}</b><span data-tk-v="periodo">{p0.periodo}</span></div>
        </div>
        <p className="tk-nota" data-tk-v="nota">{p0.nota}</p>
        <div className="tk-total"><b data-tk-v="mt">{p0.mt}</b>MaKo Tokens</div>
        <ul className="tk-lista">
          <li data-tk-v="incluidos">{a.incluidos}</li>
          <li data-tk-v="extra">{p0.extra}</li>
          <li data-tk-v="video">{p0.video}</li>
          <li data-tk-v="img">{p0.img}</li>
        </ul>
        <a className="tk-cta" href={a.href} data-tk-v="boton">{a.boton}</a>
      </div>
      <script data-visor="" dangerouslySetInnerHTML={{ __html: script }} />
    </section>
  );
}

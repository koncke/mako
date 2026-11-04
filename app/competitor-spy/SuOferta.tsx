'use client';

// =============================================================================
// SuOferta — la oferta de un competidor en la pestaña «Funnel», leída con el analista de Offer (4/11/2026)
// =============================================================================
// Martín (por el Cerebro, 4/11): «en "Su Funnel" debe "exponer" su OFERTA con el analizador de oferta que ya tenemos
// construido». Lo que se dibuja es EL diagnóstico de Offer (`VistaDiagnostico`, app/offer/Conclusion.tsx) en su modo
// `deOtro`: las 9 notas con su porqué, la tesis y lo que ya hace bien, sin los consejos que son para el dueño de esa
// oferta. Arriba, lo que vende (lo que leyó la IA del negocio de todo su contenido: `OfertaLeida`) y el puntaje, que lo
// calcula el código. Lo trae solo la ruta /api/competitor-spy/oferta: acá no hay botón.
// =============================================================================

import type { ReactNode } from 'react';
import { CargandoMako } from '@/app/_ui/CargandoMako';
import { TONO } from '@/app/_ui/tokens';
import { LinkIntegracion } from '../_components/ConectarIntegracion';
import { VistaDiagnostico } from '../offer/Conclusion';
import { CSS_OFFER } from '../offer/estilos';
import { tonoDeNota } from '../offer/ayudas';
import { FUENTE_PUNTAJE, dimensionLabel } from '@/lib/offer-marco';
import type { VistaOferta } from '@/lib/spy-oferta';
import type { OfertaLeida } from '@/lib/spy';

const CSS = `
.spy-su-oferta{display:flex;flex-direction:column;gap:18px;width:100%}
.spy-su-oferta__cabeza{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}
.spy-su-oferta__cabeza h3{margin:0;font-size:var(--fs-sect);font-weight:600;letter-spacing:-.01em}
.spy-su-oferta__cabeza p{margin:4px 0 0;color:var(--dim);font-size:var(--fs-sm)}
.spy-su-oferta__nota{display:inline-flex;align-items:baseline;gap:2px;padding:8px 14px;border-radius:14px;
  font-variant-numeric:tabular-nums;line-height:1}
.spy-su-oferta__nota b{font-size:28px;font-weight:700;letter-spacing:-.02em}
.spy-su-oferta__nota span{font-size:var(--fs-sm);font-weight:600;opacity:.8}
.spy-su-oferta__datos{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin:0}
.spy-su-oferta__datos>div{padding:14px 16px;border-radius:var(--r-lg);background:var(--surface);
  box-shadow:inset 0 0 0 1px var(--border);font-size:var(--fs-md);line-height:1.5;min-width:0}
.spy-su-oferta__datos dt{margin:0 0 4px;color:var(--faint);font-size:var(--fs-sm);font-weight:600}
.spy-su-oferta__datos dd{margin:0;overflow-wrap:anywhere}
.spy-su-oferta__huecos{padding:16px 18px;border-radius:var(--r-lg);background:var(--surface);
  box-shadow:inset 0 0 0 1px var(--border);font-size:var(--fs-md);line-height:1.5}
.spy-su-oferta__huecos b{display:block;margin-bottom:6px;color:var(--faint);font-size:var(--fs-sm);font-weight:600}
.spy-su-oferta__huecos ul{margin:0;padding-left:18px}
.spy-su-oferta__aviso{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:0;padding:11px 14px;
  border-radius:var(--r-md);background:var(--surface-2);color:var(--dim);font-size:var(--fs-sm);line-height:1.5}
`;

function Datos({ o }: { o: OfertaLeida | null }) {
  if (!o?.promete) return null;
  const filas = [
    { k: 'Promete', v: o.promete },
    { k: 'A quién', v: o.aQuien },
    { k: 'Precio que publica', v: o.precio },
    { k: 'Objeción que ataca', v: o.objecion },
  ].filter((x) => x.v?.trim());
  return (
    <dl className="spy-su-oferta__datos">
      {filas.map((f) => <div key={f.k}><dt>{f.k}</dt><dd>{f.v}</dd></div>)}
    </dl>
  );
}

export function SuOferta({ vista, datos, nombre, onConectado }: {
  /** Lo que devolvió /api/competitor-spy/oferta. `undefined` = todavía no preguntó. */
  vista: VistaOferta | undefined;
  /** Lo que la IA del negocio leyó de todo su contenido (spy_competidores.oferta). */
  datos: OfertaLeida | null;
  nombre: string;
  onConectado: () => void;
}) {
  const conDiagnostico = vista && 'diagnostico' in vista && vista.diagnostico ? vista : null;
  const huecos = datos?.huecos?.filter((h) => h?.trim()) ?? [];
  if (!conDiagnostico && vista?.estado === 'sin-web' && !datos?.promete) return null;
  const tono = conDiagnostico?.total != null ? TONO[tonoDeNota(conDiagnostico.total / 10)] : null;

  let cuerpo: ReactNode = null;
  if (conDiagnostico?.diagnostico) {
    cuerpo = (
      <VistaDiagnostico
        d={conDiagnostico.diagnostico} deOtro conProbar={false}
        calculo={{ total: conDiagnostico.total ?? 0, cuello: conDiagnostico.cuello ?? 'D1', lista: false, alertas: [] }}
      />
    );
  } else if (!vista || vista.estado === 'leyendo') {
    cuerpo = <CargandoMako que={`la oferta de ${nombre}`} alto={240} size={64} />;
  } else if (vista.estado === 'sin-ia') {
    cuerpo = (
      <p className="spy-su-oferta__aviso">
        Conecta tu IA para leer su oferta.
        <LinkIntegracion href="/integraciones?abrir=ia" className="spy-boton" onConectado={onConectado}>Conectar mi IA</LinkIntegracion>
      </p>
    );
  } else if (vista.estado === 'no-pudo' && vista.motivo) {
    cuerpo = <p className="spy-su-oferta__aviso">{vista.motivo}</p>;
  }

  return (
    <section className="spy-su-oferta" aria-label={`La oferta de ${nombre}`}>
      <style>{CSS_OFFER}{CSS}</style>
      <header className="spy-su-oferta__cabeza">
        <div>
          <h3>Su oferta</h3>
          {conDiagnostico?.cuello && <p>Lo más flojo: <b>{dimensionLabel(conDiagnostico.cuello)}</b></p>}
        </div>
        {tono && conDiagnostico?.total != null && (
          <div className="spy-su-oferta__nota" title={FUENTE_PUNTAJE} style={{ color: tono.ink, background: tono.bg }}>
            <b>{conDiagnostico.total}</b><span>/100</span>
          </div>
        )}
      </header>
      <Datos o={datos} />
      {cuerpo}
      {huecos.length > 0 && (
        <div className="spy-su-oferta__huecos">
          <b>Lo que ataca y tu oferta no menciona</b>
          <ul>{huecos.map((h) => <li key={h}>{h}</li>)}</ul>
        </div>
      )}
    </section>
  );
}

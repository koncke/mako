'use client';

// =============================================================================
// SuOferta — la oferta de un competidor en la pestaña «Funnel», leída con el analista de Offer (4/11/2026)
// =============================================================================
// Martín (por el Cerebro, 4/11): «en "Su Funnel" debe "exponer" su OFERTA con el analizador de oferta que ya tenemos
// construido». Lo que se dibuja es EL diagnóstico de Offer (`VistaDiagnostico`, app/offer/Conclusion.tsx) en su modo
// `deOtro`: las 9 notas con su porqué, la tesis y lo que ya hace bien, sin los consejos que son para el dueño de esa
// oferta. Lo trae solo la ruta /api/competitor-spy/oferta: acá no hay botón.
//
// Tercera vuelta (Martín, 4/11): «la oferta debería ir arriba claro, porque si va abajo de las web, no se vería nunca... quiero que se
// entienda mejor el análisis de su oferta, está bien los desplegables, pero diseña mejor esa sección». Por eso son DOS PARTES:
//   · `parte="cabeza"`, arriba, al lado de su funnel: el puntaje como un anillo, la tesis como titular, lo más flojo, lo que
//     vende (promete, a quién, precio, objeción) y lo que ataca y tu oferta no dice. Es lo que se entiende en cinco segundos.
//   · `parte="detalle"`, debajo: las 9 notas (los desplegables de Offer) y lo más fuerte.
// La tesis va UNA vez: en la cabeza. Al diagnóstico de abajo se le pasa sin ella.
// =============================================================================

import type { ReactNode } from 'react';
import { CargandoMako } from '@/app/_ui/CargandoMako';
import { TONO } from '@/app/_ui/tokens';
import { IconoMenu, type NombreIconoMenu } from '@/app/_ui/iconos-menu';
import { BotonIntegracion } from '../_components/ConectarIntegracion';
import { VistaDiagnostico } from '../offer/Conclusion';
import { CSS_OFFER } from '../offer/estilos';
import { tonoDeNota } from '../offer/ayudas';
import { FUENTE_PUNTAJE, dimensionLabel } from '@/lib/offer-marco';
import type { VistaOferta } from '@/lib/spy-oferta';
import type { OfertaLeida } from '@/lib/spy';

const CSS = `
.spy-oferta-cabeza{display:flex;flex-direction:column;gap:16px;min-width:0;padding:22px;border-radius:var(--r-lg);
  background:var(--surface);box-shadow:inset 0 0 0 1px var(--border)}
.spy-oferta-hero{display:flex;align-items:center;gap:18px}
.spy-oferta-hero small{display:block;color:var(--faint);font-size:var(--fs-sm);font-weight:600}
.spy-oferta-tesis{margin:2px 0 0;font-size:19px;font-weight:700;line-height:1.3;letter-spacing:-.015em;color:var(--ink);text-wrap:pretty}
.spy-oferta-flojo{display:inline-flex;align-items:center;gap:6px;margin-top:8px;padding:4px 10px;border-radius:99px;
  background:var(--warn-bg);color:var(--warn);font-size:var(--fs-sm);font-weight:600}
.spy-anillo{position:relative;flex:none;width:88px;height:88px}
.spy-anillo svg{display:block}
.spy-anillo b{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;
  font-size:26px;font-weight:700;letter-spacing:-.02em;font-variant-numeric:tabular-nums;line-height:1}
.spy-anillo b span{margin-top:2px;font-size:11px;font-weight:600;opacity:.7}
.spy-oferta-datos{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:0}
.spy-oferta-datos>div{display:flex;gap:10px;align-items:flex-start;padding:12px 14px;border-radius:var(--r-md);background:var(--surface-2);min-width:0}
.spy-oferta-datos__icono{flex:none;display:flex;margin-top:2px;color:var(--dim)}
.spy-oferta-datos dt{margin:0 0 2px;color:var(--faint);font-size:var(--fs-sm);font-weight:600}
.spy-oferta-datos dd{margin:0;font-size:var(--fs-md);line-height:1.45;overflow-wrap:anywhere}
.spy-oferta-detalle{display:flex;flex-direction:column;gap:14px;min-width:0}
.spy-oferta-detalle h3{margin:0;font-size:var(--fs-sect);font-weight:600;letter-spacing:-.01em}
.spy-oferta-huecos{padding:12px 14px;border-radius:var(--r-md);background:var(--surface-2);font-size:var(--fs-md);line-height:1.5}
.spy-oferta-huecos b{display:block;margin-bottom:6px;color:var(--faint);font-size:var(--fs-sm);font-weight:600}
.spy-oferta-huecos ul{margin:0;padding-left:18px}
.spy-oferta-aviso{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:0;padding:11px 14px;
  border-radius:var(--r-md);background:var(--surface-2);color:var(--dim);font-size:var(--fs-sm);line-height:1.5}
@media (max-width:600px){
  .spy-oferta-datos{grid-template-columns:minmax(0,1fr)}
  .spy-oferta-hero{align-items:flex-start}
  .spy-anillo{width:72px;height:72px}
}
`;

/** El puntaje como un anillo que se llena: se lee antes que el número. */
function Anillo({ total, color, fondo }: { total: number; color: string; fondo: string }) {
  const r = 38;
  const largo = 2 * Math.PI * r;
  const lleno = Math.max(0, Math.min(100, total)) / 100;
  return (
    <div className="spy-anillo" title={FUENTE_PUNTAJE} role="img" aria-label={`${total} de 100`}>
      <svg width="100%" height="100%" viewBox="0 0 88 88" aria-hidden>
        <circle cx="44" cy="44" r={r} fill={fondo} stroke="var(--border)" strokeWidth="7" />
        <circle cx="44" cy="44" r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={largo} strokeDashoffset={largo * (1 - lleno)} transform="rotate(-90 44 44)" />
      </svg>
      <b style={{ color }}>{total}<span>/100</span></b>
    </div>
  );
}

const DATOS: Array<{ k: 'promete' | 'aQuien' | 'precio' | 'objecion'; rotulo: string; icono: NombreIconoMenu }> = [
  { k: 'promete', rotulo: 'Promete', icono: 'accion' },
  { k: 'aQuien', rotulo: 'A quién', icono: 'persona' },
  { k: 'precio', rotulo: 'Precio que publica', icono: 'dinero' },
  { k: 'objecion', rotulo: 'Objeción que ataca', icono: 'escudo' },
];

function Datos({ o }: { o: OfertaLeida | null }) {
  if (!o?.promete) return null;
  const filas = DATOS.map((d) => ({ ...d, v: o[d.k] ?? '' })).filter((x) => x.v.trim());
  return (
    <dl className="spy-oferta-datos">
      {filas.map((f) => (
        <div key={f.k}>
          <span className="spy-oferta-datos__icono" aria-hidden><IconoMenu nombre={f.icono} size={16} /></span>
          <div style={{ minWidth: 0 }}><dt>{f.rotulo}</dt><dd>{f.v}</dd></div>
        </div>
      ))}
    </dl>
  );
}

const conDiagnosticoDe = (vista: VistaOferta | undefined) => (vista && 'diagnostico' in vista && vista.diagnostico ? vista : null);

/** ¿Hay algo que mostrar de su oferta? Sin web y sin lo que vende, la pestaña no reserva lugar para ella. */
export function hayOferta(vista: VistaOferta | undefined, datos: OfertaLeida | null): boolean {
  return !!conDiagnosticoDe(vista) || vista?.estado !== 'sin-web' || !!datos?.promete;
}

export function SuOferta({ vista, datos, nombre, onConectado, parte }: {
  /** Lo que devolvió /api/competitor-spy/oferta. `undefined` = todavía no preguntó. */
  vista: VistaOferta | undefined;
  /** Lo que la IA del negocio leyó de todo su contenido (spy_competidores.oferta). */
  datos: OfertaLeida | null;
  nombre: string;
  onConectado: () => void;
  /** Arriba, la cabeza (puntaje, tesis, lo que vende); abajo, el detalle (las 9 notas). */
  parte: 'cabeza' | 'detalle';
}) {
  const conDiagnostico = conDiagnosticoDe(vista);
  if (!hayOferta(vista, datos)) return null;
  const huecos = datos?.huecos?.filter((h) => h?.trim()) ?? [];

  if (parte === 'detalle') {
    if (!conDiagnostico?.diagnostico) return null;
    return (
      <section className="spy-oferta-detalle" aria-label={`Las notas de la oferta de ${nombre}`} data-recorrido="spy-oferta-notas">
        <style>{CSS_OFFER}{CSS}</style>
        <h3>Nota por nota</h3>
        <VistaDiagnostico
          d={{ ...conDiagnostico.diagnostico, tesis: '' }} deOtro conProbar={false}
          calculo={{ total: conDiagnostico.total ?? 0, cuello: conDiagnostico.cuello ?? 'D1', lista: false, alertas: [] }}
        />
      </section>
    );
  }

  const tono = conDiagnostico?.total != null ? TONO[tonoDeNota(conDiagnostico.total / 10)] : null;
  const tesis = conDiagnostico?.diagnostico?.tesis?.trim() || datos?.promete?.trim() || null;
  let estado: ReactNode = null;
  if (!conDiagnostico) {
    if (!vista || vista.estado === 'leyendo') estado = <CargandoMako que={`la oferta de ${nombre}`} alto={160} size={56} />;
    else if (vista.estado === 'sin-ia') {
      estado = (
        <p className="spy-oferta-aviso">
          Conecta tu IA para leer su oferta.
          {/* Su Claude, como en el chat (IA9): el analista de Offer la prueba primero. Se conecta acá, sin salir de la tab. */}
          <BotonIntegracion servicio="anthropic" className="spy-boton" onConectado={onConectado}>Conectar mi IA</BotonIntegracion>
        </p>
      );
    } else if (vista.estado === 'no-pudo' && vista.motivo) estado = <p className="spy-oferta-aviso">{vista.motivo}</p>;
  }

  return (
    <section className="spy-oferta-cabeza" aria-label={`La oferta de ${nombre}`} data-recorrido="spy-oferta">
      <style>{CSS}</style>
      <div className="spy-oferta-hero">
        {tono && conDiagnostico?.total != null && <Anillo total={conDiagnostico.total} color={tono.ink} fondo={tono.bg} />}
        <div style={{ minWidth: 0 }}>
          <small>Su oferta</small>
          <p className="spy-oferta-tesis">{tesis ?? nombre}</p>
          {conDiagnostico?.cuello && (
            <span className="spy-oferta-flojo"><IconoMenu nombre="avisar" size={14} />Lo más flojo: {dimensionLabel(conDiagnostico.cuello)}</span>
          )}
        </div>
      </div>
      <Datos o={datos} />
      {/* Al lado de su funnel, la tarjeta llega más abajo: lo que ataca y tu oferta no dice entra acá y no queda hueco. */}
      {huecos.length > 0 && (
        <div className="spy-oferta-huecos">
          <b>Lo que ataca y tu oferta no menciona</b>
          <ul>{huecos.map((h) => <li key={h}>{h}</li>)}</ul>
        </div>
      )}
      {estado}
    </section>
  );
}

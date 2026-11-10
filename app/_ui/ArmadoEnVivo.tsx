'use client';

// =============================================================================
// _ui/ArmadoEnVivo — lo que MaKo está construyendo, A LA VISTA mientras lo construye (AGENTS.md, 28/10/2026)
// =============================================================================
// El molde es el scraping de WhatsApp de la extensión (extension/popup.html): la cuenta grande, un punto por cosa que se
// lee (se enciende al leerla), las fases con su tilde y la de ahora girando. Acá, además, la lista de lo armado, que va
// apareciendo de arriba hacia abajo con un pequeño delay (./armado-en-vivo.ts: la cadencia, sin inventar progreso).
// Reusable: Replicar landing lo usa con las secciones; después va a Automations (los nodos), los editores y los
// dashboards. Quien la usa le pasa lo que YA se armó (`piezas`, en orden) y lo que sabe del total; la pieza decide cómo
// se revela.
//   · «Ver todo» lo muestra de una (se puede saltear);
//   · con «reducir movimiento» del sistema, sin cadencia ni animación;
//   · colores de la regla de la app (app/_ui/LEEME.md): dorado = MaKo trabajando, verde = terminado.
// 9/11/2026 (el reel de Web Replicate): `escena` dibuja lo armado A LA VISTA (los varios mouse de Replicar,
// crear/EscenarioReplica.tsx) con la MISMA cadencia que la cuenta: recibe `visibles` de acá, así el escenario y el número
// nunca dicen cosas distintas. Con escena, la lista y su «Ver todo» los pone el escenario.
// =============================================================================

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { visiblesAhora, type FaseArmado } from './armado-en-vivo';

export type PiezaArmada = {
  id: string;
  texto: string;
  /** Una línea chica abajo («3 párrafos · 1 botón»). */
  detalle?: string;
  /** Una etiqueta adelante («Portada», «Precio»). */
  chip?: string;
};

const sinMovimiento = (): boolean => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

/**
 * Cuántas de las `llegadas` se ven: de a una, con la cadencia de `visiblesAhora`. `saltear` las muestra todas. Si
 * `llegadas` baja (otro trabajo), arranca de nuevo.
 */
export function useRevelado(llegadas: number): { visibles: number; saltear: () => void; salteado: boolean } {
  const [visibles, setVisibles] = useState(0);
  const [salteado, setSalteado] = useState(false);
  const [quieto, setQuieto] = useState(false);
  const ultima = useRef(0);
  useEffect(() => { setQuieto(sinMovimiento()); }, []);
  useEffect(() => {
    if (llegadas < visibles) { setVisibles(llegadas); return; }
    if (visibles >= llegadas) return;
    const paso = () => setVisibles((v) => {
      const n = visiblesAhora({ llegadas, visibles: v, desdeUltima: Date.now() - ultima.current, salteado, sinMovimiento: quieto });
      if (n !== v) ultima.current = Date.now();
      return n;
    });
    paso();
    const t = setInterval(paso, 40);
    return () => clearInterval(t);
  }, [llegadas, visibles, salteado, quieto]);
  return { visibles: Math.min(visibles, llegadas), saltear: () => setSalteado(true), salteado };
}

/** Lo que recibe un escenario: cuántas se ven (la cadencia de esta pieza), cuántas llegaron y cómo saltear. */
export type ReveladoEscena = { visibles: number; llegadas: number; saltear: () => void; salteado: boolean };

export function ArmadoEnVivo({ titulo, fases, piezas, total, unidad, terminado = false, onTodoVisible, escena }: {
  titulo: string;
  fases: readonly FaseArmado[];
  /** Lo que YA se armó, en el orden en que se armó. */
  piezas: readonly PiezaArmada[];
  /** Cuántas van a ser, si se sabe (un punto por cada una). */
  total?: number;
  /** Cómo se llaman en plural («secciones»). */
  unidad: string;
  terminado?: boolean;
  /** Una vez, cuando el trabajo terminó y ya se ve todo (para seguir: abrir lo armado, cerrar el panel). */
  onTodoVisible?: () => void;
  /** Lo armado a la vista (los varios mouse de Replicar): reemplaza a la lista y a los puntos. */
  escena?: (r: ReveladoEscena) => ReactNode;
}) {
  const { visibles, saltear, salteado } = useRevelado(piezas.length);
  const avisado = useRef(false);
  useEffect(() => {
    if (!terminado || visibles < piezas.length || avisado.current) return;
    avisado.current = true;
    onTodoVisible?.();
  }, [terminado, visibles, piezas.length, onTodoVisible]);
  const puntos = Math.max(total ?? 0, piezas.length);
  const vistas = piezas.slice(0, visibles);
  return (
    <section className="ae-armado" aria-label={titulo} data-terminado={terminado ? 'si' : 'no'}>
      <style href="ae-armado" precedence="medium">{CSS_ARMADO}</style>
      <div className="ae-cabeza">
        <h2 className="ae-titulo">{titulo}</h2>
        <p className="ae-conteo" role="status" aria-live="polite">
          {visibles}{puntos ? <small> de {puntos} {unidad}</small> : <small> {unidad}</small>}
        </p>
      </div>
      {escena ? escena({ visibles, llegadas: piezas.length, saltear, salteado }) : null}
      {puntos > 0 && !escena && (
        <div className="ae-puntos" aria-hidden>
          {Array.from({ length: puntos }, (_, i) => <i key={i} className={i < visibles ? 'ae-listo' : ''} />)}
        </div>
      )}
      <ol className="ae-fases">
        {fases.map((f) => (
          <li key={f.id} className={`ae-fase-${f.estado}`}>
            <span className="ae-marca" aria-hidden>{f.estado === 'hecha' ? '✓' : f.estado === 'fallo' ? '!' : ''}</span>
            {f.texto}
          </li>
        ))}
      </ol>
      {vistas.length > 0 && !escena && (
        <ol className="ae-piezas">
          {vistas.map((p, i) => (
            <li key={p.id} className="ae-pieza">
              <span className="ae-num">{i + 1}</span>
              <span className="ae-cuerpo">
                <span className="ae-texto">{p.chip ? <span className="ae-chip">{p.chip}</span> : null}{p.texto}</span>
                {p.detalle ? <span className="ae-detalle">{p.detalle}</span> : null}
              </span>
            </li>
          ))}
        </ol>
      )}
      {visibles < piezas.length && !escena && (
        <button type="button" className="ae-saltear" onClick={saltear}>Ver todo</button>
      )}
    </section>
  );
}

/** Con los tokens de la app y respaldos, para que entre en cualquier pantalla (clara u oscura). */
const CSS_ARMADO = `
.ae-armado { --ae-mako: var(--mako, #F2B01E); --ae-listo: var(--good, #1f9d55); --ae-linea: color-mix(in srgb, currentColor 16%, transparent); --ae-tenue: color-mix(in srgb, currentColor 62%, transparent); margin-top: 16px; padding: 14px 16px; border: 1px solid var(--ae-linea); border-radius: 12px; }
.ae-cabeza { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.ae-titulo { margin: 0; font-size: 15px; font-weight: 600; }
.ae-conteo { margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -.02em; font-variant-numeric: tabular-nums; line-height: 1.1; }
.ae-conteo small { margin-left: 4px; font-size: 13px; font-weight: 500; letter-spacing: 0; color: var(--ae-tenue); }
.ae-puntos { display: grid; grid-template-columns: repeat(auto-fill, 9px); gap: 4px; margin-top: 10px; }
.ae-puntos i { width: 9px; height: 9px; border-radius: 50%; background: var(--ae-linea); transition: background-color .3s, transform .3s; }
.ae-puntos i.ae-listo { background: var(--ae-mako); transform: scale(1.15); }
.ae-armado[data-terminado="si"] .ae-puntos i.ae-listo { background: var(--ae-listo); }
.ae-fases { list-style: none; margin: 12px 0 0; padding: 0; font-size: 13px; display: grid; gap: 4px; }
.ae-fases li { display: flex; align-items: center; gap: 8px; color: var(--ae-tenue); }
.ae-fases li.ae-fase-hecha, .ae-fases li.ae-fase-ahora { color: inherit; }
.ae-fases li.ae-fase-ahora { font-weight: 600; }
.ae-marca { flex: none; display: grid; place-items: center; width: 14px; height: 14px; border-radius: 50%; border: 1.5px solid var(--ae-linea); font-size: 9px; line-height: 1; }
.ae-fase-hecha .ae-marca { background: var(--ae-listo); border-color: var(--ae-listo); color: #fff; }
.ae-fase-ahora .ae-marca { border-color: var(--ae-mako); border-right-color: transparent; animation: ae-gira .8s linear infinite; }
.ae-fase-fallo .ae-marca { background: var(--bad, #d93025); border-color: var(--bad, #d93025); color: #fff; }
.ae-piezas { list-style: none; margin: 12px 0 0; padding: 0; display: grid; gap: 6px; }
.ae-pieza { display: flex; gap: 10px; align-items: flex-start; padding: 8px 10px; border-radius: 9px; background: color-mix(in srgb, currentColor 5%, transparent); animation: ae-entra .32s ease-out both; }
.ae-num { flex: none; min-width: 20px; height: 20px; display: grid; place-items: center; border-radius: 6px; background: var(--ae-mako); color: #1a1300; font-size: 11px; font-weight: 700; }
.ae-cuerpo { min-width: 0; display: grid; gap: 2px; }
.ae-texto { font-size: 13.5px; overflow-wrap: anywhere; }
.ae-detalle { font-size: 12px; color: var(--ae-tenue); }
.ae-chip { display: inline-block; margin-right: 6px; padding: 0 6px; border-radius: 9999px; border: 1px solid var(--ae-linea); font-size: 11px; font-weight: 600; }
.ae-saltear { margin-top: 10px; padding: 4px 12px; border-radius: 9999px; border: 1px solid var(--ae-linea); background: transparent; color: inherit; font: inherit; font-size: 13px; cursor: pointer; }
@keyframes ae-gira { to { transform: rotate(360deg); } }
@keyframes ae-entra { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) {
  .ae-pieza { animation: none; } .ae-fase-ahora .ae-marca { animation: none; border-right-color: var(--ae-mako); } .ae-puntos i { transition: none; }
}
`;

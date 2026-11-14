'use client';

// =============================================================================
// FormularioDelCron — el CRON «Envió el formulario»: CUÁL formulario (14/11/2026)
// =============================================================================
// La llamada con Julio Mazariegos (docs/relevo/llamada-julio-13-11.md, punto 5): Martín tuvo que crear un funnel «Formulario
// prueba Julio» con una etapa «Rellenó el formulario» para disparar una secuencia, porque no había un disparador por
// formulario. Este es ese disparador: un desplegable con las landings publicadas del negocio y, dentro de cada una,
// «Cualquier formulario de esta landing» y cada formulario, encuesta o quiz por su nombre (lib/editor-landing/piezas.ts).
// Sin landings publicadas lo dice y lleva al Web Generator.
// =============================================================================

import { useEffect, useState } from 'react';
import Link from '@/app/_ui/Link';
import { Dropdown, type DropdownGroup } from '@/app/components/Dropdown';
import { piezasWebAction } from '@/app/crm/piezas-web-actions';
import { claveDeLanding } from '@/lib/editor-landing/piezas';
import type { LandingConPiezas } from '@/lib/piezas-web';
import type { Disparador, PiezaDelCron } from '@/lib/disparadores';

const SANS = "'Geist', system-ui, sans-serif";

/** Las secciones del desplegable: una por landing, con «cualquiera» primero. Sólo lo que se llena (no agenda ni pago). */
export function seccionesDeFormularios(landings: readonly LandingConPiezas[]): DropdownGroup[] {
  return landings
    .map((l) => {
      const formularios = l.piezas.filter((p) => p.tipo === 'formulario' || p.tipo === 'encuesta' || p.tipo === 'quiz');
      return {
        title: l.titulo,
        options: [
          ...(formularios.length > 1 ? [{ value: claveDeLanding(l.docId), label: 'Cualquier formulario de esta landing', sub: l.titulo }] : []),
          ...formularios.map((p) => ({ value: p.clave, label: p.nombre, sub: `${p.rotulo} · ${p.pagina}` })),
        ],
      };
    })
    .filter((g) => g.options.length > 0);
}

export function FormularioDelCron({ d, onElegir, disabled }: { d: Disparador; onElegir: (p: PiezaDelCron) => void; disabled?: boolean }) {
  const [landings, setLandings] = useState<LandingConPiezas[] | null | undefined>(undefined);
  useEffect(() => {
    let vivo = true;
    piezasWebAction().then((r) => { if (vivo) setLandings(r ? r.landings : null); }).catch(() => { if (vivo) setLandings(null); });
    return () => { vivo = false; };
  }, []);
  const secciones = landings ? seccionesDeFormularios(landings) : [];
  const nombreDe = (clave: string): string => {
    for (const g of secciones) {
      const o = g.options.find((x) => x.value === clave);
      if (o) return clave.startsWith('landing:') ? g.title : o.label;
    }
    return clave;
  };
  const elegido = d.pieza?.clave ?? '';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontFamily: SANS }}>
      {landings === undefined && <span style={{ fontSize: 12.5, color: 'var(--dim)' }}>Buscando tus formularios…</span>}
      {landings === null && <span role="status" style={{ fontSize: 12.5, color: 'var(--warn)' }}>No pude leer tus landings. Vuelve a intentarlo.</span>}
      {landings && !secciones.length && (
        <span role="status" style={{ fontSize: 12.5, color: 'var(--dim)' }}>
          Todavía no publicaste una landing con formulario. <Link href="/web-generator" style={{ color: 'var(--primary)', fontWeight: 600 }}>Crear una en Web Generator</Link>
        </span>
      )}
      {landings && secciones.length > 0 && (
        <Dropdown value={elegido} secciones={secciones} search width="100%" disabled={disabled}
          botonLabel={d.pieza ? (d.pieza.clave.startsWith('landing:') ? `Cualquier formulario de «${d.pieza.nombre}»` : d.pieza.nombre) : 'Elige el formulario'}
          onChange={(v) => onElegir({ clave: v, nombre: nombreDe(v) })} ariaLabel="Qué formulario dispara esta automatización" />
      )}
    </div>
  );
}

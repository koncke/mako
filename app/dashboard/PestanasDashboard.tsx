'use client';

// =============================================================================
// PestanasDashboard — la tira de arriba del Dashboard unido: «Focus», las hojas, y «Templates»
// =============================================================================
// El pedido y las reglas, en lib/dashboard-focus.ts. Acá sólo se dibuja:
//   · Una pestaña del editor que está montado cambia de hoja EN EL LUGAR (`onIr`: la misma que el desplegable de la
//     barra), sin recargar. Una del otro informe es un link (/dashboard?hoja=…): monta el otro editor.
//   · «Templates» abre la galería del Dashboard: en el lugar si el Dashboard está montado, y si no (en Focus) lleva al
//     Dashboard con la galería abierta (`?plantillas=1`).
// ⚠️ Es una tira que se desliza de costado: con muchas hojas no se corta ni salta de renglón (el teléfono angosto
//    también, que es como se mira la edición en el celular).
// =============================================================================

import Link from '@/app/_ui/Link';
import { HREF_TEMPLATES, type InformeDashboard, type Pestana } from '@/lib/dashboard-focus';

const CSS = `
.dash-pestanas{display:flex;align-items:center;gap:8px;padding:10px 16px 2px;min-width:0}
.dash-pestanas-tira{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;min-width:0;flex:1;padding:2px}
.dash-pestanas-tira::-webkit-scrollbar{display:none}
.dash-pestana{display:inline-flex;align-items:center;gap:6px;height:34px;padding:0 14px;border-radius:999px;border:1px solid var(--border);
  background:var(--surface);color:var(--dim);font:inherit;font-size:13.5px;font-weight:600;white-space:nowrap;flex:none;cursor:pointer;text-decoration:none}
.dash-pestana:hover{color:var(--ink);border-color:var(--border-strong)}
.dash-pestana[aria-current="page"]{background:var(--primary);border-color:var(--primary);color:var(--on-primary)}
.dash-pestana:focus-visible{outline:2px solid var(--primary);outline-offset:2px}
.dash-templates{flex:none}
`;

export function PestanasDashboard({ pestanas, actual, informe, onIr, onTemplates }: {
  pestanas: Pestana[];
  /** La hoja que se ve (la del editor montado). */
  actual: string;
  /** El informe del editor montado: sus pestañas cambian en el lugar. */
  informe: InformeDashboard;
  onIr: (id: string) => void;
  /** null = el Dashboard no está montado: «Templates» es un link. */
  onTemplates: (() => void) | null;
}) {
  return (
    <nav className="dash-pestanas lk-sin-imprimir" aria-label="Hojas del Dashboard">
      <style>{CSS}</style>
      <div className="dash-pestanas-tira">
        {pestanas.map((p) => {
          const elegida = p.informe === informe && p.id === actual;
          const texto = <>{p.emoji && !p.fija ? <span aria-hidden>{p.emoji}</span> : null}{p.nombre}</>;
          return p.informe === informe
            ? <button key={`${p.informe}:${p.id}`} type="button" className="dash-pestana" aria-current={elegida ? 'page' : undefined} onClick={() => { if (!elegida) onIr(p.id); }}>{texto}</button>
            : <Link key={`${p.informe}:${p.id}`} href={p.href} className="dash-pestana">{texto}</Link>;
        })}
      </div>
      {onTemplates
        ? <button type="button" className="dash-pestana dash-templates" onClick={onTemplates}>Templates</button>
        : <Link href={HREF_TEMPLATES} className="dash-pestana dash-templates">Templates</Link>}
    </nav>
  );
}

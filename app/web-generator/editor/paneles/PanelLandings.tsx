'use client';

// =============================================================================
// PanelLandings — la LISTA de landings en la tarjeta izquierda del editor (la otra vista del chat)
// =============================================================================
// Pedido de Martín (24/10/2026), textual: «Que sea el mismo sistema de "Automations" con el chat flotando y con la flecha
// para atras para ver las otras landing... Pero que no me redirija, que solo se vaya para atras la sidebar del chat, tal
// cual como en Automations, para elegir otra». Copiado de la tarjeta de Automations (app/automations/SecuenciaPerfil.tsx):
// buscar, «Nueva …» como primer renglón, los ítems y la criatura de MaKo arriba a la derecha para volver al chat.
//
// La `←` de la cabecera del chat (paneles/PanelAgente.tsx) trae acá SIN navegar; un renglón abre esa landing. Y al pie
// «Ver todo en el Panel»: el Panel ya no es la entrada (app/web-generator/page.tsx), y ahí siguen el Diagnóstico, Analizar,
// las carpetas y la papelera. El plan entero: docs/diseno-editor-web-como-automations.md.
//
// «Nueva landing» NO navega (24/10/2026, Martín, textual: «Cuando le doy a "Nueva landing" NO me debe redireccionar a otra
// ruta... Y la sidebar no debe cambiar... Solamente debe aparecer el "¿Qué vas a crear hoy?" con los templates en lugar de
// la topbar de edición y el lienzo»). Lo que se había entregado ese mismo día llevaba al Panel (`/web-generator?panel=1`),
// con otra ruta y otra barra lateral. Ahora es un botón: el editor cambia la barra y el lienzo por el cuadro de crear
// (`setNueva`, EditorLanding.tsx) y esta lista queda como está, con «Nueva landing» marcada.
// =============================================================================

import { useEffect, useMemo, useState } from 'react';
import Link from '@/app/_ui/Link';
import { Muneco } from '@/app/admin/operaciones/Muneco';
import { ASPECTO_MAKO } from '@/lib/centro-munecos';
import type { LandingResumen } from '@/lib/editor-landing/api-tipos';
import { pedirDocs } from '../../cliente';
import { landingsDeLaLista, RUTA_NUEVA_LANDING } from '../../panel-reglas';

export { RUTA_NUEVA_LANDING };
import { useEditorLanding } from '../contexto';
import { Ico } from '../../Ico';

const CSS = `
.gma-ls { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.gma-ls-cab { flex: none; display: flex; align-items: center; gap: 8px; padding: 12px 12px 8px; }
.gma-ls-busca { flex: 1; min-width: 0; height: 34px; box-sizing: border-box; padding: 0 10px; border-radius: 10px;
  border: 1px solid var(--gma-borde); background: var(--gma-superficie); font: inherit; font-size: 13px; color: var(--gma-texto); }
.gma-ls-mako { flex: none; width: 34px; height: 34px; display: grid; place-items: center; border: 0; border-radius: 10px;
  background: transparent; cursor: pointer; }
.gma-ls-mako:hover { background: var(--gma-hover); }
.gma-ls-lista { flex: 1; min-height: 0; overflow-y: auto; padding: 0 8px 8px; display: flex; flex-direction: column; gap: 2px; }
.gma-ls-item { display: flex; align-items: center; gap: 10px; min-height: 40px; padding: 0 10px; border-radius: 10px;
  color: var(--gma-texto); text-decoration: none; font-size: 13.5px; font-weight: 500; }
.gma-ls-item:hover { background: var(--gma-hover); }
.gma-ls-item[aria-current="true"] { background: var(--gma-activo); color: var(--gma-sobre-activo); font-weight: 600; }
.gma-ls-item span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gma-ls-nueva { width: 100%; box-sizing: border-box; border: 1px dashed var(--gma-borde); margin-bottom: 4px; background: transparent;
  font: inherit; font-size: 13.5px; font-weight: 500; text-align: left; color: var(--gma-tenue); cursor: pointer; }
.gma-ls-nueva[aria-current="true"] { border-style: solid; border-color: transparent; }
.gma-ls-aviso { padding: 12px; font-size: 13px; color: var(--gma-tenue); }
.gma-ls-pie { flex: none; padding: 8px 12px 12px; border-top: 0.8px solid var(--gma-borde-suave); }
.gma-ls-pie a { font-size: 13px; color: var(--gma-tenue); text-decoration: none; }
.gma-ls-pie a:hover { color: var(--gma-texto); text-decoration: underline; }
`;

export function PanelLandings() {
  const { docId, guardarAhora, setPanelIzq, nueva, setNueva } = useEditorLanding();
  const [docs, setDocs] = useState<LandingResumen[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busca, setBusca] = useState('');

  const cargar = async () => {
    setError(null);
    const r = await pedirDocs({ accion: 'listar' });
    // «No pude leerlas» no es «no tienes landings»: se dice y se ofrece reintentar.
    if (!r.ok) { setError(r.error); return; }
    setDocs(r.docs);
  };
  useEffect(() => { void cargar(); }, []);

  const visibles = useMemo(() => landingsDeLaLista(docs ?? [], busca), [docs, busca]);
  // Al irse a otra, lo pendiente de ésta se guarda antes (el mismo gesto que la casa de antes).
  const alIrse = () => { void guardarAhora(); };

  return (
    <div className="gma-ls">
      <style href="gma-landings" precedence="medium">{CSS}</style>
      <div className="gma-ls-cab">
        <input className="gma-ls-busca" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar" aria-label="Buscar una landing" />
        <button type="button" className="gma-ls-mako" onClick={() => setPanelIzq('agente')} title="Volver al chat con MaKo" aria-label="Volver al chat con MaKo">
          <Muneco titulo="MaKo" aspecto={ASPECTO_MAKO} animo="despierto" size={26} />
        </button>
      </div>
      <nav className="gma-ls-lista" aria-label="Tus landings">
        <button type="button" className="gma-ls-item gma-ls-nueva" aria-current={nueva ? 'true' : undefined} onClick={() => setNueva(true)}>
          <Ico n="mas" t={14} /><span>Nueva landing</span>
        </button>
        {error ? (
          <p className="gma-ls-aviso" role="alert">No pude leer tus landings. <button type="button" className="gma-boton gma-boton--chico" onClick={() => { void cargar(); }}>Reintentar</button></p>
        ) : docs === null ? (
          <p className="gma-ls-aviso">Cargando…</p>
        ) : visibles.length === 0 ? (
          <p className="gma-ls-aviso">{busca.trim() ? 'Ninguna se llama así.' : 'Todavía no hay otras.'}</p>
        ) : visibles.map((d) => (
          <Link key={d.id} href={`/web-generator/${d.id}`} className="gma-ls-item" aria-current={!nueva && d.id === docId ? 'true' : undefined}
            onClick={d.id === docId ? (e) => { e.preventDefault(); setPanelIzq('agente'); } : alIrse} title={d.titulo || 'Sin título'}>
            <Ico n="paginas" t={14} /><span>{d.titulo || 'Sin título'}</span>
          </Link>
        ))}
      </nav>
      <div className="gma-ls-pie">
        <Link href={RUTA_NUEVA_LANDING} onClick={alIrse}>Ver todo en el Panel</Link>
      </div>
    </div>
  );
}

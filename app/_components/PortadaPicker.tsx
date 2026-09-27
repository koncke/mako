'use client';

// =============================================================================
// PortadaPicker — elegir qué se ve arriba
// =============================================================================
// «Para el banner tanto que se pueda subir una imagen, como que se pueda
// seleccionar de un repositorio, como lo hace Notion» (27/09/2026).
//
// Tres pestañas, y el orden es la decisión:
//   1. Degradados — el catálogo de `lib/portadas.ts`. Se dibuja SIN RED, entra en
//      cualquier ancho y no puede 404ear, así que es lo que abre.
//   2. Fotos      — el repositorio (`/api/portadas`). Sale a buscar; si no contesta,
//      lo dice: una grilla vacía se lee como «no hay fotos».
//   3. Subir      — la propia.
//
// ⚠️ ES UNO SOLO PARA EL CLIENTE Y PARA EL PROYECTO. La misma pregunta contestada en
// dos componentes son dos componentes que divergen: el día que se agregue una pestaña,
// el otro se queda con dos.

import { useEffect, useRef, useState } from 'react';
import { Modal, Spinner } from '@/app/_ui';
import { GRADIENTES, cssGradiente, valorGradiente, fondoPortada } from '@/lib/portadas';
import type { FotoDeCatalogo } from '@/lib/portadas';

type Pestana = 'degradados' | 'fotos' | 'subir';

export function PortadaPicker({ valor, colorBase, titulo = 'Portada', onElegir, onCerrar }: {
  /** Lo que hay puesto hoy, para marcarlo. */
  valor: string | null | undefined;
  /** El color derivado del nombre: el default, que también es una opción. */
  colorBase: string;
  titulo?: string;
  /** `null` = volver al default. Elegir cierra el selector: es un solo gesto. */
  onElegir: (v: string | null) => void;
  onCerrar: () => void;
}) {
  const [pest, setPest] = useState<Pestana>('degradados');

  return (
    <Modal titulo={titulo} ancho={720} anidada onCerrar={onCerrar}>
      <div className="pp-tabs" role="tablist">
        {(['degradados', 'fotos', 'subir'] as const).map((p) => (
          <button key={p} type="button" role="tab" aria-selected={pest === p}
            className={`pp-tab${pest === p ? ' on' : ''}`} onClick={() => setPest(p)}>
            {p === 'degradados' ? 'Degradados' : p === 'fotos' ? 'Fotos' : 'Subir'}
          </button>
        ))}
        <span style={{ flex: 1 }} />
        {/* Volver al default NO es borrar: es el color derivado del nombre, que es lo
            que se ve hoy. Por eso está a la vista y no escondido en un menú. */}
        <button type="button" className="pp-quitar" onClick={() => onElegir(null)}>Sin portada</button>
      </div>

      {pest === 'degradados' && (
        <ul className="pp-grid">
          <li>
            <button type="button" className={`pp-op${!valor ? ' on' : ''}`} onClick={() => onElegir(null)}
              title="El color derivado del nombre" style={{ background: fondoPortada(null, colorBase) }} />
            <span className="pp-nom">Automático</span>
          </li>
          {GRADIENTES.map((g) => (
            <li key={g.id}>
              <button type="button" className={`pp-op${valor === valorGradiente(g) ? ' on' : ''}`}
                onClick={() => onElegir(valorGradiente(g))} title={g.nombre}
                style={{ background: cssGradiente(g) }} />
              <span className="pp-nom">{g.nombre}</span>
            </li>
          ))}
        </ul>
      )}

      {pest === 'fotos' && <Fotos valor={valor} onElegir={onElegir} />}
      {pest === 'subir' && <Subir onElegir={onElegir} />}

      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </Modal>
  );
}

/** El repositorio. Pagina de a 24; el botón de abajo trae la tanda siguiente. */
function Fotos({ valor, onElegir }: { valor: string | null | undefined; onElegir: (v: string) => void }) {
  const [fotos, setFotos] = useState<FotoDeCatalogo[]>([]);
  const [pagina, setPagina] = useState(1);
  const [cargando, setCargando] = useState(true);
  const [mal, setMal] = useState('');

  // ⚠️ EL `setCargando(true)` NO VA ACÁ ADENTRO. Un `setState` sincrónico dentro de un
  // efecto es un render en cascada (lo marca `react-hooks/set-state-in-effect`), y no hace
  // falta: `pagina` sólo la mueve el botón de abajo, así que el estado de carga lo prende
  // el gesto que lo provoca y este efecto sólo lo apaga.
  useEffect(() => {
    let vivo = true;
    fetch(`/api/portadas?pagina=${pagina}`)
      .then((r) => r.json())
      .then((j: { ok: boolean; fotos?: FotoDeCatalogo[]; error?: string }) => {
        if (!vivo) return;
        // ⚠️ «No pude leer» NO se pinta como «no hay fotos»: son dos pantallas, y la
        // segunda deja a alguien esperando algo que nunca va a llegar.
        if (!j.ok) { setMal(j.error || 'No pude leer el catálogo de fotos.'); return; }
        setFotos((v) => (pagina === 1 ? (j.fotos ?? []) : [...v, ...(j.fotos ?? [])]));
      })
      .catch((e: unknown) => { if (vivo) setMal(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, [pagina]);

  if (mal && !fotos.length) return <p className="pp-mal">{mal}</p>;

  return (
    <>
      <ul className="pp-grid fotos">
        {fotos.map((f) => (
          <li key={f.id}>
            <button type="button" className={`pp-op foto${valor === f.grande ? ' on' : ''}`}
              onClick={() => onElegir(f.grande)} title={f.autor ? `Foto de ${f.autor}` : 'Foto'}>
              {/* Sin `next/image`: son miniaturas de un host externo, y el optimizador
                  las volvería a servir por nuestra función pagando por cada una. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.mini} alt="" loading="lazy" />
            </button>
            <span className="pp-nom">{f.autor}</span>
          </li>
        ))}
      </ul>
      {cargando && <p className="pp-cargando"><Spinner /> Trayendo fotos…</p>}
      {mal && <p className="pp-mal">{mal}</p>}
      {!cargando && !mal && (
        <button type="button" className="pp-mas"
          onClick={() => { setCargando(true); setMal(''); setPagina((p) => p + 1); }}>Ver más fotos</button>
      )}
    </>
  );
}

/** La propia. Sube y elige en el mismo gesto: una foto subida que no se aplica es un paso de más. */
function Subir({ onElegir }: { onElegir: (v: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [mal, setMal] = useState('');

  async function mandar(f: File) {
    setSubiendo(true);
    setMal('');
    try {
      const fd = new FormData();
      fd.append('file', f);
      const r = await fetch('/api/portadas', { method: 'POST', body: fd });
      const j: { ok: boolean; url?: string; error?: string } = await r.json();
      if (!j.ok || !j.url) { setMal(j.error || 'No pude subirla.'); return; }
      onElegir(j.url);
    } catch (e) {
      setMal(e instanceof Error ? e.message : String(e));
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <div className="pp-subir">
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void mandar(f); e.target.value = ''; }} />
      <button type="button" className="pp-btn" disabled={subiendo} onClick={() => input.current?.click()}>
        {subiendo ? <><Spinner /> Subiendo…</> : 'Elegir una imagen'}
      </button>
      <p className="pp-ayuda">JPG, PNG, WEBP o GIF. Hasta 6MB.</p>
      {mal && <p className="pp-mal">{mal}</p>}
    </div>
  );
}

const CSS = `
.pp-tabs{ display:flex; align-items:center; gap:4px; margin:0 0 14px; }
.pp-tab{ background:none; border:0; border-radius:8px; padding:6px 11px; font:inherit; font-size:13px;
  color:var(--dim); cursor:pointer; }
.pp-tab:hover{ color:var(--ink); background:var(--surface-2); }
.pp-tab.on{ color:var(--ink); background:var(--surface-2); font-weight:600; }
.pp-quitar{ background:none; border:0; font:inherit; font-size:12.5px; color:var(--faint);
  cursor:pointer; padding:6px 4px; }
.pp-quitar:hover{ color:var(--bad); }

.pp-grid{ list-style:none; margin:0; padding:0; display:grid; gap:10px;
  grid-template-columns:repeat(auto-fill, minmax(140px, 1fr)); }
.pp-grid > li{ display:flex; flex-direction:column; gap:4px; min-width:0; }
.pp-op{ display:block; width:100%; height:62px; border:1px solid var(--border); border-radius:10px;
  padding:0; overflow:hidden; cursor:pointer; }
.pp-op:hover{ border-color:var(--border-strong); }
.pp-op.on{ border-color:var(--primary); box-shadow:0 0 0 2px var(--primary-bg); }
.pp-op.foto img{ display:block; width:100%; height:100%; object-fit:cover; }
.pp-nom{ font-size:11px; color:var(--faint); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

.pp-cargando{ display:flex; align-items:center; gap:8px; margin:14px 2px 0; font-size:13px; color:var(--dim); }
.pp-mas{ display:block; margin:14px auto 0; background:var(--surface); border:1px solid var(--border-strong);
  border-radius:9px; padding:7px 15px; font:inherit; font-size:13px; color:var(--ink); cursor:pointer; }
.pp-mas:hover{ border-color:var(--primary); color:var(--primary); }
.pp-mal{ margin:14px 2px 0; font-size:13px; color:var(--bad); }

.pp-subir{ display:flex; flex-direction:column; align-items:flex-start; gap:8px; padding:18px 2px 6px; }
.pp-btn{ display:inline-flex; align-items:center; gap:8px; background:var(--primary); border:0;
  border-radius:9px; padding:9px 16px; font:inherit; font-size:13px; color:#fff; cursor:pointer; }
.pp-btn:disabled{ opacity:.7; cursor:default; }
.pp-ayuda{ margin:0; font-size:12px; color:var(--faint); }
`;

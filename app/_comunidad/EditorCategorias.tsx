'use client';

// =============================================================================
// EditorCategorias — las categorías de la comunidad (sólo un admin del workspace)
// =============================================================================
// Como Skool: hasta 10, nombre de hasta 30 letras, quién publica ahí («Todos» o «Solo el equipo») y el
// orden con el que abre. Cada cambio se guarda en el acto; la lista que vuelve del server es la que
// se dibuja (y la que toman los chips del feed).

import { useState } from 'react';
import { Button, Input, Modal, Select } from '@/app/_ui';
import type { CategoriaVista } from '@/lib/comunidad-tipos';
import { MAX_CATEGORIAS, ORDENES_FEED, ROTULO_ORDEN, TOPE_CATEGORIA, type OrdenFeed, type PermisoCategoria } from '@/lib/comunidad-reglas';
import { Ico, useComunidad } from './piezas';

const PERMISOS: Array<{ value: PermisoCategoria; label: string }> = [
  { value: 'todos', label: 'Publican todos' },
  { value: 'equipo', label: 'Solo el equipo' },
];

export function EditorCategorias({ onCerrar }: { onCerrar: () => void }) {
  const { api, comunidad, setComunidad, aviso, confirmar } = useComunidad();
  const [nueva, setNueva] = useState({ nombre: '', permiso: 'todos' as PermisoCategoria, ordenDefault: 'default' as OrdenFeed });
  const [error, setError] = useState<string | null>(null);
  const [enCurso, setEnCurso] = useState(false);
  const lista = comunidad.categorias;

  const aplicar = (categorias: CategoriaVista[]) => setComunidad((c) => ({ ...c, categorias }));

  const correr = async (fn: () => Promise<{ ok: true; categorias: CategoriaVista[] } | { ok: false; error: string }>) => {
    setEnCurso(true);
    setError(null);
    const r = await fn();
    setEnCurso(false);
    if (!r.ok) { setError(r.error); return false; }
    aplicar(r.categorias);
    return true;
  };

  if (!api.guardarCategoria || !api.borrarCategoria || !api.moverCategoria) return null;
  const guardar = api.guardarCategoria;
  const borrarApi = api.borrarCategoria;
  const mover = api.moverCategoria;

  const agregar = async () => {
    if (!nueva.nombre.trim()) { setError('Falta el nombre.'); return; }
    if (await correr(() => guardar(nueva))) setNueva({ nombre: '', permiso: 'todos', ordenDefault: 'default' });
  };
  const borrar = async (c: CategoriaVista) => {
    const si = await confirmar('Sus posts quedan sin categoría.', { title: `¿Borrar «${c.nombre}»?`, confirmLabel: 'Borrar categoría', cancelLabel: 'No borrar' });
    if (si && (await correr(() => borrarApi(c.id)))) aviso('Categoría borrada');
  };

  return (
    <Modal titulo="Categorías" ancho={720} onCerrar={onCerrar} sinFiletes
      pie={<Button variant="secondary" onClick={onCerrar}>Listo</Button>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {lista.length === 0 && <p className="cmu-dim" style={{ margin: 0 }}>Sin categorías. Los posts van sin una.</p>}
        {lista.map((c, i) => (
          <FilaCategoria key={c.id} c={c} primera={i === 0} ultima={i === lista.length - 1} enCurso={enCurso}
            onGuardar={(x) => void correr(() => guardar({ id: c.id, ...x }))}
            onMover={(dir) => void correr(() => mover(c.id, dir))}
            onBorrar={() => void borrar(c)} />
        ))}
        {lista.length < MAX_CATEGORIAS ? (
          <div className="cmu-card" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <div style={{ flex: '1 1 180px', minWidth: 0 }}>
              <Input value={nueva.nombre} maxLength={TOPE_CATEGORIA} placeholder="Nueva categoría" aria-label="Nombre de la categoría"
                onChange={(e) => setNueva((n) => ({ ...n, nombre: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter') void agregar(); }} />
            </div>
            <div style={{ width: 170 }}>
              <Select ariaLabel="Quién publica" value={nueva.permiso} options={PERMISOS}
                onChange={(v) => setNueva((n) => ({ ...n, permiso: v as PermisoCategoria }))} />
            </div>
            <Button onClick={() => void agregar()} loading={enCurso}>Agregar</Button>
          </div>
        ) : <p className="cmu-meta" style={{ margin: 0 }}>Hasta {MAX_CATEGORIAS} categorías.</p>}
        {error && <p className="cmu-error" role="alert">{error}</p>}
      </div>
    </Modal>
  );
}

function FilaCategoria({ c, primera, ultima, enCurso, onGuardar, onMover, onBorrar }: {
  c: CategoriaVista;
  primera: boolean;
  ultima: boolean;
  enCurso: boolean;
  onGuardar: (x: { nombre: string; permiso: PermisoCategoria; ordenDefault: OrdenFeed }) => void;
  onMover: (dir: 'arriba' | 'abajo') => void;
  onBorrar: () => void;
}) {
  const [nombre, setNombre] = useState(c.nombre);
  const guardarNombre = () => { if (nombre.trim() && nombre.trim() !== c.nombre) onGuardar({ nombre, permiso: c.permiso, ordenDefault: c.ordenDefault }); };
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <button type="button" className="cmu-menu-btn" disabled={primera || enCurso} aria-label={`Subir ${c.nombre}`} onClick={() => onMover('arriba')}>↑</button>
        <button type="button" className="cmu-menu-btn" disabled={ultima || enCurso} aria-label={`Bajar ${c.nombre}`} onClick={() => onMover('abajo')}>↓</button>
      </div>
      <div style={{ flex: '1 1 160px', minWidth: 0 }}>
        <Input value={nombre} maxLength={TOPE_CATEGORIA} aria-label="Nombre" onChange={(e) => setNombre(e.target.value)}
          onBlur={guardarNombre} onKeyDown={(e) => { if (e.key === 'Enter') guardarNombre(); }} />
      </div>
      <div style={{ width: 160 }}>
        <Select ariaLabel="Quién publica" value={c.permiso} options={PERMISOS}
          onChange={(v) => onGuardar({ nombre: c.nombre, permiso: v as PermisoCategoria, ordenDefault: c.ordenDefault })} />
      </div>
      <div style={{ width: 140 }}>
        <Select ariaLabel="Orden al abrir" value={c.ordenDefault}
          options={ORDENES_FEED.map((o) => ({ value: o, label: ROTULO_ORDEN[o] }))}
          onChange={(v) => onGuardar({ nombre: c.nombre, permiso: c.permiso, ordenDefault: v as OrdenFeed })} />
      </div>
      <button type="button" className="cmu-menu-btn" aria-label={`Borrar ${c.nombre}`} onClick={onBorrar}><Ico n="x" size={15} /></button>
    </div>
  );
}

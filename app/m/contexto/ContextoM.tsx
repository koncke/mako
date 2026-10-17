'use client';

// =============================================================================
// MaKo Context en el teléfono: Conocimiento, Fases y Prompts, cada uno con su hoja (la «Personalización» de ChatGPT)
// =============================================================================
// Las acciones de la computadora (ContextoTabs.tsx), con sus mismos nombres: el conocimiento se crea, se activa o
// desactiva, se reindexa y se borra; cada fase guarda su texto; cada prompt guarda una versión nueva. Borrar pide un
// segundo toque que dice qué se borra. Todo vuelve a leer al refrescar (`leido`).
// =============================================================================

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/app/_ui/Button';
import { useWs } from '@/app/_ui/Link';
import { haptico } from '@/lib/haptico';
import {
  ErrorM, FilaM, ListaM, PieM, PildoraM, SeccionM, SheetM, SkeletonFilas, useToastM, type TonoPildora,
} from '@/app/m/_ui';
import { FilaEnComputadoraM, abrirEnComputadora } from '@/app/m/_ui/EnComputadoraM';

type Estado = 'indexado' | 'pendiente' | 'error';
type Entry = { id: number; titulo: string; categoria: string | null; cuerpo: string; activo: boolean; estado: Estado; error: string | null; updated_at: string };
type Fase = { key: string; label: string; ejemplo: string };
type PromptModo = { key: string; label: string; current: string; isDefault: boolean; versions: Array<{ ts: string; text: string }> };
type Datos = { entries: Entry[]; fases: Fase[]; valores: Record<string, string>; modos: PromptModo[] };

/** Los rótulos y colores de escritorio (`EstadoBadge` de ContextoTabs.tsx). */
const ESTADO: Record<Estado, { t: string; tono: TonoPildora }> = {
  indexado: { t: 'Indexado', tono: 'good' }, pendiente: { t: 'Pendiente', tono: 'warn' }, error: { t: 'Error', tono: 'bad' },
};

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { ...init, signal: AbortSignal.timeout(30_000) });
  const j = (await r.json().catch(() => ({}))) as T & { error?: string };
  if (!r.ok) throw new Error(j.error ?? `${url} respondió ${r.status}`);
  return j;
}
const post = (url: string, body: Record<string, unknown>) =>
  json<{ ok?: boolean; error?: string }>(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

type Hoja = { tipo: 'entrada'; e: Entry } | { tipo: 'nueva' } | { tipo: 'fase'; f: Fase } | { tipo: 'prompt'; m: PromptModo };

export function ContextoM({ leido }: { leido: number }) {
  const toast = useToastM();
  const ws = useWs();
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hoja, setHoja] = useState<Hoja | null>(null);
  const [texto, setTexto] = useState('');
  const [titulo, setTitulo] = useState('');
  const [categoria, setCategoria] = useState('');
  const [confirmar, setConfirmar] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const [k, f, p] = await Promise.all([
        json<{ entries?: Entry[] }>('/api/mako/knowledge'),
        json<{ fases?: Fase[]; valores?: Record<string, string> }>('/api/mako/fases'),
        json<{ modos?: PromptModo[] }>('/api/mako/prompts'),
      ]);
      setDatos({ entries: k.entries ?? [], fases: f.fases ?? [], valores: f.valores ?? {}, modos: p.modos ?? [] });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo leer el contexto de MaKo.');
    }
  }, []);
  useEffect(() => { void cargar(); }, [cargar, leido]);

  /** Abre una hoja con su texto de arranque. El sub-estado se resetea al ABRIR (LEEME de app/m/_ui). */
  const abrir = (h: Hoja) => {
    setConfirmar(false);
    if (h.tipo === 'entrada') setTexto(h.e.cuerpo);
    else if (h.tipo === 'fase') setTexto(datos?.valores[h.f.key] ?? '');
    else if (h.tipo === 'prompt') setTexto(h.m.current);
    else { setTexto(''); setTitulo(''); setCategoria(''); }
    setHoja(h);
  };

  const correr = async (fn: () => Promise<unknown>, listo: string) => {
    if (ocupado) return;
    setOcupado(true);
    try {
      await fn();
      haptico('success'); toast(listo);
      setHoja(null);
      await cargar();
    } catch (e) {
      haptico('error'); toast(e instanceof Error && e.message.length < 40 ? e.message : 'No se pudo guardar');
    } finally { setOcupado(false); }
  };

  if (error) return <ErrorM frase={error} onReintentar={() => { void cargar(); }} />;
  if (!datos) return <SkeletonFilas />;

  const tituloHoja = !hoja ? '' : hoja.tipo === 'entrada' ? hoja.e.titulo : hoja.tipo === 'nueva' ? 'Agregar conocimiento'
    : hoja.tipo === 'fase' ? hoja.f.label : hoja.m.label;

  return (
    <>
      <SeccionM titulo="Conocimiento">
        <ListaM>
          {datos.entries.map((e) => (
            <FilaM key={e.id} titulo={e.titulo} segunda={e.categoria ?? (e.activo ? undefined : 'Desactivado')}
              pill={<PildoraM tono={e.activo ? ESTADO[e.estado].tono : 'neutro'}>{e.activo ? ESTADO[e.estado].t : 'Desactivado'}</PildoraM>}
              onClick={() => abrir({ tipo: 'entrada', e })} />
          ))}
          <FilaM navegacion icono="plus" titulo="Agregar conocimiento" chevron={false} onClick={() => abrir({ tipo: 'nueva' })} />
        </ListaM>
      </SeccionM>

      <SeccionM titulo="Fases">
        <ListaM>
          {datos.fases.map((f) => (
            <FilaM key={f.key} titulo={f.label} segunda={(datos.valores[f.key] ?? '').trim() || 'Sin texto: MaKo usa lo de siempre'}
              onClick={() => abrir({ tipo: 'fase', f })} />
          ))}
        </ListaM>
      </SeccionM>

      <SeccionM titulo="Prompts">
        <ListaM>
          {datos.modos.map((m) => (
            <FilaM key={m.key} titulo={m.label} segunda={m.versions.length ? `${m.versions.length} versiones` : undefined}
              pill={m.isDefault ? undefined : <PildoraM tono="info">editado</PildoraM>} onClick={() => abrir({ tipo: 'prompt', m })} />
          ))}
        </ListaM>
      </SeccionM>

      <SeccionM titulo="Configuración">
        <ListaM>
          <FilaEnComputadoraM icono="config" titulo="Prompts de cada pantalla" href="/contexto"
            motivo="Son los textos con los que MaKo escribe en cada pantalla, con sus variables y su historial: se editan en la computadora." />
        </ListaM>
      </SeccionM>

      <SheetM id="contexto" abierto={hoja != null} onCerrar={() => setHoja(null)} titulo={tituloHoja} snap="alto" ocupado={ocupado}
        rotuloCerrar="Cerrar sin guardar"
        pie={hoja ? (
          <PieM consecuencia={confirmar ? 'MaKo deja de saberlo. No se puede deshacer.' : hoja.tipo === 'prompt' ? 'Guarda una versión nueva: la anterior queda en el historial.' : undefined}>
            {confirmar && hoja.tipo === 'entrada' ? (
              <Button variant="danger" size="lg" full loading={ocupado}
                onClick={() => { void correr(() => post('/api/mako/knowledge', { action: 'delete', id: hoja.e.id }), 'Borrado'); }}>
                {`Borrar «${hoja.e.titulo}»`}
              </Button>
            ) : (
              <Button variant="primary" size="lg" full loading={ocupado} onClick={() => {
                if (hoja.tipo === 'nueva') {
                  if (!titulo.trim()) { toast('Falta el título'); return; }
                  void correr(() => post('/api/mako/knowledge', { action: 'create', titulo, categoria: categoria || null, cuerpo: texto }), 'Agregado');
                } else if (hoja.tipo === 'entrada') {
                  void correr(() => post('/api/mako/knowledge', { action: 'update', id: hoja.e.id, cuerpo: texto }), 'Guardado');
                } else if (hoja.tipo === 'fase') {
                  void correr(() => post('/api/mako/fases', { key: hoja.f.key, value: texto }), 'Guardado');
                } else {
                  void correr(() => post('/api/mako/prompts', { action: 'save', modo: hoja.m.key, text: texto }), 'Guardado');
                }
              }}>{hoja.tipo === 'nueva' ? 'Agregar' : 'Guardar'}</Button>
            )}
            {hoja.tipo === 'entrada' && !confirmar && (
              <button type="button" className="m-configuraciones-borrar" disabled={ocupado} onClick={() => setConfirmar(true)}>Borrar</button>
            )}
          </PieM>
        ) : undefined}>
        {hoja?.tipo === 'nueva' && (
          <>
            <label className="m-configuraciones-campo">
              <span>Título</span>
              <input className="m-configuraciones-entrada" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
            </label>
            <label className="m-configuraciones-campo">
              <span>Categoría</span>
              <input className="m-configuraciones-entrada" value={categoria} onChange={(e) => setCategoria(e.target.value)} />
            </label>
          </>
        )}
        {hoja && (
          <label className="m-configuraciones-campo">
            <span>{hoja.tipo === 'fase' ? 'Qué hace MaKo en esta fase' : hoja.tipo === 'prompt' ? 'El prompt' : 'Lo que MaKo tiene que saber'}</span>
            <textarea className="m-configuraciones-entrada m-contexto-texto" value={texto}
              placeholder={hoja.tipo === 'fase' ? hoja.f.ejemplo : undefined} onChange={(e) => setTexto(e.target.value)} />
          </label>
        )}
        {hoja?.tipo === 'entrada' && (
          <ListaM>
            <FilaM navegacion icono={hoja.e.activo ? 'pausa' : 'play'} titulo={hoja.e.activo ? 'Desactivar' : 'Activar'} chevron={false} deshabilitada={ocupado}
              onClick={() => { void correr(() => post('/api/mako/knowledge', { action: 'update', id: hoja.e.id, activo: !hoja.e.activo }), hoja.e.activo ? 'Desactivado' : 'Activado'); }} />
            <FilaM navegacion icono="regenerar" titulo="Reindexar" chevron={false} deshabilitada={ocupado}
              onClick={() => { void correr(() => post('/api/mako/knowledge', { action: 'reindex', id: hoja.e.id }), 'Reindexando'); }} />
          </ListaM>
        )}
        {hoja?.tipo === 'entrada' && hoja.e.error && <p className="m-configuraciones-aviso" data-tono="bad">{hoja.e.error}</p>}
        {hoja?.tipo === 'prompt' && hoja.m.versions.length > 0 && (
          <ListaM>
            <FilaM navegacion icono="reloj" titulo="Historial de versiones" segunda="En la computadora" chevron={false}
              onClick={() => abrirEnComputadora('/contexto', ws)} />
          </ListaM>
        )}
      </SheetM>
    </>
  );
}

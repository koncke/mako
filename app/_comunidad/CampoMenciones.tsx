'use client';

// =============================================================================
// CampoMenciones — un texto con @menciones (el cuerpo de un post y los comentarios)
// =============================================================================
// Un `<textarea>` común (el editor rico es de otra pista): al escribir `@` aparecen los miembros de
// la comunidad, y elegir uno escribe `@Nombre ` y lo anota en `menciones`. Lo que se manda al server es
// el texto y las claves; el server se queda SÓLO con las que el texto de verdad nombra y son miembros
// (`sanearMenciones`), así que borrar el nombre del texto basta para «sacar» la mención.
//
// La lista de miembros se pide UNA vez por comunidad, la primera vez que alguien escribe `@`, y se
// filtra acá (sin acentos ni mayúsculas): pedirla por cada tecla serían diez pedidos por nombre.

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { ApiComunidad } from './api';
import type { MiembroDirectorio } from '@/lib/comunidad-tipos';
import { consultaDeMencion, insertarMencion, nombreCoincide, nombraA } from '@/lib/comunidad-reglas';
import { AvatarNivel, CapaPopover, useComunidad } from './piezas';

export type Mencion = { clave: string; nombre: string };

/** Los miembros, por API: se piden una vez y se reusan (la API es la misma mientras no cambie el producto). */
const cache = new WeakMap<ApiComunidad, Promise<MiembroDirectorio[]>>();
function mencionables(api: ApiComunidad): Promise<MiembroDirectorio[]> {
  let p = cache.get(api);
  if (!p) {
    p = api.miembros({ filtro: 'todos', q: '' }).then((r) => (r.ok ? r.miembros.miembros : []));
    // Un fallo no queda cacheado: el próximo `@` vuelve a intentar.
    p.then((l) => { if (!l.length) cache.delete(api); });
    cache.set(api, p);
  }
  return p;
}

/** Las menciones que el texto TODAVÍA nombra (las borradas del texto no viajan). */
export const mencionesVigentes = (texto: string, menciones: readonly Mencion[]): string[] =>
  menciones.filter((m) => nombraA(texto, m.nombre)).map((m) => m.clave);

export function CampoMenciones({
  valor, onCambio, menciones, onMenciones, placeholder, filas = 3, maxLength, autoFocus = false, onEnviar, etiqueta,
}: {
  valor: string;
  onCambio: (v: string) => void;
  menciones: readonly Mencion[];
  onMenciones: (m: Mencion[]) => void;
  placeholder?: string;
  filas?: number;
  maxLength?: number;
  autoFocus?: boolean;
  /** Ctrl/Cmd + Enter. */
  onEnviar?: () => void;
  etiqueta?: string;
}) {
  const { api } = useComunidad();
  const ref = useRef<HTMLTextAreaElement>(null);
  const caja = useRef<HTMLDivElement>(null);
  const [consulta, setConsulta] = useState<{ ini: number; q: string } | null>(null);
  const [lista, setLista] = useState<MiembroDirectorio[]>([]);
  const [sel, setSel] = useState(0);

  useEffect(() => { if (autoFocus) ref.current?.focus(); }, [autoFocus]);

  // Las sugerencias: la lista entera una vez, filtrada por lo escrito.
  useEffect(() => {
    if (!consulta) return;
    let vivo = true;
    void mencionables(api).then((todos) => { if (vivo) setLista(todos); });
    return () => { vivo = false; };
  }, [api, consulta]);
  const sugerencias = consulta ? lista.filter((m) => nombreCoincide(m.nombre, consulta.q)).slice(0, 6) : [];

  const mirar = (texto: string) => {
    const el = ref.current;
    const c = el ? consultaDeMencion(texto, el.selectionStart ?? texto.length) : null;
    setConsulta(c);
    setSel(0);
  };

  const elegir = (m: MiembroDirectorio) => {
    const el = ref.current;
    if (!el || !consulta) return;
    const r = insertarMencion(valor, el.selectionStart ?? valor.length, consulta, m.nombre);
    onCambio(r.texto);
    if (!menciones.some((x) => x.clave === m.clave)) onMenciones([...menciones, { clave: m.clave, nombre: m.nombre }]);
    setConsulta(null);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(r.cursor, r.cursor); });
  };

  // Escape (y el clic afuera) los cierra `CapaPopover`, abajo: las sugerencias viven adentro de un
  // Modal, y un Escape atendido acá llegaba DESPUÉS de que el modal se cerrara con él.
  const tecla = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (sugerencias.length) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => (s + 1) % sugerencias.length); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => (s - 1 + sugerencias.length) % sugerencias.length); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); elegir(sugerencias[sel] ?? sugerencias[0]); return; }
    }
    if (onEnviar && e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); onEnviar(); }
  };

  return (
    <div className="cmu-campo" ref={caja}>
      {consulta && sugerencias.length > 0 && <CapaPopover caja={caja} onCerrar={() => setConsulta(null)} />}
      <textarea
        ref={ref}
        className="cmu-area"
        value={valor}
        rows={filas}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-label={etiqueta ?? placeholder}
        onChange={(e) => { onCambio(e.target.value); mirar(e.target.value); }}
        onKeyDown={tecla}
        onClick={() => mirar(valor)}
        onBlur={() => setTimeout(() => setConsulta(null), 150)}
      />
      {consulta && sugerencias.length > 0 && (
        <div className="cmu-sug" role="listbox" aria-label="Mencionar a">
          {sugerencias.map((m, i) => (
            <button key={m.clave} type="button" role="option" aria-selected={i === sel} className="cmu-sug-item" data-on={i === sel}
              onMouseDown={(e) => { e.preventDefault(); elegir(m); }}>
              <AvatarNivel m={m} size={28} />
              <span className="cmu-nombre">{m.nombre}</span>
              {m.equipo && <span className="cmu-tag cmu-tag--equipo">Equipo</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

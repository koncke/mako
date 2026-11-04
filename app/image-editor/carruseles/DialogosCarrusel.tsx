'use client';

// =============================================================================
// Los dos diálogos de los carruseles de MaKo: «Ver ejemplo» de un tipo y «Hacer el mío» desde una referencia
// =============================================================================
// · «Ver ejemplo» (la regla de Martín del 29/10: la plantilla muestra la ESTRUCTURA y el ejemplo lleno se ve APARTE): todas
//   las láminas del ejemplo de un negocio ficticio, una al lado de la otra, y «Usar esta estructura».
// · «Hacer el mío»: lo que se entendió de la referencia (tipo, láminas, con qué abre y qué pide al final) a la vista, con el
//   tipo y las láminas para cambiar, y las primeras láminas de lo que se va a crear (AGENTS.md: lo que se interpreta de un
//   texto pasa por un toque de la persona, que ve lo que se entendió). Nunca sus palabras: las láminas llevan guías.
// Las láminas se dibujan desde el MISMO documento que se crea (./MiniaturaCarrusel.tsx).
// =============================================================================

import { useMemo, useState } from 'react';
import { Modal } from '@/app/_ui/Modal';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { documentoDeCarrusel } from '@/lib/carruseles/documento';
import { estructuraDe, frasesDe, laminasDesde } from '@/lib/carruseles/referencia';
import { TIPOS_CARRUSEL, laminasDelTipo, tipoCarrusel, type IdTipoCarrusel, type TipoCarrusel } from '@/lib/carruseles/tipos';
import type { Carrusel } from '@/lib/carruseles/explorar';
import { PaginaCarrusel } from './MiniaturaCarrusel';
import s from './dialogos.module.css';

let contador = 0;
const idLocal = () => `v${++contador}`;

/** Las láminas de un documento, en fila (se corre de costado: es CONTENIDO, no una barra). */
function Tira({ doc, ancho = 200 }: { doc: Record<string, unknown>; ancho?: number }) {
  const paginas = Array.isArray(doc.pages) ? (doc.pages as Record<string, unknown>[]) : [];
  return (
    <ol className={s.tira} aria-label="Láminas">
      {paginas.map((p, i) => (
        <li key={i} style={{ width: ancho }}>
          <PaginaCarrusel pagina={p} etiqueta={`Lámina ${i + 1}: ${String(p.name ?? '')}`} />
          <span className={s.num}>{i + 1}. {String(p.name ?? '')}</span>
        </li>
      ))}
    </ol>
  );
}

export function VerEjemplo({ tipo, onCerrar, onUsar }: {
  tipo: TipoCarrusel;
  onCerrar: () => void;
  /** Crea el diseño con la estructura de este tipo; un texto de vuelta es el error. */
  onUsar: () => Promise<string | null>;
}) {
  const doc = useMemo(() => documentoDeCarrusel({
    laminas: tipo.ejemplo.laminas, estilo: tipo.estilo, marca: { nombre: tipo.ejemplo.negocio, usuario: tipo.ejemplo.usuario }, nuevoId: idLocal,
  }), [tipo]);
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const usar = async () => {
    setCreando(true); setError(null);
    const e = await onUsar().catch((x: unknown) => (x instanceof Error ? x.message : 'No se pudo crear el carrusel.'));
    if (e) { setError(e); setCreando(false); }
  };
  return (
    <Modal titulo={tipo.nombre} encabezado={`Ejemplo · ${tipo.ejemplo.negocio} (negocio ficticio)`} onCerrar={onCerrar} ancho={980}
      pie={<>
        <button type="button" className={s.secundario} onClick={onCerrar} disabled={creando}>Cerrar</button>
        <button type="button" className={s.primario} onClick={() => { void usar(); }} disabled={creando}>{creando ? 'Creando…' : 'Usar esta estructura'}</button>
      </>}>
      <p className={s.nota}>{tipo.cuando} La plantilla trae esta estructura con guías donde va lo tuyo.</p>
      <Tira doc={doc} />
      {error && <p role="alert" className={s.error}>{error}<ReportarASoporte /></p>}
    </Modal>
  );
}

export function HacerElMio({ carrusel, marca, onCerrar, onCrear }: {
  carrusel: Carrusel;
  marca: { nombre: string; usuario: string | null };
  onCerrar: () => void;
  /** Crea el diseño; un texto de vuelta es el error. */
  onCrear: (tipo: IdTipoCarrusel, laminas: number) => Promise<string | null>;
}) {
  const est = useMemo(() => estructuraDe(carrusel), [carrusel]);
  const [tipo, setTipo] = useState<IdTipoCarrusel | ''>(est.tipo ?? '');
  const t = tipo ? tipoCarrusel(tipo) : null;
  const [laminas, setLaminas] = useState<number | null>(null);
  const n = t ? laminasDelTipo(t, laminas ?? est.laminas ?? undefined) : null;
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const doc = useMemo(() => (t && n ? documentoDeCarrusel({ laminas: laminasDesde(est, t.id, n), estilo: t.estilo, marca, nuevoId: idLocal }) : null), [t, n, est, marca]);

  const crear = async () => {
    if (!t || !n) return;
    setCreando(true); setError(null);
    const e = await onCrear(t.id, n).catch((x: unknown) => (x instanceof Error ? x.message : 'No se pudo crear el carrusel.'));
    if (e) { setError(e); setCreando(false); }
  };

  return (
    <Modal titulo="Hacer el mío" encabezado={`Con la estructura de ${est.de}`} onCerrar={onCerrar} ancho={760}
      pie={<>
        <button type="button" className={s.secundario} onClick={onCerrar} disabled={creando}>Cancelar</button>
        <button type="button" className={s.primario} onClick={() => { void crear(); }} disabled={!t || creando}>{creando ? 'Creando…' : 'Crear mi carrusel'}</button>
      </>}>
      <div className={s.referencia}>
        {carrusel.miniatura
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={carrusel.miniatura} alt="" referrerPolicy="no-referrer" />
          : null}
        <div>
          <p className={s.nota}>Lo que entendí de su estructura:</p>
          <ul className={s.chips}>{frasesDe(est).map((f) => <li key={f}>{f}</li>)}</ul>
          <p className={s.nota}>Se copia la estructura, no sus palabras: cada lámina trae una guía de qué escribir.</p>
        </div>
      </div>
      <div className={s.campos}>
        <label>
          <span>Tipo</span>
          <select value={tipo} onChange={(e) => { setTipo(e.target.value as IdTipoCarrusel); setLaminas(null); }}>
            {!tipo && <option value="">Elige el tipo</option>}
            {TIPOS_CARRUSEL.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
          </select>
        </label>
        {t && n ? (
          <label>
            <span>Láminas</span>
            <select value={n} onChange={(e) => setLaminas(Number(e.target.value))}>
              {Array.from({ length: t.laminas.max - t.laminas.min + 1 }, (_, i) => t.laminas.min + i).map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </label>
        ) : null}
      </div>
      {doc ? <Tira doc={doc} ancho={150} /> : <p className={s.nota}>Elige qué tipo de carrusel es para ver cómo queda.</p>}
      {error && <p role="alert" className={s.error}>{error}<ReportarASoporte /></p>}
    </Modal>
  );
}

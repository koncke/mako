'use client';

// =============================================================================
// El diálogo «Ver ejemplo» de un tipo de carrusel de MaKo
// =============================================================================
// · «Ver ejemplo» (la regla de Martín del 29/10: la plantilla muestra la ESTRUCTURA y el ejemplo lleno se ve APARTE): todas
//   las láminas del ejemplo de un negocio ficticio, una al lado de la otra, y «Usar esta estructura».
// · «Hacer el mío» (con su «Elige el tipo») se fue el 6/11/2026: un ejemplo del explorador se EDITA directo, y la IA del
//   negocio arma su versión (./EditarCarrusel.tsx, lib/carruseles/replica.ts).
// Las láminas se dibujan desde el MISMO documento que se crea (./MiniaturaCarrusel.tsx).
// =============================================================================

import { useMemo, useState } from 'react';
import { Modal } from '@/app/_ui/Modal';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { documentoDeCarrusel } from '@/lib/carruseles/documento';
import type { TipoCarrusel } from '@/lib/carruseles/tipos';
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

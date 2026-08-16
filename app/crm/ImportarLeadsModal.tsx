'use client';

// =============================================================================
// ImportarLeadsModal — ver y CORREGIR lo que va a entrar, antes de que entre
// =============================================================================
// Tenía dos agujeros y los dos se sentían igual de mal:
//
//  1. Solo aceptaba CSV. Un PDF o una foto de una lista de contactos —que es como
//     llegan de verdad— fallaba con un error críptico. Ahora pasa por el lector
//     compartido (lib/archivo-a-texto: PDF con capa de texto, visión para
//     escaneos e imágenes, docx) y la IA barata devuelve los contactos. Los
//     formatos que no se soportan lo dicen con qué hacer, no rompen.
//
//  2. No había dónde revisar. El paso 2 mostraba tres números ("12 nuevos,
//     4 omitidos") y el usuario no podía ver CUÁLES ni por qué, mucho menos
//     arreglar un nombre mal escrito. Ahora hay una tabla editable: cada fila se
//     corrige en el lugar, se tilda o se destilda, y las descartadas se muestran
//     ATENUADAS con su motivo — nunca escondidas, porque una fila que desaparece
//     sin explicación es la que después se reclama.
//
// Nada se crea hasta el último click, y al confirmar viajan las FILAS EDITADAS
// (no el archivo). El server vuelve a validar todo contra la base.
// =============================================================================

import { useMemo, useRef, useState, type CSSProperties, type DragEvent } from 'react';
import { WizardShell } from '../_components/WizardShell';
import { importarLeadsRevisadosAction } from './actions';
import { TablaRevisionLeads } from './TablaRevisionLeads';
import {
  ACCEPT_IMPORT, MENSAJE_PLANILLA,
  contar, esPlanilla, recalcular,
  type FilaImport, type LecturaImport,
} from './leads-importar';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";
const MAX_BYTES = 8 * 1024 * 1024;

const peso = (n: number): string => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);
const rotulo: CSSProperties = { fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)' };


export function ImportarLeadsModal({ onListo, onClose }: {
  /** Se llama al terminar la importación, con el resumen para avisar arriba. */
  onListo: (resumen: string) => void;
  onClose: () => void;
}) {
  const [paso, setPaso] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [sobre, setSobre] = useState(false);
  const [filas, setFilas] = useState<FilaImport[]>([]);
  const [viaIA, setViaIA] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const c = useMemo(() => contar(filas), [filas]);

  const tomar = (fl: FileList | File[] | null) => {
    const fArch = fl && Array.from(fl)[0];
    if (!fArch) return;
    setFilas([]);
    setAviso(null);
    // El .xlsx se ataja acá y no en el server: así el usuario se entera antes de
    // esperar una subida de varios megas para nada.
    if (esPlanilla(fArch.name)) { setErr(MENSAJE_PLANILLA); setFile(null); return; }
    setErr(fArch.size > MAX_BYTES ? 'El archivo pesa más de 8 MB.' : null);
    setFile(fArch);
  };

  // Paso 1 → 2: el archivo lo lee un route (una server action tope en 1 MB y acá
  // suben PDFs de varios megas). No se crea NADA todavía.
  const analizar = async () => {
    if (!file) return;
    setCargando(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/crm/importar-leads', { method: 'POST', body: fd });
      const data = (await res.json().catch(() => null)) as LecturaImport | null;
      if (!data) { setErr(`No pude leer el archivo (error ${res.status}).`); return; }
      if (!data.ok) { setErr(data.error); return; }
      setFilas(recalcular(data.filas));
      setViaIA(data.viaIA);
      setAviso(data.aviso ?? null);
      setPaso(1);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo leer el archivo.');
    } finally {
      setCargando(false);
    }
  };

  const importar = () => {
    setCargando(true);
    setErr(null);
    importarLeadsRevisadosAction(filas)
      .then((r) => {
        if (!r.creados && r.errores.length) { setErr(r.errores[0]); setCargando(false); return; }
        const extra = r.errores.length ? ` · ${r.errores.length} con error` : '';
        onListo(`✓ ${r.creados} lead${r.creados === 1 ? '' : 's'} nuevo${r.creados === 1 ? '' : 's'} · ${r.omitidos} omitido${r.omitidos === 1 ? '' : 's'}${extra}`);
      })
      .catch((e) => { setErr(e instanceof Error ? e.message : 'No se pudo importar'); setCargando(false); });
  };




  const enUltimo = paso === 1;
  const puede = paso === 0 ? !!file && !err : c.tildadas > 0;

  // ── Paso 1: el archivo ─────────────────────────────────────────────────────

  const pasoArchivo = () => (
    <div style={{ fontFamily: SANS }}>
      <div
        onDragOver={(e) => { e.preventDefault(); setSobre(true); }}
        onDragLeave={() => setSobre(false)}
        onDrop={(e: DragEvent) => { e.preventDefault(); setSobre(false); tomar(e.dataTransfer?.files ?? null); }}
        onClick={() => input.current?.click()}
        style={{
          border: `1.5px dashed ${sobre ? 'var(--primary)' : 'var(--border-strong)'}`,
          background: sobre ? 'color-mix(in srgb, var(--primary) 7%, transparent)' : 'var(--surface-2)',
          borderRadius: 13, padding: '22px 18px', textAlign: 'center', cursor: 'pointer', transition: 'border-color .15s, background .15s',
        }}
      >
        <div style={{ fontSize: 24, marginBottom: 6 }}>📥</div>
        <div style={{ fontSize: 14, fontWeight: 650, color: 'var(--ink)' }}>Arrastrá el archivo acá</div>
        <div style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: 5, lineHeight: 1.5 }}>
          o hacé click para buscarlo. Anda con <strong>CSV</strong>, y también con PDF, fotos y documentos:
          de esos MaKo saca los contactos y los revisás en el próximo paso.
        </div>
        <input ref={input} type="file" accept={ACCEPT_IMPORT} style={{ display: 'none' }}
          onChange={(e) => { tomar(e.target.files); e.target.value = ''; }} />
      </div>

      {file && (
        <div style={{ marginTop: 14 }}>
          <div style={{ ...rotulo, marginBottom: 7, textAlign: 'left' }}>Archivo</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)' }}>
            <span style={{ fontSize: 16, flex: 'none' }}>📄</span>
            <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
              <div style={{ fontSize: 13, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{file.name}</div>
              <div style={{ fontSize: 11.5, color: 'var(--dim)', marginTop: 2 }}>{peso(file.size)}</div>
            </div>
            <button type="button" aria-label={`Sacar ${file.name}`} onClick={(e) => { e.stopPropagation(); setFile(null); setFilas([]); setErr(null); }}
              style={{ border: 'none', background: 'transparent', color: 'var(--faint)', cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: 3, flex: 'none' }}>×</button>
          </div>
        </div>
      )}
    </div>
  );

  // ── Paso 2: la revisión ────────────────────────────────────────────────────

  // La tabla es la MISMA que la de /crm/revisar: se extrajo a TablaRevisionLeads para
  // que revisar una importación y revisar lo que propuso un canal se vean y se
  // comporten igual. Antes vivía acá adentro y era el único lugar donde existía.
  const pasoRevisar = () => (
    <TablaRevisionLeads filas={filas} onFilas={setFilas} viaIA={viaIA} aviso={aviso} />
  );

  return (
    <WizardShell
      ancho={paso === 0 ? 640 : 940}
      titulo={paso === 0 ? 'Importar leads' : `Importar leads · ${filas.length} fila${filas.length === 1 ? '' : 's'}`}
      total={2} idx={paso}
      pregunta={paso === 0 ? '¿Qué archivo querés importar?' : '¿Está bien lo que va a entrar?'}
      sub={paso === 1 ? 'Corregí lo que haga falta y tildá qué se crea.' : undefined}
      error={err}
      pending={cargando}
      puedeAvanzar={puede}
      enUltimo={enUltimo}
      confirmLabel={c.tildadas > 0 ? `Crear ${c.tildadas} lead${c.tildadas === 1 ? '' : 's'} →` : 'No hay nada tildado'}
      siguienteLabel="Revisar →"
      atrasLabel={paso === 0 ? 'Cancelar' : 'Atrás'}
      onAtras={() => (paso === 0 ? onClose() : setPaso(0))}
      onSiguiente={() => { void analizar(); }}
      onConfirmar={() => { if (puede && !cargando) importar(); }}
      onClose={onClose}
    >
      {paso === 0 ? pasoArchivo() : pasoRevisar()}
    </WizardShell>
  );
}

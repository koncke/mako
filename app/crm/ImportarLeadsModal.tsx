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
import {
  ACCEPT_IMPORT, FILAS_POR_PAGINA, MENSAJE_PLANILLA, MOTIVO_LABEL, UMBRAL_PAGINADO,
  contar, esPlanilla, recalcular,
  type FilaImport, type LecturaImport,
} from './leads-importar';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";
const MAX_BYTES = 8 * 1024 * 1024;

const peso = (n: number): string => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);
const rotulo: CSSProperties = { fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)' };
const celdaInput: CSSProperties = { width: '100%', padding: '6px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 12.5, outline: 'none', minWidth: 0 };
/** Mismo reparto de columnas para el encabezado y para cada fila. */
const GRID = '26px 1.2fr 1.4fr 1fr 1fr 128px';

function Chip({ n, texto, color }: { n: number; texto: string; color: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 5, padding: '5px 10px', borderRadius: 999, border: '1px solid var(--border)', background: 'var(--surface-2)', fontFamily: SANS, fontSize: 12 }}>
      <strong style={{ color, fontVariantNumeric: 'tabular-nums', fontSize: 13 }}>{n}</strong>
      <span style={{ color: 'var(--dim)' }}>{texto}</span>
    </span>
  );
}

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
  const [pagina, setPagina] = useState(0);
  const [cargando, setCargando] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const c = useMemo(() => contar(filas), [filas]);

  const tomar = (fl: FileList | File[] | null) => {
    const fArch = fl && Array.from(fl)[0];
    if (!fArch) return;
    setFilas([]);
    setPagina(0);
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

  const editar = (id: string, campo: 'nombre' | 'email' | 'telefono' | 'empresa', v: string) => {
    setFilas((prev) => recalcular(prev.map((f) => {
      if (f.id !== id) return f;
      const next: FilaImport = { ...f, [campo]: v };
      // Cambiar el contacto invalida el "ya existe" que el server resolvió contra
      // el valor viejo. Al confirmar se vuelve a chequear igual, así que no se
      // pierde nada por darle el beneficio de la duda mientras edita.
      if (campo === 'email' || campo === 'telefono') next.yaExiste = false;
      // Si estaba descartada y la está arreglando, se tilda sola: ya se tomó el
      // trabajo de completarla, pedirle además que la marque es de más.
      if (f.motivo) next.incluir = true;
      return next;
    })));
  };

  const tildar = (id: string) => setFilas((prev) => prev.map((f) => (f.id === id && !f.motivo ? { ...f, incluir: !f.incluir } : f)));
  const soloNuevas = () => setFilas((prev) => prev.map((f) => ({ ...f, incluir: !f.motivo })));
  const destildarTodo = () => setFilas((prev) => prev.map((f) => ({ ...f, incluir: false })));

  const paginado = filas.length > UMBRAL_PAGINADO;
  const paginas = paginado ? Math.ceil(filas.length / FILAS_POR_PAGINA) : 1;
  const pag = Math.min(pagina, paginas - 1);
  const visibles = paginado ? filas.slice(pag * FILAS_POR_PAGINA, (pag + 1) * FILAS_POR_PAGINA) : filas;

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
              <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 2 }}>{peso(file.size)}</div>
            </div>
            <button type="button" aria-label={`Sacar ${file.name}`} onClick={(e) => { e.stopPropagation(); setFile(null); setFilas([]); setErr(null); }}
              style={{ border: 'none', background: 'transparent', color: 'var(--faint)', cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: 3, flex: 'none' }}>×</button>
          </div>
        </div>
      )}
    </div>
  );

  // ── Paso 2: la revisión ────────────────────────────────────────────────────

  const filaTabla = (f: FilaImport) => {
    const fuera = !!f.motivo;
    // El borde rojo marca EL CAMPO que hay que arreglar, no la fila entera: si la
    // fila está sin nombre, el que tiene que llamar la atención es ese input.
    const culpable = (k: string): boolean =>
      (f.motivo === 'sin-nombre' && k === 'nombre') ||
      (f.motivo === 'sin-contacto' && (k === 'email' || k === 'telefono'));
    const campo = (k: 'nombre' | 'email' | 'telefono' | 'empresa', ph: string) => (
      <input value={f[k]} placeholder={ph} onChange={(e) => editar(f.id, k, e.target.value)} aria-label={`${ph} de la fila ${f.id}`}
        style={{ ...celdaInput, borderColor: culpable(k) ? 'var(--bad)' : 'var(--border)' }} />
    );
    return (
      <div key={f.id} style={{
        display: 'grid', gridTemplateColumns: GRID, gap: 8, alignItems: 'center',
        padding: '7px 9px', borderRadius: 10,
        background: fuera ? 'transparent' : f.bajaConfianza ? 'color-mix(in srgb, var(--warn-fill, #D9A400) 8%, transparent)' : 'var(--surface-2)',
        border: `1px solid ${fuera ? 'var(--border)' : 'transparent'}`,
        opacity: fuera ? 0.55 : 1,
      }}>
        <button type="button" onClick={() => tildar(f.id)} disabled={fuera} aria-label={f.incluir ? 'No importar esta fila' : 'Importar esta fila'}
          style={{ width: 18, height: 18, borderRadius: 6, cursor: fuera ? 'default' : 'pointer', border: `1.5px solid ${f.incluir && !fuera ? 'var(--primary)' : 'var(--border-strong)'}`, background: f.incluir && !fuera ? 'var(--primary)' : 'transparent', color: '#fff', fontSize: 11, lineHeight: 1, padding: 0 }}>
          {f.incluir && !fuera ? '✓' : ''}
        </button>
        {campo('nombre', 'Nombre')}
        {campo('email', 'Email')}
        {campo('telefono', 'Teléfono')}
        {campo('empresa', 'Empresa')}
        <span style={{ fontFamily: MONO, fontSize: 10.5, color: fuera ? 'var(--bad)' : 'var(--faint)', textAlign: 'right', lineHeight: 1.3 }}>
          {f.motivo ? MOTIVO_LABEL[f.motivo] : f.bajaConfianza ? 'revisar' : 'entra'}
        </span>
      </div>
    );
  };

  const pasoRevisar = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontFamily: SANS, textAlign: 'left' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
        <Chip n={c.tildadas} texto="se van a crear" color="var(--good)" />
        {c.listas > c.tildadas && <Chip n={c.listas - c.tildadas} texto="destildadas" color="var(--dim)" />}
        {c.duplicado > 0 && <Chip n={c.duplicado} texto="ya existen" color="var(--dim)" />}
        {c['repetido-archivo'] > 0 && <Chip n={c['repetido-archivo']} texto="repetidas en el archivo" color="var(--dim)" />}
        {c['sin-nombre'] > 0 && <Chip n={c['sin-nombre']} texto="sin nombre" color="var(--bad)" />}
        {c['sin-contacto'] > 0 && <Chip n={c['sin-contacto']} texto="sin contacto" color="var(--bad)" />}
      </div>

      {viaIA && (
        <div style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5, padding: '9px 11px', borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          Estos datos los leyó MaKo del documento. Revisá que cada valor esté en la columna que corresponde: lo que quedó dudoso viene destildado y marcado como <em>revisar</em>.
        </div>
      )}
      {aviso && <div style={{ fontSize: 12.5, color: 'var(--warn)', lineHeight: 1.5 }}>{aviso}</div>}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ ...rotulo }}>{filas.length} fila{filas.length === 1 ? '' : 's'} detectada{filas.length === 1 ? '' : 's'}</span>
        <span style={{ display: 'flex', gap: 7 }}>
          <button type="button" onClick={soloNuevas}
            style={{ padding: '6px 10px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: MONO, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
            Tildar solo las nuevas
          </button>
          <button type="button" onClick={destildarTodo}
            style={{ padding: '6px 10px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: MONO, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
            Destildar todo
          </button>
        </span>
      </div>

      {/* La tabla scrollea en su propio eje: el modal nunca se va de ancho. */}
      <div style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: 700, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: 8, padding: '0 9px 4px' }}>
            <span />
            {['Nombre', 'Email', 'Teléfono', 'Empresa'].map((t) => <span key={t} style={rotulo}>{t}</span>)}
            <span style={{ ...rotulo, textAlign: 'right' }}>Estado</span>
          </div>
          {visibles.map(filaTabla)}
        </div>
      </div>

      {paginado && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <button type="button" onClick={() => setPagina(Math.max(0, pag - 1))} disabled={pag === 0}
            style={{ padding: '6px 12px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: pag === 0 ? 'var(--faint)' : 'var(--dim)', fontFamily: MONO, fontSize: 11, fontWeight: 700, cursor: pag === 0 ? 'default' : 'pointer' }}>
            ← Anteriores
          </button>
          <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)' }}>
            {pag * FILAS_POR_PAGINA + 1}–{Math.min((pag + 1) * FILAS_POR_PAGINA, filas.length)} de {filas.length}
          </span>
          <button type="button" onClick={() => setPagina(Math.min(paginas - 1, pag + 1))} disabled={pag >= paginas - 1}
            style={{ padding: '6px 12px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: pag >= paginas - 1 ? 'var(--faint)' : 'var(--dim)', fontFamily: MONO, fontSize: 11, fontWeight: 700, cursor: pag >= paginas - 1 ? 'default' : 'pointer' }}>
            Siguientes →
          </button>
        </div>
      )}

      <div style={{ fontSize: 12.5, color: 'var(--faint)', lineHeight: 1.55 }}>
        Nada se creó todavía. Podés corregir cualquier celda acá mismo; las filas atenuadas no entran hasta que se resuelva su motivo.
      </div>
    </div>
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

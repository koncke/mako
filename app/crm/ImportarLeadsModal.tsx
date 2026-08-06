'use client';

// =============================================================================
// ImportarLeadsModal — la bandeja del CSV antes de crear los leads
// =============================================================================
// Antes el botón abría el buscador de archivos del sistema de una y creaba los
// leads sin preguntar: no se veía qué archivo era, ni cuántos iban a entrar, ni
// cuántos se descartaban por duplicados — todo llegaba junto en un alert al final.
//
// Ahora es la misma bandeja que la del plan (WizardShell, una pregunta por
// pantalla):
//   1. ¿Qué archivo?   se ve el CSV elegido, con su peso, y se puede sacar
//   2. ¿Confirmás?     cuántas filas trae, cuántos entran y cuántos se saltean
// El conteo sale del server ANTES de insertar (previsualizarImportLeadsAction):
// nada se crea hasta que se confirma en el paso 2.
// =============================================================================

import { useRef, useState, type CSSProperties, type DragEvent } from 'react';
import { WizardShell } from '../_components/WizardShell';
import { previsualizarImportLeadsAction, importLeadsCsvAction, type PreviewImportLeads } from './actions';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";
const MAX_BYTES = 8 * 1024 * 1024;

const peso = (n: number): string => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);
const label: CSSProperties = { fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)' };

export function ImportarLeadsModal({ onListo, onClose }: {
  /** Se llama al terminar la importación, con el resumen para avisar arriba. */
  onListo: (resumen: string) => void;
  onClose: () => void;
}) {
  const [paso, setPaso] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [texto, setTexto] = useState('');
  const [sobre, setSobre] = useState(false);
  const [prev, setPrev] = useState<PreviewImportLeads | null>(null);
  const [cargando, setCargando] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const tomar = (fl: FileList | File[] | null) => {
    const f = fl && Array.from(fl)[0];
    if (!f) return;
    setErr(f.size > MAX_BYTES ? 'El archivo pesa más de 8 MB.' : null);
    setFile(f);
    setPrev(null);
    f.text().then(setTexto).catch(() => setErr('No se pudo leer el archivo.'));
  };

  // Paso 1 → 2: el server cuenta cuántos entran (sin insertar nada todavía).
  const analizar = () => {
    if (!texto) return;
    setCargando(true);
    setErr(null);
    previsualizarImportLeadsAction(texto)
      .then((p) => {
        setPrev(p);
        if (p.error) setErr(p.error); else setPaso(1);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : 'No se pudo leer el CSV'))
      .finally(() => setCargando(false));
  };

  const importar = () => {
    setCargando(true);
    setErr(null);
    importLeadsCsvAction(texto)
      .then((r) => {
        const extra = r.errores.length ? ` · ${r.errores.length} con error` : '';
        onListo(`✓ ${r.creados} lead${r.creados === 1 ? '' : 's'} nuevo${r.creados === 1 ? '' : 's'} · ${r.omitidos} omitido${r.omitidos === 1 ? '' : 's'}${extra}`);
      })
      .catch((e) => { setErr(e instanceof Error ? e.message : 'No se pudo importar'); setCargando(false); });
  };

  const enUltimo = paso === 1;
  const puede = paso === 0 ? !!texto && !err && file != null : (prev?.nuevos ?? 0) > 0;

  const cuerpo = () => {
    if (paso === 0) return (
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
          <div style={{ fontSize: 14, fontWeight: 650, color: 'var(--ink)' }}>Arrastrá el CSV acá</div>
          <div style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: 5, lineHeight: 1.5 }}>
            o hacé click para buscarlo. Con columnas <strong>Nombre</strong>, Email, Teléfono y Empresa — los nombres de encabezado no tienen que ser exactos.
          </div>
          <input ref={input} type="file" accept=".csv,text/csv" style={{ display: 'none' }}
            onChange={(e) => { tomar(e.target.files); e.target.value = ''; }} />
        </div>

        {file && (
          <div style={{ marginTop: 14 }}>
            <div style={{ ...label, marginBottom: 7 }}>Archivo</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)' }}>
              <span style={{ fontSize: 16, flex: 'none' }}>📊</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{file.name}</div>
                <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 2 }}>{peso(file.size)}</div>
              </div>
              <button type="button" aria-label={`Sacar ${file.name}`} onClick={(e) => { e.stopPropagation(); setFile(null); setTexto(''); setPrev(null); setErr(null); }}
                style={{ border: 'none', background: 'transparent', color: 'var(--faint)', cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: 3, flex: 'none' }}>×</button>
            </div>
          </div>
        )}
      </div>
    );

    // Paso 2: qué va a pasar exactamente. Nada se creó todavía.
    const p = prev!;
    const fila = (n: number, t: string, s: string, color: string) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 15px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface-2)' }}>
        <span style={{ fontSize: 26, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums', minWidth: 46, textAlign: 'right' }}>{n}</span>
        <span>
          <span style={{ display: 'block', fontSize: 14.5, fontWeight: 650, color: 'var(--ink)' }}>{t}</span>
          <span style={{ display: 'block', fontSize: 12, color: 'var(--faint)', marginTop: 1 }}>{s}</span>
        </span>
      </div>
    );
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, fontFamily: SANS }}>
        {fila(p.nuevos, 'Se van a crear', 'leads nuevos en tu CRM', 'var(--good)')}
        {p.omitidos > 0 && fila(p.omitidos, 'Se saltean', 'ya existen (mismo email o teléfono), o les falta nombre o contacto', 'var(--dim)')}
        <div style={{ fontSize: 12.5, color: 'var(--faint)', lineHeight: 1.55, padding: '10px 12px', background: 'var(--surface-2)', borderRadius: 10 }}>
          De {p.total} fila{p.total === 1 ? '' : 's'} en el archivo. Nada se creó todavía: se importa recién cuando confirmás.
        </div>
      </div>
    );
  };

  return (
    <WizardShell
      ancho={640}
      titulo="Importar leads"
      total={2} idx={paso}
      pregunta={paso === 0 ? '¿Qué archivo querés importar?' : '¿Confirmás la importación?'}
      sub={paso === 1 ? 'Revisá los números antes de crear los leads.' : undefined}
      error={err}
      pending={cargando}
      puedeAvanzar={puede}
      enUltimo={enUltimo}
      confirmLabel={(prev?.nuevos ?? 0) > 0 ? `Importar ${prev?.nuevos} lead${prev?.nuevos === 1 ? '' : 's'} →` : 'No hay leads nuevos'}
      siguienteLabel="Revisar →"
      atrasLabel={paso === 0 ? 'Cancelar' : 'Atrás'}
      onAtras={() => (paso === 0 ? onClose() : setPaso(0))}
      onSiguiente={analizar}
      onConfirmar={() => { if (puede && !cargando) importar(); }}
      onClose={onClose}
    >
      {cuerpo()}
    </WizardShell>
  );
}

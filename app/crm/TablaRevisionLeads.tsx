'use client';

// =============================================================================
// TablaRevisionLeads — «esto es lo que va a entrar», antes de que entre
// =============================================================================
// EXTRAÍDA de ImportarLeadsModal, no copiada. La usan los DOS caminos por los que
// pueden entrar leads que nadie escribió a mano:
//   · importar un archivo (/crm → Importar)
//   · confirmar lo que propuso un canal (/crm/revisar/<id>)
//
// El pedido del dueño fue textual: «SIEMPRE la preview de confirmación tiene que ser
// EXACTAMENTE igual a la preview cuando intento IMPORTAR un lead del CRM, que aparece
// como una tabla. Así sea 1 lead o los que sean». Y tiene una razón más fuerte que la
// estética: el que ya aprendió a revisar una importación no tiene que aprender una
// segunda pantalla para revisar lo mismo. Dos vistas del mismo momento divergen —es
// literalmente el caso que «una cosa, un lugar» viene a evitar— y acá el costo de que
// diverjan es que en una se pueda corregir un teléfono y en la otra no.
//
// ⚠️ UNA SOLA FILA SIGUE SIENDO UNA TABLA. Es la tentación obvia («para un lead
// alcanza con un formulario») y está descartada a propósito: el encabezado con los
// nombres de columna es lo que hace evidente qué valor cayó en qué campo, que es
// justamente lo que hay que revisar cuando el dato lo transcribió un modelo.
// =============================================================================

import { useMemo, useState, type CSSProperties } from 'react';
import { FILAS_POR_PAGINA, MOTIVO_LABEL, UMBRAL_PAGINADO, contar, type FilaImport } from './leads-importar';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

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

export function TablaRevisionLeads({ filas, onFilas, viaIA, aviso, nota }: {
  filas: FilaImport[];
  onFilas: (f: FilaImport[] | ((prev: FilaImport[]) => FilaImport[])) => void;
  /** Los datos los leyó un modelo → se avisa que hay que mirar en qué columna cayó cada valor. */
  viaIA?: boolean;
  aviso?: string | null;
  /** El pie. Cambia según de dónde vino, pero siempre dice que todavía no se creó nada. */
  nota?: string;
}) {
  const [pagina, setPagina] = useState(0);
  const c = useMemo(() => contar(filas), [filas]);

  const editar = (id: string, campo: 'nombre' | 'email' | 'telefono' | 'empresa', v: string) =>
    onFilas((prev) => prev.map((f) => (f.id === id ? { ...f, [campo]: v } : f)));
  const tildar = (id: string) =>
    onFilas((prev) => prev.map((f) => (f.id === id && !f.motivo ? { ...f, incluir: !f.incluir } : f)));
  const soloNuevas = () => onFilas((prev) => prev.map((f) => ({ ...f, incluir: !f.motivo })));
  const destildarTodo = () => onFilas((prev) => prev.map((f) => ({ ...f, incluir: false })));

  const paginado = filas.length > UMBRAL_PAGINADO;
  const paginas = paginado ? Math.ceil(filas.length / FILAS_POR_PAGINA) : 1;
  const pag = Math.min(pagina, paginas - 1);
  const visibles = paginado ? filas.slice(pag * FILAS_POR_PAGINA, (pag + 1) * FILAS_POR_PAGINA) : filas;

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontFamily: SANS, textAlign: 'left' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
        <Chip n={c.tildadas} texto="se van a crear" color="var(--good)" />
        {c.listas > c.tildadas && <Chip n={c.listas - c.tildadas} texto="destildadas" color="var(--dim)" />}
        {c.duplicado > 0 && <Chip n={c.duplicado} texto="ya existen" color="var(--dim)" />}
        {c['repetido-archivo'] > 0 && <Chip n={c['repetido-archivo']} texto="repetidas" color="var(--dim)" />}
        {c['sin-nombre'] > 0 && <Chip n={c['sin-nombre']} texto="sin nombre" color="var(--bad)" />}
        {c['sin-contacto'] > 0 && <Chip n={c['sin-contacto']} texto="sin contacto" color="var(--bad)" />}
      </div>

      {viaIA && (
        <div style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5, padding: '9px 11px', borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          Estos datos los leyó MaKo. Revisá que cada valor esté en la columna que corresponde: lo que quedó dudoso viene destildado y marcado como <em>revisar</em>.
        </div>
      )}
      {aviso && <div style={{ fontSize: 12.5, color: 'var(--warn)', lineHeight: 1.5 }}>{aviso}</div>}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ ...rotulo }}>{filas.length} fila{filas.length === 1 ? '' : 's'}</span>
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

      {/* La tabla scrollea en su propio eje: el contenedor nunca se va de ancho. */}
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
        {nota ?? 'Nada se creó todavía. Podés corregir cualquier celda acá mismo; las filas atenuadas no entran hasta que se resuelva su motivo.'}
      </div>
    </div>
  );
}

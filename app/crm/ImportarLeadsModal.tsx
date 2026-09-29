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

import { useEffect, useMemo, useRef, useState, useTransition, type CSSProperties, type DragEvent } from 'react';
import { WizardShell } from '../_components/WizardShell';
import { importarLeadsRevisadosAction, leadsDeOtrosProductosAction, moverLeadsAFunnelAction } from './actions';
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


export function ImportarLeadsModal({ onListo, onClose, funnelId = null }: {
  /** Se llama al terminar la importación, con el resumen para avisar arriba. */
  onListo: (resumen: string) => void;
  onClose: () => void;
  /**
   * El producto que se está mirando. `null` = el del negocio.
   *
   * ⚠️ LO NECESITA EL SEGUNDO ORIGEN («traer de otro producto») para saber de dónde NO
   * traer y a dónde llevar. Y deja escrito un agujero que no es de este pedido: la
   * importación desde archivo tampoco lo pasa al server, así que un CSV importado desde
   * un producto secundario nace en el embudo del negocio y desaparece de la pantalla
   * donde se lo acaba de importar. Eso se arregla en `importarLeadsRevisadosAction`,
   * que tiene TRES llamadores y uno de ellos (la revisión de lo que propuso un canal)
   * no tiene ningún producto a la vista.
   */
  funnelId?: number | null;
}) {
  const [paso, setPaso] = useState(0);
  /**
   * De dónde vienen los leads. «Traer de otro producto» es un ORIGEN, no un paso más:
   * «que dentro del pop-up que aparece, me de la opción de importar leads de otro
   * producto, para que sea fácil» (Martín, 30/09/2026).
   *
   * ⚠️ Y NO PASA POR LA TABLA DE REVISIÓN, a propósito. Esa tabla marca `duplicado` todo
   * lo que ya existe en el workspace —`indiceContactos` no filtra por funnel— y su UI no
   * deja tildar una fila con motivo (`TablaRevisionLeads`: `disabled={fuera}`). O sea que
   * los leads traídos de otro producto llegarían TODOS atenuados y destildables, y el
   * botón diría «No hay nada tildado». Acá no hay nada que revisar: son leads que ya
   * existen y sólo cambian de tablero.
   */
  const [origen, setOrigen] = useState<'archivo' | 'producto'>('archivo');
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
    // Las planillas de formato CERRADO (.xls viejo, .xlsb, .numbers) se atajan acá y
    // no en el server: así el usuario se entera antes de esperar una subida de varios
    // megas para nada. El .xlsx y el .ods SÍ se leen desde el 27/09/2026 y pasan.
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
    importarLeadsRevisadosAction(filas, funnelId)
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

  const pasoOrigen = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Los dos caminos, en el mismo lugar: subir algo, o traer de otro tablero. */}
      <div style={{ display: 'inline-flex', alignSelf: 'flex-start', background: 'var(--surface-2)', borderRadius: 999, padding: 3 }}>
        {([['archivo', 'Desde un archivo'], ['producto', 'De otro producto']] as Array<['archivo' | 'producto', string]>).map(([k, txt]) => (
          <button key={k} type="button" onClick={() => { setOrigen(k); setErr(null); }}
            style={{
              border: 'none', background: origen === k ? 'var(--surface)' : 'transparent',
              color: origen === k ? 'var(--ink)' : 'var(--dim)', fontWeight: origen === k ? 600 : 500,
              fontSize: 13.5, padding: '7px 16px', borderRadius: 999, cursor: 'pointer', fontFamily: SANS,
              boxShadow: origen === k ? '0 1px 2px rgba(18,21,27,.08)' : 'none',
            }}>{txt}</button>
        ))}
      </div>
      {origen === 'archivo' ? pasoArchivo() : (
        <TraerDeProducto funnelId={funnelId} onListo={onListo} />
      )}
    </div>
  );

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
        <div style={{ fontSize: 14, fontWeight: 650, color: 'var(--ink)' }}>Arrastra el archivo aquí</div>
        <div style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: 5, lineHeight: 1.5 }}>
          o haz click para buscarlo. Funciona con <strong>Excel y CSV</strong>, y también con
          PDF, fotos y documentos: de esos MaKo saca los contactos y los revisas en el
          próximo paso.
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
      pregunta={paso === 1 ? '¿Está bien lo que va a entrar?' : origen === 'archivo' ? '¿Qué archivo quieres importar?' : '¿A quién traes?'}
      sub={paso === 1 ? 'Corrige lo que haga falta y tilda qué se crea.' : undefined}
      error={err}
      pending={cargando}
      puedeAvanzar={origen === 'producto' && paso === 0 ? false : puede}
      enUltimo={enUltimo}
      confirmLabel={c.tildadas > 0 ? `Crear ${c.tildadas} lead${c.tildadas === 1 ? '' : 's'} →` : 'No hay nada tildado'}
      siguienteLabel="Revisar →"
      atrasLabel={paso === 0 ? 'Cancelar' : 'Atrás'}
      onAtras={() => (paso === 0 ? onClose() : setPaso(0))}
      onSiguiente={() => { void analizar(); }}
      onConfirmar={() => { if (puede && !cargando) importar(); }}
      onClose={onClose}
    >
      {paso === 0 ? pasoOrigen() : pasoRevisar()}
    </WizardShell>
  );
}

/**
 * Traer leads que ya están en OTRO producto.
 *
 * ⚠️ MUEVE, NO COPIA, y el botón lo dice con esa palabra: el producto de un lead es UNA
 * columna, así que traerlo acá es sacarlo de allá. Y entra como lead entrante, que es lo
 * que se pidió y lo único que no miente — la etapa del otro embudo es una clave SUYA y
 * puede no existir en éste.
 */
function TraerDeProducto({ funnelId, onListo }: { funnelId: number | null; onListo: (resumen: string) => void }) {
  const [q, setQ] = useState('');
  const [filas, setFilas] = useState<Array<{ id: number; nombre: string; email: string | null; telefono: string | null; producto: string | null }>>([]);
  const [sel, setSel] = useState<number[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [moviendo, startMover] = useTransition();

  // Con retraso, y descartando lo que llegó tarde: sin eso la respuesta de «ju» puede
  // pisar a la de «juan» y la lista muestra lo que ya no se buscó.
  useEffect(() => {
    const texto = q.trim();
    if (texto.length < 2) { setFilas([]); return; }
    let vivo = true;
    setBuscando(true);
    const t = setTimeout(() => {
      void leadsDeOtrosProductosAction(texto, funnelId)
        .then((r) => { if (vivo) setFilas(r); })
        .catch(() => { if (vivo) setFilas([]); })
        .finally(() => { if (vivo) setBuscando(false); });
    }, 250);
    return () => { vivo = false; clearTimeout(t); };
  }, [q, funnelId]);

  const alternar = (id: number) => setSel((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <input value={q} onChange={(e) => setQ(e.target.value)} autoFocus
        placeholder="Nombre, email o teléfono"
        style={{ width: '100%', padding: '11px 13px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: SANS, fontSize: 15, outline: 'none', boxSizing: 'border-box' }} />
      {/* «No encontré nada» y «todavía no busqué» son respuestas distintas: la segunda no
          se dibuja, porque un vacío apenas se abre se lee como que no hay nadie. */}
      {q.trim().length >= 2 && !buscando && filas.length === 0 && (
        <span style={{ fontFamily: SANS, fontSize: 13, color: 'var(--faint)' }}>Nadie con esos datos en tus otros productos.</span>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflowY: 'auto' }}>
        {filas.map((l) => {
          const on = sel.includes(l.id);
          return (
            <button key={l.id} type="button" onClick={() => alternar(l.id)} aria-pressed={on}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', width: '100%',
                padding: '10px 13px', borderRadius: 10, cursor: 'pointer', fontFamily: SANS,
                border: '1px solid ' + (on ? 'var(--primary)' : 'var(--border)'),
                background: on ? 'var(--primary-weak)' : 'var(--surface-2)',
              }}>
              <span aria-hidden style={{
                flex: 'none', width: 17, height: 17, borderRadius: 5,
                border: '1.5px solid ' + (on ? 'var(--primary)' : 'var(--border-strong)'),
                background: on ? 'var(--primary)' : 'transparent',
                color: '#fff', fontSize: 12, lineHeight: '15px', textAlign: 'center',
              }}>{on ? '✓' : ''}</span>
              <span style={{ flex: '0 1 auto', minWidth: 0, fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.nombre}</span>
              <span style={{ flex: '0 1 auto', minWidth: 0, fontSize: 12.5, color: 'var(--dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.email || l.telefono || ''}</span>
              <span style={{ flex: 1 }} />
              {l.producto && <span style={{ flex: 'none', fontSize: 12.5, color: 'var(--faint)' }}>{l.producto}</span>}
            </button>
          );
        })}
      </div>
      {sel.length > 0 && (
        <button type="button" disabled={moviendo}
          onClick={() => startMover(async () => {
            const r = await moverLeadsAFunnelAction(sel, funnelId);
            // ⚠️ Se dice lo que ENTRÓ y lo que no. «Listo» sobre diez cuando entraron seis
            // manda a buscar los cuatro a un tablero donde no están.
            const falla = r.fallaron ? ` · ${r.fallaron} no se pudieron mover` : '';
            onListo(`✓ ${r.movidos} lead${r.movidos === 1 ? '' : 's'} traído${r.movidos === 1 ? '' : 's'}${falla}`);
          })}
          style={{ alignSelf: 'flex-start', padding: '10px 18px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontFamily: SANS, fontSize: 14, fontWeight: 700, cursor: moviendo ? 'default' : 'pointer', opacity: moviendo ? 0.7 : 1 }}>
          {moviendo ? 'Moviendo…' : `Mover ${sel.length} aquí`}
        </button>
      )}
    </div>
  );
}
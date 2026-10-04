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
import { TraerDeOtroProducto, type ProductoOrigen } from './TraerDeOtroProducto';
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


export function ImportarLeadsModal({ onListo, onClose, funnelId = null, productos = [] }: {
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
  /** Los productos del workspace, para poder elegir de cuál traer. */
  productos?: ProductoOrigen[];
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
      // ⚠️ EL DUPLICADO NACE DESTILDADO. `filasDesdeCsv` pone `incluir: true` en todas
      // las filas y `recalcular` nunca lo baja, así que el default de «ya existe en el
      // CRM» era CREARLO — y como la casilla además estaba deshabilitada, no había
      // ninguna forma de decidir lo contrario. Para el que importa tres bases que se
      // solapan el default correcto es el otro: una ficha de más por cada persona
      // repetida deja a los dos leads inalcanzables para Calendly, Meta y Fathom (dos
      // filas con el mismo `telefono_normalizado` rompen sus `.maybeSingle()`).
      //
      // Se aplica UNA vez, acá, y no dentro de `recalcular`: ahí correría en cada
      // edición y le borraría el tilde a la persona que acaba de ponerlo.
      setFilas(recalcular(data.filas).map((f) => (f.motivo ? { ...f, incluir: false } : f)));
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
        // ⚠️ ES EL MISMO COMPONENTE QUE EL DE «Nuevo lead», no una copia: el de acá era un
        // buscador de una línea y el de allá una tabla con filtros, y los dos hacían lo
        // mismo. Dos pantallas para traer un lead divergen en el primer ajuste — y la
        // segunda es siempre la que se queda vieja.
        <TraerDeOtroProducto
          productos={productos}
          destino={funnelId}
          onAtras={() => setOrigen('archivo')}
          onTraidos={(movidos, fallaron) => {
            const falla = fallaron ? ` · ${fallaron} no se pudieron mover` : '';
            onListo(`✓ ${movidos} ${movidos === 1 ? 'lead traído' : 'leads traídos'}${falla}`);
          }}
        />
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
  /**
   * ⚠️ CADA EDICIÓN VUELVE A PASAR POR `recalcular`, y en este camino no pasaba.
   * La cabecera de leads-importar.ts lo declara desde el día uno («El usuario las
   * revisa, corrige y tilda. Cada edición recalcula el motivo») y lo cumplía sólo el
   * OTRO consumidor de esta misma tabla (`RevisarLead`, que lo hace en su `onFilas`).
   * Acá `recalcular` corría una sola vez, al leer el archivo, así que corregir el
   * nombre de una fila «sin nombre» la dejaba atenuada y sin casilla en pantalla
   * mientras el server —que sí recalcula al confirmar— la creaba. La misma mentira que
   * el duplicado, por el otro camino: la pantalla diciendo que algo no entra y el
   * server creándolo.
   */
  const pasoRevisar = () => (
    <TablaRevisionLeads
      filas={filas}
      onFilas={(v) => setFilas((prev) => recalcular(typeof v === 'function' ? v(prev) : v))}
      viaIA={viaIA}
      aviso={aviso}
      /*
       * La consecuencia de lo irreversible, antes del click y lo más cerca del botón
       * que esta pantalla permite: el pie de la tabla es el último renglón arriba del
       * footer del wizard. Crear un repetido deja una segunda ficha de alguien que ya
       * está en el CRM y desde acá no se deshace. Sólo aparece cuando hay algo que
       * advertir — un cartel permanente no lo lee nadie.
       */
      nota={c.aProposito > 0
        ? `Nada se creó todavía. Ojo: ${c.aProposito} ya ${c.aProposito === 1 ? 'existe en el CRM y se va' : 'existen en el CRM y se van'} a crear igual.`
        : undefined}
    />
  );

  return (
    <WizardShell
      // La tabla de «traer de otro producto» tiene seis columnas: en 640 cada fila cae en
      // dos renglones.
      ancho={paso === 1 ? 940 : origen === 'producto' ? 1040 : 640}
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

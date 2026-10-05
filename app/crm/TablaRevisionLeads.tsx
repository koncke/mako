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
import { FILAS_POR_PAGINA, MOTIVO_DECIDIBLE, MOTIVO_LABEL, UMBRAL_PAGINADO, contar, destinoDe, entraGanado, type FilaImport } from './leads-importar';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

const rotulo: CSSProperties = { fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)' };
const celdaInput: CSSProperties = { width: '100%', padding: '6px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 12.5, outline: 'none', minWidth: 0 };
/** Mismo reparto de columnas para el encabezado y para cada fila. */
const GRID = '26px 1.2fr 1.4fr 1fr 1fr 156px';

/**
 * Los dos destinos de una fila que YA EXISTE, cuando alguien la tildó. Es una pregunta
 * APARTE de la casilla («¿esta fila hace algo?») y no un tercer valor suyo: sin tilde
 * no hay nada que decidir, y con el tilde puesto siguen quedando dos cosas que se
 * pueden hacer con la misma persona.
 *
 * El rótulo es de UNA palabra porque vive en una celda de tabla; la frase entera va en
 * el `aria-label`, que no ocupa lugar.
 */
const DESTINOS: Array<{ enriquecer: boolean; txt: string; dice: (quien: string) => string }> = [
  { enriquecer: false, txt: 'Duplicar', dice: (q) => `Crear una segunda ficha de ${q}` },
  { enriquecer: true, txt: 'Completar', dice: (q) => `Completar los datos vacíos de ${q}, sin tocar los que ya tiene` },
];

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
  /**
   * ⚠️ UN DUPLICADO SE PUEDE TILDAR, y hasta el 03/10/2026 no se podía: la condición
   * era `!f.motivo`, así que la única fila cuyo descarte es una DECISIÓN —«ya existe en
   * el CRM», que puede ser la misma persona o un homónimo— era justamente la que no se
   * podía decidir. Mientras tanto el server la creaba igual, con la guarda
   * anti-duplicado apagada: la pantalla ofrecía lo contrario de lo que pasaba.
   *
   * Los otros tres motivos siguen sin tilde porque no son decisiones, son filas que no
   * se pueden crear (el porqué de cada una está en `MOTIVO_DECIDIBLE`).
   */
  const tildar = (id: string) =>
    onFilas((prev) => prev.map((f) => (f.id === id && (!f.motivo || f.motivo === MOTIVO_DECIDIBLE) ? { ...f, incluir: !f.incluir } : f)));
  /**
   * El destino de una fila repetida: duplicar, o completar la ficha que ya está (#623).
   *
   * Sólo tiene sentido en `MOTIVO_DECIDIBLE` —es la única fila donde hay algo que ya
   * existe— y `destinoDe` además exige que el server haya resuelto A QUIÉN
   * (`leadExistenteId`): si el email de la fila matchea un lead y el teléfono matchea
   * otro, no hay ficha que completar y el control no se dibuja.
   */
  const elegirDestino = (id: string, enriquecer: boolean) =>
    onFilas((prev) => prev.map((f) => (f.id === id && f.motivo === MOTIVO_DECIDIBLE ? { ...f, enriquecer } : f)));
  /**
   * La propuesta de entrar como VENTA (#622): el archivo traía un pago para esta persona.
   *
   * ⚠️ SE PROPONE Y LA PERSONA CONFIRMA. Nace prendida —ésa es la propuesta— y este
   * control existe para apagarla: lo que se escribe es `estado_lead = 'ganado'` y el monto
   * de la venta, o sea el número que después suma la facturación.
   *
   * Sólo sobre una fila con `pagoEnArchivo`: prenderlo en una fila que el archivo no marcó
   * sería elegir la etapa a mano, que es otra cosa y no es lo que se pidió.
   */
  const elegirGanado = (id: string, comoGanado: boolean) =>
    onFilas((prev) => prev.map((f) => (f.id === id && f.pagoEnArchivo ? { ...f, comoGanado } : f)));
  const soloNuevas = () => onFilas((prev) => prev.map((f) => ({ ...f, incluir: !f.motivo })));
  const destildarTodo = () => onFilas((prev) => prev.map((f) => ({ ...f, incluir: false })));

  const paginado = filas.length > UMBRAL_PAGINADO;
  const paginas = paginado ? Math.ceil(filas.length / FILAS_POR_PAGINA) : 1;
  const pag = Math.min(pagina, paginas - 1);
  const visibles = paginado ? filas.slice(pag * FILAS_POR_PAGINA, (pag + 1) * FILAS_POR_PAGINA) : filas;

  const filaTabla = (f: FilaImport) => {
    // Tres estados, no dos: la fila que entra, la que NO SE PUEDE crear (atenuada y sin
    // casilla) y el duplicado, que se puede decidir y por eso no se atenúa igual que un
    // descarte — atenuar un control que sí funciona es cómo se lee que no funciona.
    const decidible = f.motivo === MOTIVO_DECIDIBLE;
    const invalido = !!f.motivo && !decidible;
    const destino = destinoDe(f);
    // `fuera` es «esta fila NO HACE NADA», no «no se crea»: una que completa la ficha
    // que ya está tiene que dibujarse tildada. Colgarlo de `entra()` —que contesta
    // «¿se CREA?»— dejaba la casilla en blanco justo en la fila que sí va a escribir,
    // o sea la pantalla diciendo lo contrario de lo que pasa.
    const fuera = destino === 'omitir';
    // Y completar sólo se puede ofrecer si el server resolvió a quién.
    const puedeCompletar = decidible && !fuera && f.leadExistenteId != null;
    /**
     * La propuesta de venta (#622) se dibuja sólo sobre la fila que SE CREA: una que
     * completa la ficha que ya está (#623) le llena los campos vacíos y no le mueve la
     * etapa a nadie, así que ahí el control no decidiría nada. Sale de `destinoDe`, igual
     * que todo lo demás de esta celda.
     */
    const proponeGanado = !!f.pagoEnArchivo && destino === 'crear';
    const esGanado = entraGanado(f);
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
        background: invalido ? 'transparent' : f.bajaConfianza ? 'color-mix(in srgb, var(--warn-fill, #D9A400) 8%, transparent)' : 'var(--surface-2)',
        border: `1px solid ${invalido || decidible ? 'var(--border)' : 'transparent'}`,
        opacity: invalido ? 0.55 : 1,
      }}>
        {/*
          El aria-label de una fila que no se puede crear dice POR QUÉ no entra, no la
          acción que el botón no puede hacer: antes anunciaba «No importar esta fila»
          sobre una casilla deshabilitada y dibujada sin tilde, o sea la acción contraria
          a la que se ve y encima imposible. Y en el duplicado —el único que se decide—
          la etiqueta dice qué pasa al tildarlo, que es lo que no se ve mirando una
          casilla: que se va a crear una segunda ficha de alguien que ya está.
        */}
        <button type="button" onClick={() => tildar(f.id)} disabled={invalido}
          aria-label={invalido ? `No entra: ${MOTIVO_LABEL[f.motivo!]}`
            : decidible ? (f.incluir ? 'No crear este lead repetido' : 'Crear este lead aunque ya exista en el CRM')
            : f.incluir ? 'No importar esta fila' : 'Importar esta fila'}
          style={{ width: 18, height: 18, borderRadius: 6, cursor: invalido ? 'default' : 'pointer', border: `1.5px solid ${fuera ? 'var(--border-strong)' : 'var(--primary)'}`, background: fuera ? 'transparent' : 'var(--primary)', color: '#fff', fontSize: 11, lineHeight: 1, padding: 0 }}>
          {fuera ? '' : '✓'}
        </button>
        {campo('nombre', 'Nombre')}
        {campo('email', 'Email')}
        {campo('telefono', 'Teléfono')}
        {campo('empresa', 'Empresa')}
        <span style={{ fontFamily: MONO, fontSize: 10.5, color: invalido ? 'var(--bad)' : destino === 'enriquecer' ? 'var(--good)' : decidible && !fuera ? 'var(--warn)' : fuera ? 'var(--dim)' : 'var(--faint)', textAlign: 'right', lineHeight: 1.3 }}>
          {/* El duplicado tildado dice QUÉ va a pasar con esa fila, no sólo lo que se
              detectó: duplicar deja una segunda ficha y completar escribe en la que ya
              está. Son dos resultados distintos y el rótulo los distingue. */}
          {decidible ? (destino === 'enriquecer' ? 'ya existe · se completa' : destino === 'crear' ? 'ya existe · entra igual' : MOTIVO_LABEL[f.motivo!])
            : f.motivo ? MOTIVO_LABEL[f.motivo]
            : f.bajaConfianza ? 'revisar'
            : esGanado ? 'entra · ganado' : 'entra'}
          {/* La propuesta de venta (#622). Un solo control porque la respuesta de al lado ya
              está escrita arriba: el rótulo dice «entra» o «entra · ganado». Y el monto no
              se dibuja —en 156px no entra—: viaja en el aria-label, que no ocupa lugar. */}
          {proponeGanado && (
            <span style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
              <button type="button" onClick={() => elegirGanado(f.id, !esGanado)}
                aria-pressed={esGanado}
                aria-label={esGanado
                  ? `No marcar a ${f.nombre.trim() || 'este contacto'} como venta: entra en la primera etapa`
                  : `Marcar a ${f.nombre.trim() || 'este contacto'} como venta${f.montoPago != null ? ` por ${f.montoPago}` : ''}`}
                style={{
                  padding: '2px 6px', borderRadius: 7, cursor: 'pointer', fontFamily: MONO, fontSize: 9.5, lineHeight: 1.4,
                  border: `1px solid ${esGanado ? 'var(--good)' : 'var(--border-strong)'}`,
                  background: esGanado ? 'var(--good)' : 'var(--surface)',
                  color: esGanado ? '#fff' : 'var(--dim)',
                }}>Ganado</button>
            </span>
          )}
          {/* El tercer destino (#623), apilado debajo del estado: en 156px los dos
              rótulos al lado del texto no entran, y AGENTS.md es explícito — si el más
              largo no entra, no se achica, se apila. */}
          {puedeCompletar && (
            <span style={{ display: 'flex', gap: 3, justifyContent: 'flex-end', marginTop: 4 }}>
              {DESTINOS.map((d) => {
                const puesto = !!f.enriquecer === d.enriquecer;
                return (
                  <button key={d.txt} type="button" onClick={() => elegirDestino(f.id, d.enriquecer)}
                    aria-pressed={puesto} aria-label={d.dice(f.nombre.trim() || 'este contacto')}
                    style={{
                      padding: '2px 6px', borderRadius: 7, cursor: 'pointer', fontFamily: MONO, fontSize: 9.5, lineHeight: 1.4,
                      border: `1px solid ${puesto ? 'var(--primary)' : 'var(--border-strong)'}`,
                      background: puesto ? 'var(--primary)' : 'var(--surface)',
                      color: puesto ? '#fff' : 'var(--dim)',
                    }}>{d.txt}</button>
                );
              })}
            </span>
          )}
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
        {/* Lo irreversible de esta pantalla, con su propio número y pegado al resto: un
            duplicado tildado crea una SEGUNDA ficha de alguien que ya está en el CRM. */}
        {c.aProposito > 0 && <Chip n={c.aProposito} texto="repetidos a propósito" color="var(--warn)" />}
        {/* Las que completan la ficha que ya está: no son leads nuevos, así que no
            pueden viajar en el número de «se van a crear» (#623). */}
        {c.aEnriquecer > 0 && <Chip n={c.aEnriquecer} texto="se completan" color="var(--good)" />}
        {/* Las que entran como venta (#622). Es un SUBCONJUNTO de «se van a crear», no un
            número aparte: esos leads se crean igual y después se los mueve de etapa. */}
        {c.comoGanado > 0 && <Chip n={c.comoGanado} texto="entran ganados" color="var(--good)" />}
        {c['repetido-archivo'] > 0 && <Chip n={c['repetido-archivo']} texto="repetidas" color="var(--dim)" />}
        {c['sin-nombre'] > 0 && <Chip n={c['sin-nombre']} texto="sin nombre" color="var(--bad)" />}
        {c['sin-contacto'] > 0 && <Chip n={c['sin-contacto']} texto="sin contacto" color="var(--bad)" />}
      </div>

      {viaIA && (
        <div style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5, padding: '9px 11px', borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          Estos datos los leyó MaKo. Revisa que cada valor esté en la columna que corresponde: lo que quedó dudoso viene destildado y marcado como <em>revisar</em>.
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
        <div style={{ minWidth: 730, display: 'flex', flexDirection: 'column', gap: 4 }}>
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
        {nota ?? 'Nada se creó todavía. Puedes corregir cualquier celda aquí mismo. Las filas atenuadas no entran; las que ya existen en el CRM entran solo si las tildas.'}
      </div>
    </div>
  );
}

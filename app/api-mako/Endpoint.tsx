'use client';

// =============================================================================
// /api-mako › Documentación — UN endpoint, con la anatomía de docs.github.com
// =============================================================================
// El bloque de GitHub, en el mismo orden (relevo del 08/10/2026, wf_62c177ea-a1d):
//   h2 con ancla → dos columnas:
//   · izquierda: descripción · «Tokens de acceso detallados para "X"» · «Parámetros para
//     "X"» (una tabla por ubicación: Encabezados, de ruta, de consulta, del cuerpo; una sola
//     columna apilada: nombre en negrita, tipo en gris, «Obligatorio») · «Códigos de estado
//     de respuesta HTTP para "X"».
//   · derecha, fija al scrollear: «Ejemplos de código para "X"» → «Ejemplo de solicitud»
//     (verbo + ruta, pestañas cURL / JavaScript / Python, copiar) → «Respuesta» (Ejemplo de
//     respuesta / Esquema de respuesta, «Status: 200»).
// Cada subsección tiene su ancla con sufijo, como GitHub: #id--parametros, etc.
//
// Agregado nuestro (GitHub no lo tiene): «Probar» en las lecturas que no gastan, que corre
// de verdad con los datos del workspace. Va abajo de la respuesta, sin cambiarle el orden.
// =============================================================================

import { Fragment, useState } from 'react';
import Link from '@/app/_ui/Link';
import type { EndpointDoc, ParamDoc, Prueba } from './datos';
import { probarOperacion } from './actions';
import { BotonCopiar, Verbo, useCopiar } from './piezas';

/** Los `backticks` de una descripción, como código en línea. El resto, texto tal cual. */
export function TextoConCodigo({ texto }: { texto: string }) {
  const partes = texto.split(/(`[^`]+`)/g);
  return <>{partes.map((p, i) => (p.startsWith('`') && p.endsWith('`') && p.length > 2 ? <code key={i} className="gh-inline">{p.slice(1, -1)}</code> : <Fragment key={i}>{p}</Fragment>))}</>;
}

const NIVEL: Record<'lectura' | 'escritura', string> = { lectura: 'lectura', escritura: 'escritura' };

export function Endpoint({ e }: { e: EndpointDoc }) {
  const hayParams = e.params.ruta.length + e.params.consulta.length + e.params.cuerpo.length > 0;
  return (
    <section className="gh-endpoint" id={e.id} aria-labelledby={`${e.id}--titulo`}>
      <h2 id={`${e.id}--titulo`}><a href={`#${e.id}`} style={{ color: 'inherit' }}>{e.titulo}</a></h2>
      <div className="gh-endpoint-cols">
        <div>
          {e.descripcion.split(/\n{2,}/).map((p, i) => <p key={i} style={{ whiteSpace: 'pre-line' }}><TextoConCodigo texto={p} /></p>)}
          {e.requisitos.length > 0 && (
            <div className="gh-alerta gh-alerta--warning" role="note">
              <strong>Nota</strong>
              {e.requisitos.map((r) => <div key={r}>{r}</div>)}
            </div>
          )}

          <h3 id={`${e.id}--tokens-detallados`}><a href={`#${e.id}--tokens-detallados`} style={{ color: 'inherit' }}>Tokens de acceso detallados para «{e.titulo}»</a></h3>
          <p style={{ marginBottom: 8 }}>Este endpoint funciona con los siguientes tipos de tokens detallados:</p>
          <ul style={{ margin: '0 0 16px', paddingLeft: '2em' }}>
            <li><Link href="/api-mako?tab=docs&art=autenticacion">Tokens de acceso personal detallados</Link></li>
          </ul>
          <p style={{ marginBottom: 8 }}>El token detallado debe tener el siguiente conjunto de permisos:</p>
          <ul style={{ margin: '0 0 16px', paddingLeft: '2em' }}>
            <li>Permisos de «{e.areaTitulo}» ({NIVEL[e.nivel]})</li>
          </ul>
          {e.tipo === 'accion' && (
            <p>{e.directo
              ? 'Con «Lectura y escritura», el token detallado lo hace en el acto.'
              : 'Aunque el token tenga «Lectura y escritura», esto queda como propuesta: gasta dinero y lo confirma una persona en una pantalla de MaKo.'}</p>
          )}
          <p style={{ color: 'var(--gh-fg-muted)' }}>{e.clasico}</p>

          <h3 id={`${e.id}--parametros`}><a href={`#${e.id}--parametros`} style={{ color: 'inherit' }}>Parámetros para «{e.titulo}»</a></h3>
          <TablaParams caption="Encabezados" filas={[{ nombre: 'accept', tipo: 'string', obligatorio: false, descripcion: 'Se recomienda `application/json`.' }]} />
          {e.params.ruta.length > 0 && <TablaParams caption="Parámetros de ruta" filas={e.params.ruta} />}
          {e.params.consulta.length > 0 && <TablaParams caption="Parámetros de consulta" filas={e.params.consulta} />}
          {e.params.cuerpo.length > 0 && <TablaParams caption="Parámetros del cuerpo" filas={e.params.cuerpo} />}
          {!hayParams && <p style={{ color: 'var(--gh-fg-muted)' }}>Este endpoint no recibe parámetros.</p>}
          {e.formatos.length > 0 && (
            <p style={{ color: 'var(--gh-fg-muted)' }}>También responde en otros formatos con <code className="gh-inline">?formato=</code>: {e.formatos.map((f, i) => <Fragment key={f}>{i ? ', ' : ''}<code className="gh-inline">{f}</code></Fragment>)}.</p>
          )}

          <h3 id={`${e.id}--codigos`}><a href={`#${e.id}--codigos`} style={{ color: 'inherit' }}>Códigos de estado de respuesta HTTP para «{e.titulo}»</a></h3>
          <table className="gh-tabla">
            <thead><tr><th style={{ width: 140 }}>Código de estado</th><th>Descripción</th></tr></thead>
            <tbody>
              {e.estados.map((s) => <tr key={s.codigo}><td><code>{s.codigo}</code></td><td><TextoConCodigo texto={s.descripcion} /></td></tr>)}
            </tbody>
          </table>
          <p style={{ fontSize: 12, color: 'var(--gh-fg-muted)' }}>También responde por su ruta de siempre: <code className="gh-inline">{e.rutaOperacion}</code></p>
        </div>

        <div className="gh-endpoint-der">
          <h3 id={`${e.id}--ejemplos`} style={{ marginTop: 0 }}><a href={`#${e.id}--ejemplos`} style={{ color: 'inherit' }}>Ejemplos de código para «{e.titulo}»</a></h3>
          <Ejemplos e={e} />
        </div>
      </div>
    </section>
  );
}

function TablaParams({ caption, filas }: { caption: string; filas: ParamDoc[] }) {
  return (
    <table className="gh-tabla gh-tabla-param" summary="La columna describe el parámetro. La primera línea tiene el nombre, el tipo y si es obligatorio. La segunda, su descripción.">
      <caption>{caption}</caption>
      <thead><tr><th>Nombre, Tipo, Descripción</th></tr></thead>
      <tbody>{filas.map((p) => <tr key={p.nombre}><td><FilaParam p={p} /></td></tr>)}</tbody>
    </table>
  );
}

function FilaParam({ p }: { p: ParamDoc }) {
  return (
    <>
      <div className="gh-param-linea">
        <code className="gh-param-nombre">{p.nombre}</code>
        <span className="gh-param-tipo">{p.tipo}</span>
        {p.obligatorio && <span className="gh-param-req">Obligatorio</span>}
      </div>
      <div className="gh-param-desc"><TextoConCodigo texto={p.descripcion} /></div>
      {p.extra && <div className="gh-param-extra"><TextoConCodigo texto={p.extra} /></div>}
      {p.enum && (
        <div className="gh-param-extra">
          Puede ser uno de: {p.enum.map((v, i) => <Fragment key={v}>{i ? ', ' : ''}<code className="gh-inline">{v}</code></Fragment>)}
        </div>
      )}
      {p.hijos && (
        <details className="gh-param-hijos">
          <summary>Propiedades de <code className="gh-inline">{p.nombre}</code></summary>
          <table className="gh-tabla gh-tabla-param" style={{ marginTop: 8 }}>
            <thead><tr><th>Nombre, Tipo, Descripción</th></tr></thead>
            <tbody>{p.hijos.map((h) => <tr key={h.nombre}><td><FilaParam p={h} /></td></tr>)}</tbody>
          </table>
        </details>
      )}
    </>
  );
}

type Lenguaje = 'curl' | 'javascript' | 'python';
const LENGUAJES: { id: Lenguaje; label: string }[] = [
  { id: 'curl', label: 'cURL' },
  { id: 'javascript', label: 'JavaScript' },
  { id: 'python', label: 'Python' },
];

function Ejemplos({ e }: { e: EndpointDoc }) {
  const [lenguaje, setLenguaje] = useState<Lenguaje>('curl');
  const [vista, setVista] = useState<'ejemplo' | 'esquema'>('ejemplo');
  const { copiar, copiado } = useCopiar();
  const codigo = e.ejemplos[lenguaje];
  return (
    <>
      <h4>Ejemplo de solicitud</h4>
      <div className="gh-muestra">
        <div className="gh-muestra-cab">
          <Verbo metodo={e.metodo} />
          <code className="gh-muestra-ruta">{e.ruta}</code>
        </div>
        <div className="gh-muestra-barra">
          <div className="gh-segmented" role="group" aria-label="Lenguaje">
            {LENGUAJES.map((l) => (
              <button key={l.id} type="button" aria-pressed={lenguaje === l.id} onClick={() => setLenguaje(l.id)}>{l.label}</button>
            ))}
          </div>
          <BotonCopiar texto={codigo} clave={`${e.id}:${lenguaje}`} copiar={copiar} copiado={copiado} etiqueta="Copiar al portapapeles" />
        </div>
        <pre className="gh-codigo gh-muestra-codigo">{codigo}</pre>
      </div>

      <h4>Respuesta</h4>
      <div className="gh-muestra">
        <div className="gh-muestra-barra">
          <div className="gh-segmented" role="group" aria-label="Respuesta">
            <button type="button" aria-pressed={vista === 'ejemplo'} onClick={() => setVista('ejemplo')}>Ejemplo de respuesta</button>
            <button type="button" aria-pressed={vista === 'esquema'} onClick={() => setVista('esquema')}>Esquema de respuesta</button>
          </div>
          <BotonCopiar texto={vista === 'ejemplo' ? e.ejemplos.respuesta.cuerpo : e.ejemplos.esquema} clave={`${e.id}:${vista}`} copiar={copiar} copiado={copiado} etiqueta="Copiar al portapapeles" />
        </div>
        <div className="gh-muestra-status">Status: {e.ejemplos.respuesta.status}</div>
        <pre className="gh-codigo gh-muestra-codigo">{vista === 'ejemplo' ? e.ejemplos.respuesta.cuerpo : e.ejemplos.esquema}</pre>
      </div>
      {e.ejemplos.respuesta.nota && <p className="gh-note" style={{ marginTop: 8 }}><TextoConCodigo texto={e.ejemplos.respuesta.nota} /></p>}
      {e.probable && <Probar e={e} />}
    </>
  );
}

// ── Probar: la lectura corre de verdad, con los datos del workspace ─────────

function Probar({ e }: { e: EndpointDoc }) {
  // Solo los de primer nivel y que no son objetos: un objeto no viaja por query string.
  const params = [...e.params.ruta, ...e.params.consulta].filter((p) => !p.tipo.includes('object'));
  const [abierto, setAbierto] = useState(false);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [corriendo, setCorriendo] = useState(false);
  const [r, setR] = useState<Prueba | null>(null);
  const { copiar, copiado } = useCopiar();

  const correr = async () => {
    setCorriendo(true); setR(null);
    try { setR(await probarOperacion(e.id, valores)); }
    catch { setR({ ok: false, error: 'No se pudo correr. Prueba de nuevo.' }); }
    finally { setCorriendo(false); }
  };

  if (!abierto) {
    return <div style={{ marginTop: 16 }}><button type="button" className="gh-btn gh-btn--sm" onClick={() => setAbierto(true)}>Probar con tus datos</button></div>;
  }
  return (
    <div className="gh-box" style={{ marginTop: 16 }}>
      <div className="gh-box-header" style={{ padding: '8px 16px' }}><span className="gh-box-title">Probar con tus datos</span></div>
      <div style={{ padding: 16 }}>
        {params.map((p) => (
          <div className="gh-form-group" key={p.nombre} style={{ margin: '0 0 12px' }}>
            <label htmlFor={`probar-${e.id}-${p.nombre}`}><code>{p.nombre}</code>{p.obligatorio && <span className="gh-requerido"> *</span>}</label>
            {p.enum || p.tipo === 'boolean' ? (
              <select id={`probar-${e.id}-${p.nombre}`} className="gh-form-control" value={valores[p.nombre] ?? ''} onChange={(ev) => setValores((x) => ({ ...x, [p.nombre]: ev.target.value }))}>
                <option value="">—</option>
                {(p.enum ?? ['true', 'false']).map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            ) : (
              <input id={`probar-${e.id}-${p.nombre}`} className="gh-form-control" value={valores[p.nombre] ?? ''} placeholder={p.tipo === 'array of strings' ? 'a,b,c' : ''}
                onChange={(ev) => setValores((x) => ({ ...x, [p.nombre]: ev.target.value }))} />
            )}
          </div>
        ))}
        <button type="button" className="gh-btn gh-btn--primary" disabled={corriendo} onClick={() => void correr()}>{corriendo ? 'Corriendo…' : 'Enviar'}</button>
        {r && !r.ok && <div className="gh-flash gh-flash--error" style={{ marginTop: 12, marginBottom: 0 }}>{r.error}{r.faltan?.length ? ` Falta: ${r.faltan.join(', ')}.` : ''}</div>}
        {r && r.ok && (
          <div style={{ marginTop: 12 }}>
            <div className="gh-muestra-status" style={{ padding: '0 0 8px' }}>Status: 200 · {r.formato} · {r.ms} ms{r.recortado ? ' · recortado' : ''}</div>
            <div style={{ position: 'relative' }}>
              <pre className="gh-codigo" style={{ maxHeight: 360 }}>{r.texto || '(vacío)'}</pre>
              <div className="gh-codigo-copiar"><BotonCopiar texto={r.texto} clave="prueba" copiar={copiar} copiado={copiado} /></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function Migas({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Migas" style={{ fontSize: 14, marginBottom: 16, color: 'var(--gh-fg-muted)' }}>
      {items.map((it, i) => (
        <Fragment key={i}>
          {i > 0 && <span style={{ margin: '0 6px' }}>/</span>}
          {it.href ? <Link href={it.href}>{it.label}</Link> : <span style={{ color: 'var(--gh-fg)' }}>{it.label}</span>}
        </Fragment>
      ))}
    </nav>
  );
}


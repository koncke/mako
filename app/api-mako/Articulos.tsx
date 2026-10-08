'use client';

// =============================================================================
// /api-mako › Documentación — los artículos (lo que en GitHub está antes de los endpoints)
// =============================================================================
// Los de la barra lateral de docs.github.com/en/rest: Inicio rápido, Primeros pasos,
// Autenticación, Permisos para tokens detallados, Límites de uso, Versiones, Buenas
// prácticas y Solución de problemas, con la estructura de los de GitHub y los datos de
// MaKo. Los números (topes, versión, cabeceras) llegan por props desde el server, de las
// mismas constantes que usa la API: un artículo que dice «120 por minuto» no puede quedar
// viejo el día que cambie el tope.
// =============================================================================

import { Fragment, type ReactNode } from 'react';
import Link from '@/app/_ui/Link';
import type { AreaDocs } from './datos';
import { referenciaApi, openApiApi } from './actions';
import { BotonCopiar, Icono, Verbo, useCopiar } from './piezas';
import { ARTICULOS, type SlugArticulo } from './articulos-meta';

export type DatosArticulos = {
  base: string;
  version: string;
  limites: { ws: number; ip: number };
  topeCuerpoKb: number;
  indice: AreaDocs[];
  /** una lectura sin parámetros obligatorios, para el inicio rápido */
  ejemplo: { metodo: string; ruta: string; titulo: string } | null;
};

const C = ({ children }: { children: ReactNode }) => <code className="gh-inline">{children}</code>;

function Bloque({ texto, clave, ajustar }: { texto: string; clave: string; ajustar?: boolean }) {
  const { copiar, copiado } = useCopiar();
  return (
    <div style={{ position: 'relative', margin: '0 0 16px' }}>
      <pre className="gh-codigo" style={{ paddingRight: 48, ...(ajustar ? { whiteSpace: 'pre-wrap' } : {}) }}>{texto}</pre>
      <div className="gh-codigo-copiar"><BotonCopiar texto={texto} clave={clave} copiar={copiar} copiado={copiado} /></div>
    </div>
  );
}

function Nota({ children, tono = 'nota' }: { children: ReactNode; tono?: 'nota' | 'aviso' }) {
  return (
    <div className={`gh-alerta${tono === 'aviso' ? ' gh-alerta--warning' : ''}`} role="note">
      <strong>{tono === 'aviso' ? 'Advertencia' : 'Nota'}</strong>
      <div>{children}</div>
    </div>
  );
}

const curl = (d: DatosArticulos, ruta: string, extra: string[] = []) => [
  'curl -L \\',
  ...extra,
  '  -H "Accept: application/json" \\',
  '  -H "Authorization: Bearer <TU-TOKEN>" \\',
  `  -H "X-MaKo-Api-Version: ${d.version}" \\`,
  `  "${d.base}/api/v1${ruta}"`,
].join('\n');

export function Articulo({ slug, d }: { slug: SlugArticulo; d: DatosArticulos }) {
  const a = ARTICULOS[slug];
  return (
    <article className="gh-articulo">
      <h1>{a.titulo}</h1>
      <p className="gh-lead">{a.lead}</p>
      {slug === 'inicio-rapido' && <InicioRapido d={d} />}
      {slug === 'primeros-pasos' && <PrimerosPasos d={d} />}
      {slug === 'autenticacion' && <Autenticacion d={d} />}
      {slug === 'permisos' && <Permisos d={d} />}
      {slug === 'limites' && <Limites d={d} />}
      {slug === 'versiones' && <Versiones d={d} />}
      {slug === 'openapi' && <OpenApi d={d} />}
      {slug === 'buenas-practicas' && <BuenasPracticas d={d} />}
      {slug === 'problemas' && <Problemas d={d} />}
      {slug === 'migrar-curso' && <MigrarCurso d={d} />}
    </article>
  );
}

function InicioRapido({ d }: { d: DatosArticulos }) {
  return (
    <>
      <h2 id="introduccion">Introducción</h2>
      <p>Este artículo te lleva de cero a tu primer pedido con <C>curl</C>. Necesitas un token y una terminal. Los ejemplos de cada endpoint también están en JavaScript y Python.</p>

      <h2 id="crear-token">1. Crea un token</h2>
      <p>Ve a <Link href="/api-mako?tab=tokens&v=nuevo">Tokens → Generar nuevo token</Link>. Ponle un nombre que diga quién lo usa (<C>n8n</C>, <C>Zapier</C>), elige cuándo vence y dale solo los permisos que necesita: por ejemplo, <strong>Solo lectura</strong> en «CRM».</p>
      <Nota>El token se muestra una sola vez. Cópialo y guárdalo en un lugar seguro: MaKo solo guarda una huella para reconocerlo.</Nota>

      <h2 id="primer-pedido">2. Haz tu primer pedido</h2>
      <p>El catálogo te dice qué puede pedir tu token. Con <C>?compacto=1</C> trae solo el índice:</p>
      <Bloque clave="qs-1" texto={curl(d, '?compacto=1')} />
      <p>Si ves la lista, el token funciona. Si ves un <C>401</C>, revisa que el encabezado diga <C>Bearer</C> y el token completo.</p>

      {d.ejemplo && (
        <>
          <h2 id="leer">3. Lee algo de tu negocio</h2>
          <p>Por ejemplo, «{d.ejemplo.titulo}»:</p>
          <p><Verbo metodo={d.ejemplo.metodo} /><C>{d.ejemplo.ruta}</C></p>
          <Bloque clave="qs-2" texto={curl(d, d.ejemplo.ruta)} />
        </>
      )}

      <h2 id="escribir">{d.ejemplo ? '4' : '3'}. Escribe</h2>
      <p>Con <strong>Lectura y escritura</strong> en un área, el token hace los cambios en el acto, como cualquier API: crea, modifica, borra. Lo que gasta dinero (una campaña, un presupuesto) no: queda como <strong>propuesta</strong> y la respuesta trae el link a la pantalla donde una persona la confirma.</p>
      <p>El token clásico (el de la skill de Claude) nunca escribe directo: deja una acción pendiente o una propuesta.</p>

      <h2 id="siguientes">Próximos pasos</h2>
      <ul>
        <li><Link href="/api-mako?tab=docs&art=primeros-pasos">Primeros pasos con la API REST</Link></li>
        <li><Link href="/api-mako?tab=docs&art=autenticacion">Autenticarse en la API REST</Link></li>
        <li><Link href="/api-mako?tab=docs&art=permisos">Permisos que necesitan los tokens detallados</Link></li>
      </ul>
    </>
  );
}

function PrimerosPasos({ d }: { d: DatosArticulos }) {
  return (
    <>
      <h2 id="pedidos">Acerca de los pedidos</h2>
      <h3>Método HTTP</h3>
      <p>El verbo dice qué hace el pedido: <C>GET</C> lee, <C>POST</C> crea, <C>PATCH</C> modifica una parte, <C>PUT</C> fija un estado y <C>DELETE</C> borra. Cada endpoint de esta documentación muestra el suyo.</p>
      <h3>Ruta</h3>
      <p>Todas las rutas empiezan con <C>{d.base}/api/v1</C> y siguen con el área y el recurso: <C>/crm/leads/{'{leadId}'}</C>. Lo que va entre llaves es un <strong>parámetro de ruta</strong>: se reemplaza por el valor.</p>
      <h3>Encabezados</h3>
      <ul>
        <li><C>Authorization: Bearer &lt;TU-TOKEN&gt;</C> — obligatorio. Ver <Link href="/api-mako?tab=docs&art=autenticacion">Autenticación</Link>.</li>
        <li><C>Accept: application/json</C> — recomendado.</li>
        <li><C>X-MaKo-Api-Version: {d.version}</C> — recomendado. Ver <Link href="/api-mako?tab=docs&art=versiones">Versiones de la API</Link>.</li>
        <li><C>User-Agent</C> — obligatorio. <C>curl</C>, los navegadores y las librerías lo mandan solas; un pedido sin él recibe un <C>403</C>.</li>
        <li><C>Content-Type: application/json</C> — en los pedidos con cuerpo.</li>
      </ul>
      <h3>Parámetros</h3>
      <p>Los de <strong>ruta</strong> van en la URL. Los de <strong>consulta</strong> van después de <C>?</C> (en los <C>GET</C>). Los del <strong>cuerpo</strong> van en un JSON (en <C>POST</C>, <C>PATCH</C>, <C>PUT</C> y <C>DELETE</C>). Cada endpoint los lista en «Parámetros».</p>
      <Nota>Si un texto lleva acentos, manda el JSON desde un archivo (<C>--data-binary @cuerpo.json</C>) en vez de escribirlo en la terminal: algunas terminales cambian la codificación.</Nota>

      <h2 id="respuesta">Acerca de la respuesta</h2>
      <h3>Códigos de estado</h3>
      <p><C>200</C> salió bien. <C>202</C> quedó aceptado pero no hecho: una propuesta o una acción pendiente que confirma una persona. <C>304</C> no cambió desde tu último pedido. Los <C>4xx</C> son del pedido y los <C>5xx</C>, nuestros. Ver <Link href="/api-mako?tab=docs&art=problemas">Solución de problemas</Link>.</p>
      <h3>Encabezados</h3>
      <p>Toda respuesta trae los del <Link href="/api-mako?tab=docs&art=limites">límite de uso</Link>, <C>X-MaKo-Api-Version-Selected</C>, <C>X-MaKo-Request-Id</C> (el id del pedido, para reportar un problema) y, si el token vence, <C>MaKo-Authentication-Token-Expiration</C>.</p>
      <h3>Cuerpo</h3>
      <p>Las lecturas en JSON devuelven <C>{'{ "ok": true, "resultado": … }'}</C>. Algunas devuelven markdown o texto; lo dice cada endpoint. Una escritura hecha devuelve <C>{'{ "ok": true, "hecho": true, "resumen": "…" }'}</C>.</p>
      <h3>Pedidos condicionales</h3>
      <p>Las lecturas traen un <C>ETag</C>. Si lo mandas en <C>If-None-Match</C> y nada cambió, la respuesta es un <C>304</C> sin cuerpo.</p>

      <h2 id="catalogo">El catálogo</h2>
      <p><C>GET /api/v1</C> devuelve todo lo que tu token puede pedir, con sus parámetros. Lo que no aparece no existe para ese token.</p>
      <ul>
        <li><C>?compacto=1</C> trae solo el índice (id, método, ruta y título).</li>
        <li><C>?area=crm,ads</C> trae solo esas áreas.</li>
        <li><C>?operacion=&lt;id&gt;</C> trae una sola, con todo.</li>
      </ul>
      <Bloque clave="pp-1" texto={curl(d, '?compacto=1')} />

      <h2 id="rutas-de-siempre">Las rutas por operación</h2>
      <p>Cada endpoint responde también por su ruta de siempre, <C>GET|POST /api/v1/{'{area}'}/{'{operacion}'}</C>, que se mantiene por compatibilidad. Las rutas por recurso (las de esta documentación) son las recomendadas.</p>
    </>
  );
}

function Autenticacion({ d }: { d: DatosArticulos }) {
  return (
    <>
      <h2 id="acerca">Acerca de la autenticación</h2>
      <p>Todos los endpoints piden un token. Cada token es de un solo workspace: no hay forma de pedir los datos de otro.</p>

      <h2 id="tipos">Tipos de token</h2>
      <table className="gh-tabla">
        <thead><tr><th></th><th>Detallado</th><th>Clásico</th></tr></thead>
        <tbody>
          <tr><td>Prefijo</td><td><C>mako_pat_</C></td><td><C>mkoag_</C></td></tr>
          <tr><td>Para qué</td><td>Integraciones: n8n, Zapier, Make, un script propio</td><td>La skill de Claude</td></tr>
          <tr><td>Permisos</td><td>Por área: Sin acceso, Solo lectura o Lectura y escritura</td><td>Un alcance para todo: leer, proponer o ejecutar</td></tr>
          <tr><td>Escribe</td><td>En el acto (salvo lo que gasta dinero)</td><td>Nunca: deja pendientes y propuestas</td></tr>
          <tr><td>Vence</td><td>Cuando elijas (hasta un año) o nunca</td><td>No</td></tr>
          <tr><td>Dónde se crea</td><td><Link href="/api-mako?tab=tokens">API → Tokens</Link></td><td><Link href="/integraciones?abrir=agente">Integraciones → Claude</Link></td></tr>
          <tr><td>Rutas</td><td>Solo <C>/api/v1</C></td><td><C>/api/v1</C> y las de la skill</td></tr>
        </tbody>
      </table>
      <p>Para una integración nueva, usa un token detallado: uno por integración, con lo mínimo que necesita y con vencimiento.</p>

      <h2 id="enviar">Cómo se envía</h2>
      <p>En el encabezado <C>Authorization</C>, con <C>Bearer</C> (o <C>token</C>, que también se acepta):</p>
      <Bloque clave="au-1" texto={curl(d, '/rate_limit')} />
      <p>Si falta, no existe o venció, la respuesta es un <C>401</C>.</p>

      <h2 id="vencimiento">Vencimiento</h2>
      <p>Un token detallado vence en la fecha que elegiste al crearlo. Cada respuesta trae <C>MaKo-Authentication-Token-Expiration</C> con la fecha, para que tu integración avise antes. Un token vencido no se renueva: se <strong>regenera</strong> (valor nuevo, mismos permisos) desde la página del token.</p>

      <h2 id="filtrado">Si un token se filtra</h2>
      <p>Elimínalo o regenéralo en <Link href="/api-mako?tab=tokens">Tokens</Link>: deja de funcionar en el acto. Después revisa el <Link href="/api-mako?tab=registro">Registro</Link> para ver qué se pidió con él y desde dónde.</p>

      <h2 id="seguridad">Mantén seguros tus tokens</h2>
      <ul>
        <li>Trátalos como contraseñas. No los pegues en un chat, un repositorio o un documento compartido.</li>
        <li>Guárdalos en el gestor de credenciales de tu integración (en n8n, «Credentials»).</li>
        <li>Dale a cada token solo las áreas que usa, y un vencimiento.</li>
        <li>Elimina los que ya no uses: la lista dice cuándo se usó cada uno por última vez.</li>
      </ul>
    </>
  );
}

function Permisos({ d }: { d: DatosArticulos }) {
  return (
    <>
      <h2 id="acerca">Acerca de los permisos</h2>
      <p>Un token detallado tiene un permiso por área: <strong>Sin acceso</strong>, <strong>Solo lectura</strong> o <strong>Lectura y escritura</strong>. Leer pide lectura; crear, modificar o borrar pide escritura. Si al token le falta el permiso, la respuesta es un <C>403</C> y el encabezado <C>X-Accepted-MaKo-Permissions</C> dice cuál necesita (por ejemplo <C>crm=write</C>).</p>
      <Nota>«MaKo (pendientes, propuestas, chats)» da acceso a las pendientes y propuestas de todas las áreas.</Nota>
      {d.indice.map((a) => (
        <Fragment key={a.area}>
          <h2 id={`permisos-${a.area}`}>Permisos de «{a.titulo}»</h2>
          <ul style={{ listStyle: 'none', paddingLeft: 0 }}>
            {a.recursos.flatMap((r) => r.endpoints.map((e) => (
              <li key={e.id} style={{ padding: '2px 0' }}>
                <Link href={`/api-mako?tab=docs&area=${a.area}&recurso=${r.slug}#${e.id}`}><Verbo metodo={e.metodo} /><code style={{ fontSize: 13 }}>{e.ruta}</code></Link>
                <span style={{ color: 'var(--gh-fg-muted)' }}> ({e.nivel})</span>
              </li>
            )))}
          </ul>
        </Fragment>
      ))}
    </>
  );
}

function Limites({ d }: { d: DatosArticulos }) {
  return (
    <>
      <h2 id="acerca">Acerca de los límites</h2>
      <p>Cada workspace puede hacer hasta <strong>{d.limites.ws} pedidos por minuto</strong>, sumando todos sus tokens. Además, cada IP puede hacer hasta {d.limites.ip} por minuto, para frenar un token que alguien está probando a ciegas.</p>
      <p>El cuerpo de un pedido puede pesar hasta {d.topeCuerpoKb} KB. Los textos se cortan en 4000 caracteres y las listas en 200 elementos, salvo que el endpoint diga otro tope.</p>

      <h2 id="encabezados">Encabezados del límite</h2>
      <table className="gh-tabla">
        <thead><tr><th>Encabezado</th><th>Descripción</th></tr></thead>
        <tbody>
          <tr><td><C>x-ratelimit-limit</C></td><td>Cuántos pedidos por minuto puedes hacer.</td></tr>
          <tr><td><C>x-ratelimit-remaining</C></td><td>Cuántos te quedan en esta ventana.</td></tr>
          <tr><td><C>x-ratelimit-used</C></td><td>Cuántos hiciste en esta ventana.</td></tr>
          <tr><td><C>x-ratelimit-reset</C></td><td>Cuándo empieza la ventana nueva, en segundos desde 1970 (UTC).</td></tr>
          <tr><td><C>x-ratelimit-resource</C></td><td>Qué límite se contó: <C>core</C>.</td></tr>
        </tbody>
      </table>

      <h2 id="consultar">Consultar el estado</h2>
      <p><C>GET /api/v1/rate_limit</C> devuelve cuánto queda, sin gastar un pedido:</p>
      <Bloque clave="li-1" texto={curl(d, '/rate_limit')} />

      <h2 id="superar">Si superas el límite</h2>
      <p>La respuesta es un <C>429</C> con <C>retry-after</C>: los segundos que tienes que esperar. Espera eso antes de reintentar; reintentar antes vuelve a dar <C>429</C>.</p>
    </>
  );
}

function Versiones({ d }: { d: DatosArticulos }) {
  return (
    <>
      <h2 id="acerca">Acerca del versionado</h2>
      <p>La API se versiona por fecha. Cuando un cambio rompa lo que ya existe, sale una versión nueva con su fecha, y la anterior se sigue sirviendo: tu integración responde igual hasta que decidas cambiar.</p>
      <p>Lo que <strong>no</strong> rompe y llega sin versión nueva: un endpoint nuevo, un parámetro opcional nuevo, un campo nuevo en una respuesta, un encabezado nuevo. Escribe tu integración para que ignore lo que no conoce.</p>

      <h2 id="especificar">Especificar una versión</h2>
      <p>Con el encabezado <C>X-MaKo-Api-Version</C>. Sin él, se usa la versión {d.version}. Una versión que no existe recibe un <C>400</C>. La respuesta dice cuál se usó en <C>X-MaKo-Api-Version-Selected</C>.</p>
      <Bloque clave="ve-1" texto={curl(d, '/rate_limit')} />

      <h2 id="admitidas">Versiones admitidas</h2>
      <table className="gh-tabla">
        <thead><tr><th>Versión</th><th>Estado</th></tr></thead>
        <tbody><tr><td><C>{d.version}</C></td><td>La más reciente</td></tr></tbody>
      </table>
    </>
  );
}

function descargar(nombre: string, tipo: string, contenido: string) {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const a = document.createElement('a');
  a.href = url; a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function BotonesDescarga() {
  const bajarOpenApi = async () => {
    const r = await openApiApi();
    if ('json' in r) descargar('mako-api.openapi.json', 'application/json', r.json);
  };
  const bajarMd = async () => {
    const r = await referenciaApi();
    if ('markdown' in r) descargar('mako-api.md', 'text/markdown', r.markdown);
  };
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
      <button type="button" className="gh-btn" onClick={() => void bajarOpenApi()}><Icono n="download" />OpenAPI (JSON)</button>
      <button type="button" className="gh-btn" onClick={() => void bajarMd()}><Icono n="download" />Referencia (markdown)</button>
    </div>
  );
}

function OpenApi({ d }: { d: DatosArticulos }) {
  return (
    <>
      <h2 id="acerca">Acerca de la descripción OpenAPI</h2>
      <p>Es un documento <a href="https://spec.openapis.org/oas/v3.1.0" target="_blank" rel="noreferrer">OpenAPI 3.1</a> con todos los endpoints de tu workspace: rutas, parámetros, respuestas y el permiso que pide cada uno (<C>x-mako-permiso</C>). Sirve para importar la API en n8n, Postman o Insomnia, o para generar un cliente.</p>
      <h2 id="obtener">Obtenerla</h2>
      <p>Descárgala de aquí, o pídela con tu token:</p>
      <BotonesDescarga />
      <Bloque clave="oa-1" texto={curl(d, '/openapi.json')} />
      <p>También está la misma referencia en markdown, pensada para un agente: <C>GET /api/v1/docs</C>.</p>
    </>
  );
}

function BuenasPracticas({ d }: { d: DatosArticulos }) {
  return (
    <>
      <h2 id="catalogo">Usa el catálogo en vez de armar las rutas a mano</h2>
      <p><C>GET /api/v1</C> dice qué existe para tu token y con qué parámetros. Si tu integración lo lee, se entera sola de lo nuevo.</p>
      <h2 id="serie">Haz los pedidos en serie</h2>
      <p>Varios pedidos a la vez gastan el límite del workspace ({d.limites.ws} por minuto) más rápido y no terminan antes. Espera la respuesta de uno antes de mandar el siguiente.</p>
      <h2 id="condicionales">Usa pedidos condicionales</h2>
      <p>Guarda el <C>ETag</C> de cada lectura y mándalo en <C>If-None-Match</C>: si nada cambió, recibes un <C>304</C> sin cuerpo.</p>
      <h2 id="limites">Respeta los límites</h2>
      <p>Lee <C>x-ratelimit-remaining</C>. Si recibes un <C>429</C>, espera lo que dice <C>retry-after</C>.</p>
      <h2 id="errores">No ignores los errores</h2>
      <p>Un <C>4xx</C> repetido no se arregla reintentando. Lee <C>message</C> y <C>documentation_url</C>: dicen qué falta y dónde está explicado.</p>
      <h2 id="tokens">Un token por integración</h2>
      <p>Con lo mínimo que necesita y con vencimiento. Si una integración se filtra, la cortas sin tocar las demás, y el registro dice qué pidió cada una.</p>
      <h2 id="dinero">Lo que gasta dinero pasa por una persona</h2>
      <p>Una campaña o un presupuesto vuelven con <C>202</C> y un link: pásale el link entero a la persona. No se hace nada hasta que lo confirma ahí.</p>
    </>
  );
}

function Problemas(_: { d: DatosArticulos }) {
  const filas: [string, ReactNode][] = [
    ['400', <>El pedido está mal: falta un parámetro (<C>faltan</C> dice cuáles), tiene otra forma, el JSON no se pudo leer o la versión pedida no existe.</>],
    ['401', <>El token falta, no existe o venció. Revisa el encabezado <C>Authorization</C>. Si venció, regenéralo.</>],
    ['403', <>Al token le falta el permiso del área: <C>X-Accepted-MaKo-Permissions</C> dice cuál. También responde <C>403</C> un pedido sin <C>User-Agent</C>.</>],
    ['404', <>La ruta no existe o no es para este token (por ejemplo, depende de un plan que el workspace no tiene). Pide el catálogo: <C>GET /api/v1?compacto=1</C>.</>],
    ['405', <>La ruta por operación existe, pero con otro verbo: <C>Allow</C> dice cuál.</>],
    ['413', <>El cuerpo pesa demasiado.</>],
    ['422', <>El pedido está bien formado pero no se pudo hacer (por ejemplo, el lead no existe). El motivo viene en <C>message</C>.</>],
    ['429', <>Superaste el límite. Espera lo que dice <C>retry-after</C>.</>],
    ['5xx', <>Falló de nuestro lado. Reintenta en un momento; si sigue, avísanos con el <C>X-MaKo-Request-Id</C> de la respuesta.</>],
  ];
  return (
    <>
      <h2 id="formato">El formato de un error</h2>
      <p>Todo error devuelve un JSON con <C>message</C> (qué pasó), <C>documentation_url</C> (dónde está explicado) y <C>status</C>. A veces trae más: <C>faltan</C> con los parámetros que faltan o <C>disponibles</C> con lo que sí se puede pedir.</p>
      <Bloque clave="pr-1" texto={JSON.stringify({ message: 'Recurso no accesible con un token de acceso personal detallado: le falta el permiso que dice X-Accepted-MaKo-Permissions.', documentation_url: 'https://…/api-mako?tab=docs…', status: '403' }, null, 2)} />
      <h2 id="codigos">Los códigos, uno por uno</h2>
      <table className="gh-tabla">
        <thead><tr><th style={{ width: 80 }}>Código</th><th>Qué significa y qué hacer</th></tr></thead>
        <tbody>{filas.map(([c, t]) => <tr key={c}><td><C>{c}</C></td><td>{t}</td></tr>)}</tbody>
      </table>
    </>
  );
}

/**
 * La guía para quien no es técnico (pedido de Martín, 08/10/2026: «un pequeño tutorial de copia tu
 * token de API, pásalo a Claude y dile que te haga tal»). El mensaje para Claude nombra las rutas
 * REST del área «curso»: si cambian, tests/api-mako-curso.test.ts lo nota.
 */
function MigrarCurso({ d }: { d: DatosArticulos }) {
  const mensaje = [
    'Quiero migrar un curso a MaKo usando su API.',
    '',
    `- La API de MaKo: ${d.base}/api/v1 (la referencia completa, con mi token: GET ${d.base}/api/v1/docs).`,
    '- Mi token: <PEGA-AQUÍ-TU-TOKEN>. Va en el encabezado «Authorization: Bearer <token>».',
    '- El curso de origen: <dónde está: Panda (con su API key), un CSV, una lista de links o una página>.',
    '',
    'Hazlo en este orden:',
    '1. GET /api/v1/curso/cursos y pregúntame en qué producto lo cargo.',
    '2. Lee el curso de origen y muéstrame los módulos y las clases que vas a crear, en orden. Espera mi OK.',
    '3. Crea cada módulo con POST /api/v1/curso/cursos/{productoId}/modulos (nombre). Guarda la clave que devuelve.',
    '4. Para cada clase, EN ORDEN: POST /api/v1/curso/cursos/{productoId}/clases con moduloClave, titulo, videoUrl, descripcion, minutos y, si tiene, sus tareas (en «tareas»).',
    '   El video: el link, o el código para insertar (el <iframe> entero) si viene de Panda u otra plataforma que no da un link público.',
    '5. Al final, GET /api/v1/curso/cursos/{productoId} y dime cuántas clases quedaron contra cuántas tenía el origen.',
    '',
    'Si un pedido falla, NO lo repitas a ciegas: mira primero el curso, para no duplicar clases.',
  ].join('\n');
  return (
    <>
      <h2 id="necesitas">Lo que necesitas</h2>
      <ul>
        <li>Un <strong>token detallado</strong> con <strong>Lectura y escritura</strong> en «Curso (módulos y clases)». Nada más: no hace falta darle acceso al CRM ni a los clientes.</li>
        <li><strong>Claude</strong> con la posibilidad de hacer pedidos a una API: Claude Code, o Claude con una herramienta que llame a URLs.</li>
        <li>El curso de origen: el acceso a la API de tu plataforma (por ejemplo, Panda) o una lista con los títulos, los links de los videos y las descripciones.</li>
      </ul>

      <h2 id="token">1. Crea el token</h2>
      <p>En <Link href="/api-mako?tab=tokens&v=nuevo">Tokens → Generar nuevo token</Link>: ponle un nombre («Migración del curso»), un vencimiento corto (7 días alcanzan) y, en Permisos, <strong>Lectura y escritura</strong> en «Curso (módulos y clases)». Copia el token: se ve una sola vez.</p>

      <h2 id="mensaje">2. Pégale esto a Claude</h2>
      <p>Cambia lo que está entre <C>&lt;…&gt;</C> y mándaselo:</p>
      <Bloque clave="migrar-curso" texto={mensaje} ajustar />
      <p>Claude te va a mostrar el plan antes de crear nada. Revísalo: el orden de las clases es el orden en que se van a ver.</p>

      <h2 id="saber">Lo que tienes que saber</h2>
      <ul>
        <li><strong>El video va por link o por código.</strong> Un link de YouTube, Vimeo, Loom o Google Drive, o un archivo <C>.mp4</C>. De Panda, Wistia o Bunny, el código para insertar: el <C>&lt;iframe …&gt;</C> entero.</li>
        <li><strong>Lo que se crea se ve en el curso enseguida.</strong> Si tu curso ya tiene alumnos, pídele a Claude que lo cargue en módulos nuevos.</li>
        <li><strong>Los módulos nuevos no tocan tu tablero de clientes.</strong> Nacen como secciones del curso. Para que un módulo sea además una etapa del tablero, hay que pedirlo (<C>vinculado: true</C>).</li>
        <li><strong>Las tareas van en <C>tareas</C>.</strong> La primera es la principal y va sin título; las demás, con título. El quiz y los campos de la comunidad se arman en MaKo.</li>
        <li><strong>El ritmo:</strong> hasta {d.limites.ws} pedidos por minuto. Un curso de 100 clases tarda unos pocos minutos.</li>
        <li><strong>Si algo sale mal</strong>, <C>DELETE /api/v1/curso/clases/&#123;claseId&#125;</C> manda una clase a la papelera, y <C>PUT …/restauracion</C> la devuelve durante 7 días.</li>
      </ul>

      <h2 id="endpoints">Los endpoints</h2>
      <p>Todos están en <Link href="/api-mako?tab=docs&area=curso">Curso (módulos y clases)</Link>, con sus parámetros y ejemplos.</p>
    </>
  );
}

'use client';

// =============================================================================
// /api-mako › Tokens — los «Personal access tokens» de GitHub (Settings → Developer settings)
// =============================================================================
// Decisiones de Martín (08/10/2026): «como GitHub: escribe directo», permisos POR ÁREA y
// expiración, y «que se vea igual a GitHub». La forma, copiada de la de GitHub:
//   · menú a la izquierda: «Tokens detallados» | «Tokens (clásicos)»;
//   · la lista: nombre (link), último uso, «Eliminar», y abajo cuándo vence;
//   · «Generar nuevo token»: nombre, vencimiento (7/30/60/90/personalizada/sin), descripción,
//     dueño del recurso (el workspace, fijo), permisos por área (Sin acceso / Solo lectura /
//     Lectura y escritura) y el resumen;
//   · recién creado, el token se ve UNA vez en una fila verde con el aviso azul;
//   · la página del token: editar (nombre, descripción, permisos), regenerar (valor nuevo y
//     vencimiento nuevo) y eliminar.
// El clásico es el principal de la skill de Claude: se acuña en Integraciones → Claude (su
// trato de consentimiento vive allí); acá se lo ve y se lo puede eliminar.
//
// La vista vive en la URL (`?tab=tokens&v=nuevo`, `&t=<id>&accion=editar`): el link que se
// copia es lo que se está viendo. Después de un cambio, `router.refresh()` relee la lista en el
// server; el token recién acuñado vive en el estado de este componente (no viaja en la URL).
// =============================================================================

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import Link, { useRouter } from '@/app/_ui/Link';
import type { TokensDelWorkspace } from '@/lib/api-mako/tokens';
import type { TokenPublico } from '@/lib/api-mako/tokens-lista';
import { TEXTO_NIVEL, type NivelPermiso, type Permisos } from '@/lib/api-mako/permisos';
import { TEXTO_ALCANCE } from '@/lib/api-mako/alcance';
import {
  EXPIRACION_POR_DEFECTO, MAX_DESCRIPCION, MAX_DIAS_EXPIRACION, MAX_NOMBRE, OPCIONES_EXPIRACION, TEXTO_EXPIRACION,
  type OpcionExpiracion,
} from '@/lib/api-mako/tokens-forma';
import type { AreaDocs } from './datos';
import { crearTokenApi, editarTokenApi, regenerarTokenApi, revocarTokenApi } from './actions';
import { BotonCopiar, Icono, fechaLarga, ultimoUso, useCopiar } from './piezas';

export type VistaTokens = { v: 'detallados' | 'nuevo' | 'clasicos' } | { v: 'token'; id: string; accion: 'ver' | 'editar' | 'regenerar' };

const T = '/api-mako?tab=tokens';
const hrefToken = (id: string, accion?: 'editar' | 'regenerar') => `${T}&t=${encodeURIComponent(id)}${accion ? `&accion=${accion}` : ''}`;

const TEXTO_PERMISO: Record<'lectura' | 'escritura', string> = { lectura: 'Lectura', escritura: 'Lectura y escritura' };

/**
 * El token recién acuñado, entre la acción y la lista. NO es estado del componente: cambiar
 * `?v=nuevo` por la lista es otra página para el router (los searchParams son parte de la
 * clave del segmento) y el componente se vuelve a montar —el primer e2e lo perdió así—.
 * Tampoco va a sessionStorage ni a la URL: vive en la memoria de esta pestaña, se muestra una
 * vez y desaparece al recargar, como en GitHub.
 */
let recienAcunado: { id: string; token: string } | null = null;

export function Tokens({ tokens, vista, indice, workspace }: {
  tokens: TokensDelWorkspace | null;
  vista: VistaTokens;
  indice: AreaDocs[];
  workspace: string;
}) {
  const router = useRouter();
  const [nuevo, setNuevoEstado] = useState<{ id: string; token: string } | null>(() => recienAcunado);
  const setNuevo = (x: { id: string; token: string } | null) => { recienAcunado = x; setNuevoEstado(x); };
  // Lo levantó el estado inicial de ESTA vista: desde acá se olvida, y la próxima vista que se
  // monte (otra navegación, otra pestaña de la tab) ya no lo ve. No se limpia al desmontar: la
  // vista nueva se renderiza ANTES de que la vieja se desmonte, pero mejor no depender de eso.
  useEffect(() => { recienAcunado = null; }, []);
  const [borrar, setBorrar] = useState<{ id: string; nombre: string; clasico: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!tokens) return <div className="gh-flash gh-flash--error" style={{ marginTop: 24 }}>No se pudieron leer los tokens. Recarga la página.</div>;

  // A otra vista: `push` ya trae la página fresca del server (es dinámica). A la MISMA (borrar
  // desde la lista): `refresh`. Las dos juntas montaban la vista dos veces, y la segunda ya no
  // veía el token recién acuñado.
  const ir = (href: string) => {
    setError(null);
    const actual = new URL(window.location.href);
    const destino = new URL(href, window.location.origin);
    actual.searchParams.delete('ws');
    if (actual.pathname === destino.pathname && actual.searchParams.toString() === destino.searchParams.toString()) router.refresh();
    else router.push(href, { scroll: true });
  };

  const eliminar = async () => {
    if (!borrar) return;
    const r = await revocarTokenApi(borrar.id);
    if ('error' in r) { setError(r.error); setBorrar(null); return; }
    setBorrar(null);
    if (nuevo?.id === borrar.id) setNuevo(null);
    ir(borrar.clasico ? `${T}&v=clasicos` : T);
  };

  let cuerpo: ReactNode;
  if (vista.v === 'nuevo') {
    cuerpo = (
      <FormToken modo="nuevo" indice={indice} workspace={workspace}
        onListo={(r) => { setNuevo({ id: r.publico.id, token: r.token }); ir(T); }} onCancelar={() => ir(T)} />
    );
  } else if (vista.v === 'clasicos') {
    cuerpo = <Clasicos tokens={tokens} onEliminar={() => setBorrar({ id: 'principal', nombre: 'Skill de Claude', clasico: true })} />;
  } else if (vista.v === 'token') {
    const t = tokens.tokens.find((x) => x.id === vista.id);
    if (!t) {
      cuerpo = (
        <div className="gh-blankslate">
          <Icono n="key" size={24} />
          <h3>Ese token ya no existe</h3>
          <p>Puede que lo hayan eliminado.</p>
          <Link href={T}>Volver a los tokens</Link>
        </div>
      );
    } else if (vista.accion === 'editar') {
      cuerpo = <FormToken modo="editar" token={t} indice={indice} workspace={workspace} onListo={() => ir(hrefToken(t.id))} onCancelar={() => ir(hrefToken(t.id))} />;
    } else if (vista.accion === 'regenerar') {
      cuerpo = <Regenerar t={t} onListo={(r) => { setNuevo({ id: t.id, token: r.token }); ir(T); }} onCancelar={() => ir(hrefToken(t.id))} />;
    } else {
      cuerpo = <Detalle t={t} indice={indice} workspace={workspace} onEliminar={() => setBorrar({ id: t.id, nombre: t.nombre, clasico: false })} />;
    }
  } else {
    cuerpo = <Lista tokens={tokens.tokens} nuevo={nuevo} onEliminar={(t) => setBorrar({ id: t.id, nombre: t.nombre, clasico: false })} />;
  }

  const enClasicos = vista.v === 'clasicos';
  return (
    <div className="gh-ajustes">
      <nav className="gh-ajustes-nav" aria-label="Tokens">
        <h2>Tokens de acceso personal</h2>
        <ul className="gh-docs-nav" style={{ padding: 0 }}>
          <li><Link className="gh-docs-nav-item" href={T} aria-current={!enClasicos ? 'page' : undefined}>Tokens detallados</Link></li>
          <li><Link className="gh-docs-nav-item" href={`${T}&v=clasicos`} aria-current={enClasicos ? 'page' : undefined}>Tokens (clásicos)</Link></li>
        </ul>
      </nav>
      <div style={{ minWidth: 0 }}>
        {error && <div className="gh-flash gh-flash--error" role="alert">{error}</div>}
        {cuerpo}
      </div>
      {borrar && (
        <Dialogo
          titulo={borrar.clasico ? '¿Eliminar el token clásico?' : '¿Eliminar este token?'}
          confirmar="Entiendo, eliminar este token"
          onConfirmar={eliminar}
          onCancelar={() => setBorrar(null)}
        >
          {borrar.clasico
            ? 'La skill de Claude deja de funcionar hasta que generes otro en Integraciones → Claude.'
            : <>Todo lo que use «{borrar.nombre}» deja de funcionar en el acto. No se puede deshacer.</>}
        </Dialogo>
      )}
    </div>
  );
}

// ── La lista de tokens detallados ────────────────────────────────────────────

function Vence({ t }: { t: Pick<TokenPublico, 'expira' | 'vencido'> }) {
  if (t.vencido) return <span style={{ color: 'var(--gh-fg-danger)' }}><Icono n="alert" /> Este token venció el {fechaLarga(t.expira)}.</span>;
  if (!t.expira) return <span style={{ color: 'var(--gh-fg-attention)' }}><Icono n="alert" /> Este token no vence.</span>;
  return <span>Vence el <strong>{fechaLarga(t.expira)}</strong>.</span>;
}

function Lista({ tokens, nuevo, onEliminar }: { tokens: TokenPublico[]; nuevo: { id: string; token: string } | null; onEliminar: (t: TokenPublico) => void }) {
  const { copiar, copiado } = useCopiar();
  return (
    <>
      <div className="gh-subhead">
        <h2 className="gh-subhead-heading">Tokens de acceso personal detallados</h2>
        <Link className="gh-btn" href={`${T}&v=nuevo`}>Generar nuevo token</Link>
        <p className="gh-subhead-description" style={{ margin: 0 }}>Tokens con permisos por área, para integraciones y para usar la API desde tus propios scripts.</p>
      </div>
      {nuevo && tokens.some((t) => t.id === nuevo.id) && (
        <div className="gh-flash" role="status">Asegúrate de copiar tu token de acceso personal ahora. ¡No podrás volver a verlo!</div>
      )}
      {!tokens.length ? (
        <div className="gh-box gh-blankslate">
          <Icono n="key" size={24} />
          <h3>Todavía no hay tokens detallados</h3>
          <p>Genera uno por integración: n8n, Zapier, Make o un script propio.</p>
          <Link className="gh-btn gh-btn--primary" href={`${T}&v=nuevo`}>Generar nuevo token</Link>
        </div>
      ) : (
        <div className="gh-box">
          <div className="gh-box-header" style={{ padding: '12px 16px' }}><span className="gh-box-title">Tokens detallados</span> <span className="gh-counter">{tokens.length}</span></div>
          <ul style={{ margin: 0, padding: 0 }}>
            {tokens.map((t) => {
              const recien = nuevo?.id === t.id;
              return (
                <li key={t.id} className={`gh-box-row${recien ? ' gh-box-row--nueva' : ''}`}>
                  {recien && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <Icono n="check" />
                      <code style={{ fontSize: 13, wordBreak: 'break-all' }}>{nuevo.token}</code>
                      <BotonCopiar texto={nuevo.token} clave="nuevo" copiar={copiar} copiado={copiado} etiqueta="Copiar token" />
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 240px', minWidth: 0 }}>
                      <Link href={hrefToken(t.id)} style={{ fontWeight: 600 }}>{t.nombre}</Link>
                      <span style={{ marginLeft: 8, color: 'var(--gh-fg-muted)', fontSize: 12 }}>{resumenPermisos(t.permisos)}</span>
                    </div>
                    <span style={{ color: 'var(--gh-fg-muted)', fontSize: 12 }}>{ultimoUso(t.ultimoUso)}</span>
                    <button type="button" className="gh-btn gh-btn--sm gh-btn--danger" onClick={() => onEliminar(t)}>Eliminar</button>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--gh-fg-muted)', marginTop: 4 }}><Vence t={t} /></div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </>
  );
}

function resumenPermisos(p: Permisos): string {
  const v = Object.values(p);
  const esc = v.filter((x) => x === 'escritura').length;
  const lec = v.length - esc;
  const partes = [lec ? `${lec} ${lec === 1 ? 'área' : 'áreas'} de lectura` : '', esc ? `${esc} de lectura y escritura` : ''].filter(Boolean);
  return partes.join(' · ');
}

// ── Crear y editar ───────────────────────────────────────────────────────────

const fechaIso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

function vencimientoTexto(op: OpcionExpiracion, fecha: string): string {
  if (op === 'sin') return 'El token no vencerá nunca.';
  if (op === 'personalizada') return fecha ? `El token vencerá el ${fechaLarga(`${fecha}T23:59:59Z`)}.` : 'Elige la fecha.';
  return `El token vencerá el ${fechaLarga(Date.now() + Number(op) * 86_400_000)}.`;
}

function FormToken({ modo, token, indice, workspace, onListo, onCancelar }: {
  modo: 'nuevo' | 'editar';
  token?: TokenPublico;
  indice: AreaDocs[];
  workspace: string;
  onListo: (r: { token: string; publico: TokenPublico }) => void;
  onCancelar: () => void;
}) {
  const [nombre, setNombre] = useState(token?.nombre ?? '');
  const [descripcion, setDescripcion] = useState(token?.descripcion ?? '');
  const [expiracion, setExpiracion] = useState<OpcionExpiracion>(EXPIRACION_POR_DEFECTO);
  const [fecha, setFecha] = useState('');
  const [permisos, setPermisos] = useState<Permisos>(token?.permisos ?? {});
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const elegidos = Object.entries(permisos).filter(([, n]) => n) as [string, 'lectura' | 'escritura'][];
  const titulo = (a: string) => indice.find((x) => x.area === a)?.titulo ?? a;

  const enviar = async (ev: FormEvent) => {
    ev.preventDefault();
    setError(null);
    if (!nombre.trim()) { setError('Ponle un nombre al token.'); return; }
    if (!elegidos.length) { setError('Elige al menos un permiso.'); return; }
    setEnviando(true);
    try {
      if (modo === 'nuevo') {
        const r = await crearTokenApi({ nombre, descripcion, permisos: permisos as Record<string, string>, expiracion, fecha });
        if ('error' in r) { setError(r.error); return; }
        onListo(r);
      } else if (token) {
        const r = await editarTokenApi(token.id, { nombre, descripcion, permisos: permisos as Record<string, string> });
        if ('error' in r) { setError(r.error); return; }
        onListo({ token: '', publico: r.publico });
      }
    } catch {
      setError('No se pudo guardar. Prueba de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  const hoy = Date.now();
  return (
    <form onSubmit={(e) => void enviar(e)}>
      <div className="gh-subhead">
        <h2 className="gh-subhead-heading">{modo === 'nuevo' ? 'Nuevo token de acceso personal detallado' : `Editar «${token?.nombre}»`}</h2>
        <p className="gh-subhead-description" style={{ margin: 0 }}>
          {modo === 'nuevo'
            ? 'Crea un token con permisos por área, para una integración o para tus propios scripts.'
            : 'Cambia el nombre, la descripción o los permisos. Para cambiar el vencimiento, regenera el token.'}
        </p>
      </div>
      {error && <div className="gh-flash gh-flash--error" role="alert">{error}</div>}

      <div className="gh-form-group">
        <label htmlFor="tk-nombre">Nombre del token <span className="gh-requerido">*</span></label>
        <input id="tk-nombre" className="gh-form-control" value={nombre} maxLength={MAX_NOMBRE} onChange={(e) => setNombre(e.target.value)} autoFocus={modo === 'nuevo'} />
        <p className="gh-note">Un nombre único para este token: quién lo usa (n8n, Zapier, mi script).</p>
      </div>

      {modo === 'nuevo' && (
        <div className="gh-form-group">
          <label htmlFor="tk-vence">Vencimiento <span className="gh-requerido">*</span></label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <select id="tk-vence" className="gh-form-control" style={{ width: 200 }} value={expiracion} onChange={(e) => setExpiracion(e.target.value as OpcionExpiracion)}>
              {OPCIONES_EXPIRACION.map((o) => <option key={o} value={o}>{TEXTO_EXPIRACION[o]}</option>)}
            </select>
            {expiracion === 'personalizada' && (
              <input type="date" className="gh-form-control" style={{ width: 180 }} aria-label="Fecha de vencimiento" value={fecha}
                min={fechaIso(hoy + 86_400_000)} max={fechaIso(hoy + (MAX_DIAS_EXPIRACION - 1) * 86_400_000)} onChange={(e) => setFecha(e.target.value)} />
            )}
          </div>
          <p className="gh-note" style={expiracion === 'sin' ? { color: 'var(--gh-fg-attention)' } : undefined}>
            {expiracion === 'sin' && <Icono n="alert" />} {vencimientoTexto(expiracion, fecha)}{expiracion === 'sin' ? ' Te recomendamos ponerle vencimiento: si se filtra, deja de servir solo.' : ''}
          </p>
        </div>
      )}

      <div className="gh-form-group">
        <label htmlFor="tk-desc">Descripción</label>
        <textarea id="tk-desc" className="gh-form-control" style={{ maxWidth: 640 }} maxLength={MAX_DESCRIPCION} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
      </div>

      <div className="gh-form-group">
        <span className="gh-form-label">Propietario del recurso</span>
        <select className="gh-form-control" style={{ width: 280 }} disabled value="ws" aria-label="Propietario del recurso">
          <option value="ws">{workspace}</option>
        </select>
        <p className="gh-note">Un token es de un solo workspace: el que estás mirando.</p>
      </div>

      <h3 style={{ fontSize: 20, fontWeight: 400, margin: '32px 0 4px' }}>Permisos</h3>
      <p style={{ color: 'var(--gh-fg-muted)', marginBottom: 12 }}>
        Lee la <Link href="/api-mako?tab=docs&art=permisos">documentación de permisos</Link> para saber qué endpoints habilita cada uno.
      </p>
      <div className="gh-box">
        <div className="gh-box-header" style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="gh-box-title">Permisos por área</span>
          <span style={{ fontSize: 12, color: 'var(--gh-fg-muted)' }}>{elegidos.length} de {indice.length} con acceso</span>
        </div>
        <ul style={{ margin: 0, padding: 0 }}>
          {indice.map((a) => {
            const lec = a.recursos.reduce((n, r) => n + r.endpoints.filter((e) => e.nivel === 'lectura').length, 0);
            const esc = a.recursos.reduce((n, r) => n + r.endpoints.filter((e) => e.nivel === 'escritura').length, 0);
            const valor: NivelPermiso = permisos[a.area] ?? 'ninguno';
            return (
              <li key={a.area} className="gh-box-row" style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', padding: '12px 16px' }}>
                <div style={{ flex: '1 1 260px', minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{a.titulo}</div>
                  <div style={{ fontSize: 12, color: 'var(--gh-fg-muted)' }}>
                    {lec} {lec === 1 ? 'endpoint' : 'endpoints'} de lectura{esc ? ` · ${esc} de escritura` : ''}
                  </div>
                </div>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--gh-fg-muted)' }}>
                  Acceso:
                  <select className="gh-form-control" style={{ width: 190, height: 28, fontSize: 12 }} value={valor} aria-label={`Acceso a ${a.titulo}`}
                    onChange={(e) => {
                      const n = e.target.value as NivelPermiso;
                      setPermisos((p) => {
                        const x = { ...p };
                        if (n === 'ninguno') delete x[a.area]; else x[a.area] = n;
                        return x;
                      });
                    }}>
                    <option value="ninguno">{TEXTO_NIVEL.ninguno}</option>
                    <option value="lectura">{TEXTO_NIVEL.lectura}</option>
                    {esc > 0 && <option value="escritura">{TEXTO_NIVEL.escritura}</option>}
                  </select>
                </label>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="gh-box" style={{ marginTop: 24 }}>
        <div className="gh-box-header" style={{ padding: '12px 16px' }}><span className="gh-box-title">Resumen</span></div>
        <div style={{ padding: 16 }}>
          {elegidos.length ? (
            <>
              <p style={{ marginBottom: 8 }}><strong>{elegidos.length} {elegidos.length === 1 ? 'permiso' : 'permisos'}</strong> sobre «{workspace}»:</p>
              <ul style={{ margin: 0, paddingLeft: '1.5em' }}>
                {elegidos.map(([a, n]) => <li key={a}>{TEXTO_PERMISO[n]} en «{titulo(a)}»</li>)}
              </ul>
            </>
          ) : <p style={{ margin: 0, color: 'var(--gh-fg-muted)' }}>Todavía no elegiste permisos.</p>}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
        <button type="submit" className="gh-btn gh-btn--primary" disabled={enviando}>{enviando ? 'Guardando…' : modo === 'nuevo' ? 'Generar token' : 'Guardar cambios'}</button>
        <button type="button" className="gh-btn" onClick={onCancelar}>Cancelar</button>
      </div>
    </form>
  );
}

// ── La página de un token ────────────────────────────────────────────────────

function Detalle({ t, indice, workspace, onEliminar }: { t: TokenPublico; indice: AreaDocs[]; workspace: string; onEliminar: () => void }) {
  const titulo = (a: string) => indice.find((x) => x.area === a)?.titulo ?? a;
  const permisos = Object.entries(t.permisos) as [string, 'lectura' | 'escritura'][];
  return (
    <>
      <div className="gh-subhead">
        <h2 className="gh-subhead-heading">{t.nombre}</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link className="gh-btn" href={hrefToken(t.id, 'editar')}>Editar</Link>
          <Link className="gh-btn" href={hrefToken(t.id, 'regenerar')}>Regenerar token</Link>
        </div>
      </div>
      {t.vencido && <div className="gh-flash gh-flash--warn" role="status">Este token venció. Regenéralo para volver a usarlo con los mismos permisos.</div>}
      <dl style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '8px 24px', margin: '0 0 24px' }}>
        <dt style={{ color: 'var(--gh-fg-muted)' }}>Creado</dt><dd style={{ margin: 0 }}>{fechaLarga(t.creado)}{t.creadoPor ? ` por ${t.creadoPor}` : ''}</dd>
        {t.regenerado && <><dt style={{ color: 'var(--gh-fg-muted)' }}>Regenerado</dt><dd style={{ margin: 0 }}>{fechaLarga(t.regenerado)}</dd></>}
        <dt style={{ color: 'var(--gh-fg-muted)' }}>Vencimiento</dt><dd style={{ margin: 0 }}><Vence t={t} /></dd>
        <dt style={{ color: 'var(--gh-fg-muted)' }}>Último uso</dt><dd style={{ margin: 0 }}>{ultimoUso(t.ultimoUso)} · <Link href={`/api-mako?tab=registro&token=${encodeURIComponent(t.id)}`}>Ver en el registro</Link></dd>
        <dt style={{ color: 'var(--gh-fg-muted)' }}>Token</dt><dd style={{ margin: 0 }}><code>{t.pista}</code></dd>
        <dt style={{ color: 'var(--gh-fg-muted)' }}>Propietario</dt><dd style={{ margin: 0 }}>{workspace}</dd>
      </dl>
      {t.descripcion && <p style={{ whiteSpace: 'pre-line' }}>{t.descripcion}</p>}

      <div className="gh-box" style={{ marginBottom: 24 }}>
        <div className="gh-box-header" style={{ padding: '12px 16px' }}><span className="gh-box-title">Permisos</span></div>
        <ul style={{ margin: 0, padding: 0 }}>
          {permisos.map(([a, n]) => (
            <li key={a} className="gh-box-row" style={{ padding: '10px 16px', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <span>{titulo(a)}</span>
              <span className={`gh-label ${n === 'escritura' ? 'gh-label--attention' : 'gh-label--accent'}`}>{TEXTO_PERMISO[n]}</span>
            </li>
          ))}
        </ul>
      </div>

      <h3 style={{ fontSize: 20, fontWeight: 400, margin: '32px 0 8px', color: 'var(--gh-fg-danger)' }}>Zona de peligro</h3>
      <div className="gh-box" style={{ borderColor: 'var(--gh-fg-danger)' }}>
        <div className="gh-box-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <strong>Eliminar este token</strong>
            <div style={{ fontSize: 12, color: 'var(--gh-fg-muted)' }}>Todo lo que lo use deja de funcionar en el acto.</div>
          </div>
          <button type="button" className="gh-btn gh-btn--danger" onClick={onEliminar}>Eliminar</button>
        </div>
      </div>
    </>
  );
}

function Regenerar({ t, onListo, onCancelar }: { t: TokenPublico; onListo: (r: { token: string; publico: TokenPublico }) => void; onCancelar: () => void }) {
  const [expiracion, setExpiracion] = useState<OpcionExpiracion>(EXPIRACION_POR_DEFECTO);
  const [fecha, setFecha] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hoy = useMemo(() => Date.now(), []);
  const enviar = async (ev: FormEvent) => {
    ev.preventDefault();
    setEnviando(true); setError(null);
    try {
      const r = await regenerarTokenApi(t.id, { expiracion, fecha });
      if ('error' in r) { setError(r.error); return; }
      onListo(r);
    } catch { setError('No se pudo regenerar. Prueba de nuevo.'); }
    finally { setEnviando(false); }
  };
  return (
    <form onSubmit={(e) => void enviar(e)}>
      <div className="gh-subhead">
        <h2 className="gh-subhead-heading">Regenerar «{t.nombre}»</h2>
      </div>
      <div className="gh-flash gh-flash--warn" role="note">
        Si regeneras este token, todo lo que use el valor actual deja de funcionar en el acto. Tendrás que poner el valor nuevo en esas integraciones.
      </div>
      {error && <div className="gh-flash gh-flash--error" role="alert">{error}</div>}
      <div className="gh-form-group">
        <label htmlFor="rg-vence">Vencimiento <span className="gh-requerido">*</span></label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select id="rg-vence" className="gh-form-control" style={{ width: 200 }} value={expiracion} onChange={(e) => setExpiracion(e.target.value as OpcionExpiracion)}>
            {OPCIONES_EXPIRACION.map((o) => <option key={o} value={o}>{TEXTO_EXPIRACION[o]}</option>)}
          </select>
          {expiracion === 'personalizada' && (
            <input type="date" className="gh-form-control" style={{ width: 180 }} aria-label="Fecha de vencimiento" value={fecha}
              min={fechaIso(hoy + 86_400_000)} max={fechaIso(hoy + (MAX_DIAS_EXPIRACION - 1) * 86_400_000)} onChange={(e) => setFecha(e.target.value)} />
          )}
        </div>
        <p className="gh-note">{vencimientoTexto(expiracion, fecha)}</p>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" className="gh-btn gh-btn--primary" disabled={enviando}>{enviando ? 'Regenerando…' : 'Regenerar token'}</button>
        <button type="button" className="gh-btn" onClick={onCancelar}>Cancelar</button>
      </div>
    </form>
  );
}

// ── El clásico (la skill de Claude) ──────────────────────────────────────────

function Clasicos({ tokens, onEliminar }: { tokens: TokensDelWorkspace; onEliminar: () => void }) {
  const p = tokens.principal;
  return (
    <>
      <div className="gh-subhead">
        <h2 className="gh-subhead-heading">Tokens de acceso personal (clásicos)</h2>
        <Link className="gh-btn" href="/integraciones?abrir=agente">Generar nuevo token (clásico)</Link>
        <p className="gh-subhead-description" style={{ margin: 0 }}>
          El token clásico es el de la skill de Claude: un alcance para todo y nunca escribe directo (deja pendientes y propuestas). Se genera en Integraciones → Claude.
        </p>
      </div>
      {!p ? (
        <div className="gh-box gh-blankslate">
          <Icono n="key" size={24} />
          <h3>No hay token clásico</h3>
          <p>Para conectar Claude, genéralo en Integraciones → Claude. Para cualquier otra integración, usa un token detallado.</p>
        </div>
      ) : (
        <div className="gh-box">
          <div className="gh-box-row">
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 240px', minWidth: 0 }}>
                <strong>Skill de Claude</strong>
                <span style={{ marginLeft: 8 }} className="gh-label gh-label--accent">{TEXTO_ALCANCE[p.alcance].titulo}</span>
              </div>
              <span style={{ color: 'var(--gh-fg-muted)', fontSize: 12 }}>{ultimoUso(p.ultimoUso)}</span>
              <button type="button" className="gh-btn gh-btn--sm gh-btn--danger" onClick={onEliminar}>Eliminar</button>
            </div>
            <div style={{ fontSize: 12, color: 'var(--gh-fg-muted)', marginTop: 4 }}>
              <code>{p.pista}</code> · <span style={{ color: 'var(--gh-fg-attention)' }}><Icono n="alert" /> Este token no vence.</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── El diálogo de confirmación de GitHub ─────────────────────────────────────

function Dialogo({ titulo, confirmar, children, onConfirmar, onCancelar }: {
  titulo: string; confirmar: string; children: ReactNode; onConfirmar: () => Promise<void>; onCancelar: () => void;
}) {
  const [enviando, setEnviando] = useState(false);
  return (
    <div className="gh-dialogo-fondo" onClick={onCancelar}>
      <div className="gh-dialogo" role="alertdialog" aria-modal="true" aria-labelledby="gh-dialogo-titulo" onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => { if (e.key === 'Escape') onCancelar(); }}>
        <div className="gh-dialogo-cab">
          <h2 id="gh-dialogo-titulo">{titulo}</h2>
          <button type="button" className="gh-btn-octicon" aria-label="Cerrar" onClick={onCancelar}><Icono n="x" /></button>
        </div>
        <div className="gh-dialogo-cuerpo">{children}</div>
        <div className="gh-dialogo-pie">
          <button type="button" className="gh-btn" onClick={onCancelar} autoFocus>Cancelar</button>
          <button type="button" className="gh-btn gh-btn--danger" disabled={enviando}
            onClick={() => { setEnviando(true); void onConfirmar().finally(() => setEnviando(false)); }}>{enviando ? 'Eliminando…' : confirmar}</button>
        </div>
      </div>
    </div>
  );
}

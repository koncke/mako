'use client';

// =============================================================================
// MetodoWizard — conexión guiada de integraciones, un servicio por pantalla:
// tutorial paso a paso para conseguir cada token, probar conexión y guardar.
// El catálogo (campos + tutoriales) vive en lib/metodo-catalogo.ts; el estado
// real (configurado / origen / máscara) sale de GET /api/metodo.
// =============================================================================

import { useEffect, useState } from 'react';
import type { ServicioMetodo } from '@/lib/metodo-catalogo';
import { CuerpoGrupo, FilaAjustes, GrupoAjustes, PuntoEstado, TituloAjustes } from '@/app/_ui/Ajustes';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';

type OrigenCampo = 'servidor' | 'panel' | null;
type CampoEstado = { env: string; configurado: boolean; origen: OrigenCampo; mask: string; ilegible: boolean };
type ServicioEstado = { key: string; conectada: boolean; campos: CampoEstado[] };

/**
 * ⚠️ EL CATALOGO LLEGA POR PROPS, no se importa acá.
 *
 * Este archivo es `'use client'` y hacía `import { SERVICIOS_METODO }`: eso metía
 * lib/metodo-catalogo.ts ENTERO en el bundle del navegador — 145 KB con los
 * tutoriales de las 20 integraciones, los nombres de todas las envs y el copy
 * interno de la agencia, incluida la entrada de GitHub, que es una credencial de
 * plataforma. `import type` no arrastra nada: se borra en compilación.
 *
 * Y hay una segunda razón, que es la que importa de verdad: recibiéndolo por props,
 * la página puede pasarlo YA FILTRADO con `serviciosPara()`. Importado acá, el
 * cliente se llevaba el catálogo completo aunque la pantalla no lo pintara.
 */
export function MetodoWizard({ servicios: SERVICIOS_METODO, embebido = false }: {
  servicios: ServicioMetodo[];
  /** Adentro de «Configuración del negocio» (15/10/2026): el título y el `<main>` los pone el molde. */
  embebido?: boolean;
}) {
  const [estado, setEstado] = useState<Record<string, ServicioEstado>>({});
  const [cargando, setCargando] = useState(true);
  /** El servicio abierto (su detalle), o null: la lista. */
  const [abierto, setAbierto] = useState<string | null>(null);
  // lo tipeado por env var (input vacío sobre una guardada = "no la cambies")
  const [valores, setValores] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [probando, setProbando] = useState(false);
  const [probeMsg, setProbeMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [quitando, setQuitando] = useState<string | null>(null);

  const aplicar = (lista: unknown) => {
    if (!Array.isArray(lista)) return;
    setEstado(Object.fromEntries((lista as ServicioEstado[]).map((s) => [s.key, s])));
  };

  const cargar = () => {
    setErrorCarga(null);
    fetch('/api/metodo')
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) aplicar(j.servicios);
        else setErrorCarga(j.error === 'solo admin' ? 'Necesitas ser admin para configurar las integraciones.' : (j.error ?? 'No se pudo cargar el estado.'));
      })
      .catch(() => setErrorCarga('No se pudo cargar. Revisa tu conexión y prueba de nuevo.'))
      .finally(() => setCargando(false));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { cargar(); }, []);

  const total = SERVICIOS_METODO.length;
  const servicio = SERVICIOS_METODO.find((s) => s.key === abierto) ?? SERVICIOS_METODO[0];
  const est: ServicioEstado | undefined = estado[servicio.key];
  const conectadas = SERVICIOS_METODO.filter((s) => estado[s.key]?.conectada).length;

  const campoEstado = (env: string): CampoEstado | undefined => est?.campos.find((c) => c.env === env);

  // solo los campos con valor tipeado (así "vacío" nunca pisa una guardada)
  const tipeados = (s: ServicioMetodo): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const c of s.campos) {
      const v = (valores[c.env] ?? '').trim();
      if (v) out[c.env] = v;
    }
    return out;
  };
  const hayTipeado = Object.keys(tipeados(servicio)).length > 0;

  const flash = () => { setSaved(true); setTimeout(() => setSaved(false), 1800); };
  const abrir = (key: string | null) => { setProbeMsg(null); setAbierto(key); };

  const probar = async () => {
    setProbando(true); setProbeMsg(null);
    try {
      const j = await fetch('/api/metodo/verificar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ servicio: servicio.key, valores: tipeados(servicio) }),
      }).then((r) => r.json());
      setProbeMsg(j.ok ? { ok: true, text: j.detalle ?? 'Conexión OK.' } : { ok: false, text: j.error ?? 'No se pudo verificar.' });
    } catch (e) { setProbeMsg({ ok: false, text: String(e) }); }
    finally { setProbando(false); }
  };

  const guardar = async () => {
    const vals = tipeados(servicio);
    if (!Object.keys(vals).length) return;
    setGuardando(true);
    try {
      const j = await fetch('/api/metodo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'guardar', servicio: servicio.key, valores: vals }),
      }).then((r) => r.json());
      if (j.ok) {
        aplicar(j.servicios);
        setValores((v) => { const nv = { ...v }; for (const env of Object.keys(vals)) delete nv[env]; return nv; });
        setProbeMsg(null);
        flash();
      } else {
        setProbeMsg({ ok: false, text: j.error ?? 'No se pudo guardar.' });
      }
    } catch (e) { setProbeMsg({ ok: false, text: String(e) }); }
    finally { setGuardando(false); }
  };

  // Desconecta una credencial guardada desde el panel (borra la fila cifrada).
  const quitar = async (env: string) => {
    setQuitando(env); setProbeMsg(null);
    try {
      const j = await fetch('/api/metodo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'borrar', env }),
      }).then((r) => r.json());
      if (j.ok) { aplicar(j.servicios); setValores((v) => { const nv = { ...v }; delete nv[env]; return nv; }); }
      else setProbeMsg({ ok: false, text: j.error ?? 'No se pudo quitar.' });
    } catch (e) { setProbeMsg({ ok: false, text: String(e) }); }
    finally { setQuitando(null); }
  };

  // Embebido no puede ser otro `<main>`: la página ya tiene uno (el del molde de ajustes).
  // COMO LAS INTEGRACIONES DE LINEAR (25/10/2026, Settings copiada de Linear, docs/settings/referencia.md; Martín: «rediseño
  // completo… Tanto en diseño como en funcionalidad»). Era un asistente de un servicio por pantalla («Paso 3 de 20», Anterior y
  // Siguiente): para cambiar UNA clave había que pasar por las de antes. Ahora la página es la LISTA de servicios agrupados por
  // categoría, cada uno con su estado y su punto; tocar uno abre su detalle (las credenciales en filas, «Probar conexión» y
  // «Guardar», y cómo conseguirlas). Lo que hace cada botón es lo mismo de antes (/api/metodo y /api/metodo/verificar).
  const Raiz = embebido ? 'div' : 'main';
  const marco = embebido ? { minWidth: 0 } : { flex: 1, minWidth: 0, padding: '34px 44px 60px', minHeight: '100vh' };
  const estadoDe = (key: string) => (estado[key]?.conectada
    ? <>Conectada<PuntoEstado tono="good" /></>
    : <>Falta conectar<PuntoEstado tono="off" /></>);

  if (cargando || errorCarga || !abierto) {
    const categorias = [...new Set(SERVICIOS_METODO.map((s) => s.categoria))];
    return (
      <Raiz style={marco}>
        <TituloAjustes titulo="Método" accion={!cargando && !errorCarga && <span className="aj-fila-valor">{conectadas} de {total} conectadas</span>} />
        {cargando ? (
          <GrupoAjustes><FilaAjustes titulo="Cargando…" /></GrupoAjustes>
        ) : errorCarga ? (
          <div className="aj-error" role="alert">
            {errorCarga}
            <button type="button" className="aj-boton" data-variante="texto" onClick={() => { setCargando(true); cargar(); }}>Reintentar</button>
            <ReportarASoporte />
          </div>
        ) : categorias.map((cat) => (
          <GrupoAjustes key={cat} titulo={cat}>
            {SERVICIOS_METODO.filter((s) => s.categoria === cat).map((s) => (
              <FilaAjustes key={s.key} titulo={s.nombre} valor={estadoDe(s.key)} onClick={() => abrir(s.key)} />
            ))}
          </GrupoAjustes>
        ))}
      </Raiz>
    );
  }

  // ── El detalle de un servicio ─────────────────────────────────────────────
  return (
    <Raiz style={marco}>
      <header className="aj-cabecera">
        <button type="button" className="aj-volver" onClick={() => abrir(null)}><span aria-hidden>←</span> Método</button>
        <div className="aj-cabecera__fila">
          <h1 className="aj-titulo">{servicio.nombre}</h1>
          <div className="aj-cabecera__accion"><span className="aj-fila-valor">{estadoDe(servicio.key)}</span></div>
        </div>
      </header>

      {/* Credenciales: los `soloServidor` muestran sólo el estado y cómo conseguirlas (se cargan en el servidor). */}
      {!servicio.soloServidor && (
        <GrupoAjustes titulo="Credenciales" descripcion="Se guardan cifradas en tu cuenta"
          pie={(
            <div className="aj-acciones" style={{ marginTop: 0, justifyContent: 'flex-end' }}>
              {saved && <span role="status" style={{ fontSize: 13, color: 'var(--good)', fontWeight: 600, marginRight: 'auto' }}>Guardado</span>}
              {probeMsg && !probeMsg.ok && <span role="alert" style={{ fontSize: 13, color: 'var(--bad)', marginRight: 'auto' }}>{probeMsg.text}<ReportarASoporte /></span>}
              {probeMsg && probeMsg.ok && <span role="status" style={{ fontSize: 13, color: 'var(--good)', fontWeight: 600, marginRight: 'auto' }}>{probeMsg.text}</span>}
              <button type="button" className="aj-boton" data-variante="borde" disabled={probando} onClick={probar}>{probando ? 'Probando…' : 'Probar conexión'}</button>
              <button type="button" className="aj-boton" disabled={!hayTipeado || guardando} onClick={guardar}>{guardando ? 'Guardando…' : 'Guardar'}</button>
            </div>
          )}>
          {servicio.campos.map((c) => {
            const ce = campoEstado(c.env);
            // Todo campo es editable: la base manda sobre el entorno del server. `origen` sólo dice si hay fila que se pueda quitar.
            const guardada = !!ce?.configurado;
            const enBase = ce?.origen === 'panel' || !!ce?.ilegible;
            const placeholder = guardada ? `••••${ce?.mask ?? ''}` : c.placeholder;
            return (
              <div key={c.env} className="aj-fila" data-quieta="true" data-campo="true">
                <span className="aj-fila-texto">
                  <span className="aj-fila-titulo">{c.label}{c.opcional && <span style={{ fontWeight: 400, color: 'var(--faint)' }}> · opcional</span>}</span>
                  {ce?.ilegible
                    ? <span className="aj-fila-detalle" style={{ color: 'var(--warn)' }}>Guardada con una clave vieja: vuelve a pegarla</span>
                    : c.nota ? <span className="aj-fila-detalle">{c.nota}</span> : guardada ? <span className="aj-fila-detalle">Guardada</span> : null}
                </span>
                <span className="aj-fila-fin">
                  {enBase && (
                    <button type="button" className="aj-boton" data-variante="texto" style={{ color: 'var(--bad)' }} onClick={() => quitar(c.env)} disabled={quitando === c.env}>
                      {quitando === c.env ? 'Quitando…' : 'Quitar'}
                    </button>
                  )}
                  <input className="aj-en-linea" type={c.secreto ? 'password' : 'text'} value={valores[c.env] ?? ''} placeholder={placeholder}
                    autoComplete="off" aria-label={c.label}
                    onChange={(e) => setValores((v) => ({ ...v, [c.env]: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === 'Enter' && hayTipeado) void guardar(); }} />
                </span>
              </div>
            );
          })}
        </GrupoAjustes>
      )}

      <GrupoAjustes titulo="Cómo conseguirlas">
        <CuerpoGrupo>
          <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14, color: 'var(--ink)', lineHeight: 1.55 }}>
            {servicio.tutorial.pasos.map((p, i) => <li key={i}>{p}</li>)}
          </ol>
          {servicio.tutorial.url && (
            <a href={servicio.tutorial.url} target="_blank" rel="noreferrer" className="aj-boton" data-variante="texto" style={{ marginTop: 10, marginLeft: -10, color: 'var(--primary)' }}>
              {servicio.tutorial.urlLabel ?? servicio.tutorial.url} ↗
            </a>
          )}
        </CuerpoGrupo>
      </GrupoAjustes>
    </Raiz>
  );
}

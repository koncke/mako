'use client';

// =============================================================================
// ServicioConfigForm — BYOK embebido en los modales de /integraciones
// =============================================================================
// TODA la lista de credenciales del servicio junta (no wizard de a un paso), y
// cada key se basta a sí misma: UNA barra por campo, del mismo alto siempre, con
// el semáforo, el valor y sus acciones como íconos ADENTRO. No hay botones
// globales de "Guardar"/"Probar" — se guarda y se prueba key por key, y el
// resultado sale abajo de ESA key, no al final del modal.
//
// Sin lápiz de "reconfigurar": una credencial guardada se cambia BORRÁNDOLA
// (con confirmación), y ahí el campo vuelve a estar en blanco. Es un camino
// menos y hace imposible pisar una key sin querer.
//
// Reusa la infra de /metodo:
//   · GET  /api/integraciones/credencial?servicio=<key>  → catálogo + estado
//   · POST { action:'guardar'|'borrar'|'verificar'|'revelar', ... }
// El estado por campo (configurado / máscara / ilegible) manda el semáforo y qué
// íconos aparecen. Solo se envían los campos TIPEADOS: "vacío" nunca pisa nada.
// OJO: no existe el concepto "configurada en el servidor" — TODO campo es editable.

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Icon } from '../_components/icons';
import { ConfirmDialog } from '../components/ConfirmDialog';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

// El "ojito" muestra el secreto un rato corto y lo vuelve a tapar solo: que una
// credencial no quede a la vista en una pantalla compartida o grabada. Además se
// tapa sola si te vas de la pestaña — no hace falta que el reloj llegue al final.
const OCULTAR_MS = 8_000;

type OrigenCampo = 'servidor' | 'panel' | null;
type Tutorial = { pasos: string[]; url?: string; urlLabel?: string };
type Campo = {
  env: string;
  label: string;
  placeholder: string | null;
  secreto: boolean;
  opcional: boolean;
  nota: string | null;
  host: boolean;
  configurado: boolean;
  origen: OrigenCampo;
  mask: string;
  ilegible: boolean;
  /** Cómo se consigue ESTA credencial. Si falta, cae al tutorial del servicio. */
  ayuda: Tutorial | null;
};
type Servicio = {
  key: string;
  nombre: string;
  categoria: string;
  paraQue: string;
  soloServidor: boolean;
  tutorial: Tutorial;
  campos: Campo[];
};
type Msg = { ok: boolean; text: string };

const caja: CSSProperties = { background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12 };

// Solo los campos con valor tipeado: un input vacío sobre una guardada significa
// "no la toques", nunca "borrala".
function tipeados(campos: Campo[], valores: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of campos) {
    const v = (valores[c.env] ?? '').trim();
    if (v) out[c.env] = v;
  }
  return out;
}

function calcConectada(campos: Campo[]): boolean {
  const requeridos = campos.filter((c) => !c.opcional);
  return requeridos.length ? requeridos.every((c) => c.configurado) : campos.some((c) => c.configurado);
}

/**
 * Una credencial está "cerrada" (máscara + ojito + tacho) solo si vive en la
 * base. Si viniera del entorno del server —la ventana entre un deploy y la
 * migración del boot— no hay fila que borrar: se muestra ABIERTA para poder
 * pisarla. Sin esto quedaría sin tacho y sin lápiz, o sea imposible de cambiar.
 */
function estaCerrada(c: Campo): boolean {
  return c.configurado && !c.ilegible && c.origen === 'panel';
}

// Semáforo + placeholder de cada fila. La barra NO cambia de tamaño entre
// estados: lo único que cambia es el color del punto y el texto de adentro.
function semaforo(c: Campo, tipeado: boolean): { color: string; texto: string; placeholder: string } {
  if (tipeado) return { color: 'var(--primary)', texto: 'sin guardar', placeholder: '' };
  if (c.ilegible) return { color: 'var(--bad)', texto: 'ilegible', placeholder: 'Volvé a pegarla' };
  if (c.configurado) return { color: 'var(--good)', texto: 'guardada', placeholder: `••••${c.mask}` };
  if (c.opcional) return { color: 'var(--faint)', texto: 'opcional', placeholder: 'Opcional' };
  return { color: 'var(--warn-fill)', texto: 'pendiente', placeholder: 'Pendiente' };
}

// Acción de fila: ícono + tooltip. Sin texto — el `title` explica qué hace.
function IconBtn({ name, title, onClick, disabled, tone = 'dim' }: {
  name: string; title: string; onClick: () => void; disabled?: boolean; tone?: 'dim' | 'bad' | 'primary' | 'good';
}) {
  const color = tone === 'bad' ? 'var(--bad)' : tone === 'primary' ? 'var(--primary)' : tone === 'good' ? 'var(--good)' : 'var(--dim)';
  return (
    <button type="button" title={title} aria-label={title} onClick={onClick} disabled={disabled}
      style={{
        flex: 'none', width: 34, height: 34, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color,
        cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.4 : 1, padding: 0,
      }}>
      <Icon name={name} size={15} />
    </button>
  );
}

// "¿Cómo consigo ESTA key?" — se despliega bajo su propia fila. Va en azul suave
// para que no se confunda ni con la barra gris de la key ni con el aviso de
// seguridad de arriba.
function PasosAyuda({ ayuda }: { ayuda: Tutorial }) {
  return (
    <div style={{ marginTop: 8, padding: '12px 14px', borderRadius: 11, background: 'var(--primary-bg)', border: '1px solid var(--primary-weak)', animation: 'mkFade .18s ease' }}>
      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
        {ayuda.pasos.map((p, i) => (
          <li key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
            <span style={{ flex: 'none', width: 19, height: 19, borderRadius: 999, background: 'var(--surface)', border: '1px solid var(--primary-weak)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: MONO, fontSize: 10, color: 'var(--primary-strong)' }}>{i + 1}</span>
            <span style={{ fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.5 }}>{p}</span>
          </li>
        ))}
      </ol>
      {ayuda.url && (
        <a href={ayuda.url} target="_blank" rel="noreferrer"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10, fontSize: 12.5, fontWeight: 600, color: 'var(--primary-strong)', textDecoration: 'none' }}>
          {ayuda.urlLabel ?? 'Abrir'} ↗
        </a>
      )}
    </div>
  );
}

// Por qué esto es seguro, sin marketing: cada línea es algo que el código hace
// de verdad. Ojo al mantenerlo — si cambia lib/credenciales.ts o el guard de
// /api/integraciones/credencial, este texto pasa a ser mentira.
//
// Va ARRIBA de todo y a propósito NO usa la caja gris de las filas de key: es un
// encabezado (candado + línea + link), no un campo más para completar.
function AvisoSeguridad({ abierto, onToggle }: { abierto: boolean; onToggle: () => void }) {
  const b: CSSProperties = { color: 'var(--ink)', fontWeight: 600 };
  return (
    <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: abierto ? 15 : 0 }}>
      <button type="button" onClick={onToggle} aria-expanded={abierto}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '0 0 13px', background: 'none', border: 0, cursor: 'pointer', textAlign: 'left', fontFamily: SANS }}>
        <span aria-hidden style={{ flex: 'none', width: 27, height: 27, borderRadius: 999, background: 'var(--good-bg)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5, lineHeight: 1 }}>🔒</span>
        <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>Tus llaves son seguras.</span>
        <span style={{ flex: 'none', fontSize: 12.5, fontWeight: 600, color: 'var(--primary)' }}>{abierto ? 'Ocultar' : 'Cómo las guardamos'}</span>
      </button>
      {abierto && (
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <li style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.55 }}>
          <span style={b}>Los secretos se cifran antes de tocar la base.</span> AES-256-GCM, con un nonce distinto
          en cada escritura y un tag de autenticación: se guarda el criptograma, no el token. Si alguien tocara esa
          fila, el descifrado falla en vez de devolver algo alterado.
        </li>
        <li style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.55 }}>
          <span style={b}>Los identificadores, no.</span> El ID de tu página, tu cuenta de Chatwoot o tus event
          types de Calendly quedan legibles a propósito: son con lo que reconocemos de quién es cada webhook que
          entra. No abren nada por sí solos.
        </li>
        <li style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.55 }}>
          <span style={b}>La llave que descifra no vive en la base.</span> Está en el entorno del servidor, así que
          una copia de la base, sola, no alcanza para leer tus secretos.
        </li>
        <li style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.55 }}>
          <span style={b}>Se descifran solo en el servidor.</span> Esta pantalla recibe únicamente los últimos 4
          caracteres. El valor completo no viaja al abrir: hay que pedirlo con el ojito, es una llamada aparte y
          se vuelve a tapar a los 30 segundos.
        </li>
        <li style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.55 }}>
          <span style={b}>Solo vos las ves.</span> El ojito se lo habilitamos únicamente al admin de este espacio:
          un closer, un setter o alguien de otro espacio reciben un 403, y el soporte de MaKo tampoco puede
          destaparlas desde el panel. Cada vez que se mira una llave queda registrado.
        </li>
        <li style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.55 }}>
          <span style={b}>Son tuyas.</span> Cada espacio de trabajo tiene su propia fila, y las borrás cuando
          quieras desde acá.
        </li>
      </ul>
      )}
    </div>
  );
}

export default function ServicioConfigForm({ servicioKey, onEstado }: {
  servicioKey: string;
  onEstado?: (conectada: boolean) => void;
}) {
  const [servicio, setServicio] = useState<Servicio | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState<string | null>(null);
  const [probando, setProbando] = useState<string | null>(null);
  const [quitando, setQuitando] = useState<string | null>(null);
  // Mensajes POR KEY: el resultado sale abajo de la fila que lo pidió.
  const [msg, setMsg] = useState<Record<string, Msg>>({});
  const [segAbierto, setSegAbierto] = useState(false);
  const [ayudaAbierta, setAyudaAbierta] = useState<Record<string, boolean>>({});
  // Texto plano de las credenciales que el admin pidió ver. Nunca viene en la
  // carga del modal: se pide de a una (action 'revelar') y queda auditado.
  const [revelado, setRevelado] = useState<Record<string, string>>({});
  const [revelando, setRevelando] = useState<string | null>(null);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  // Borrar es irreversible → confirmación. Guarda el campo a borrar.
  const [aBorrar, setABorrar] = useState<Campo | null>(null);
  // Lo último que sabe el de afuera. Solo se le avisa si CAMBIA: si avisáramos
  // en cada carga, abrir el modal dispararía un refresh del board al pedo.
  const conectadaRef = useRef<boolean | null>(null);
  // Dos guardados en vuelo devuelven cada uno su foto del servicio, y la lenta
  // puede llegar última con datos viejos y "despintar" la key que ya guardaste.
  // Cada mutación se numera y solo se aplica la foto más nueva.
  const seq = useRef(0);
  const ultimaAplicada = useRef(0);

  const aplicar = (s: Servicio, n?: number) => {
    if (n !== undefined) {
      if (n < ultimaAplicada.current) return; // llegó tarde: ya hay algo más nuevo
      ultimaAplicada.current = n;
    }
    setServicio(s);
    const c = calcConectada(s.campos);
    if (conectadaRef.current !== null && c !== conectadaRef.current) onEstado?.(c);
    conectadaRef.current = c;
  };

  const cargar = () => {
    // Entra en la misma numeración que los guardados: la recarga de después de
    // borrar no puede pisar a un guardado más nuevo, ni al revés.
    const n = ++seq.current;
    setErrorCarga(null);
    fetch(`/api/integraciones/credencial?servicio=${encodeURIComponent(servicioKey)}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.ok && j.servicio) aplicar(j.servicio as Servicio, n);
        else setErrorCarga(j.error === 'solo admin' ? 'Necesitás ser admin para configurar esta integración.' : (j.error ?? 'No se pudo cargar el estado.'));
      })
      .catch(() => setErrorCarga('No se pudo cargar. Revisá tu conexión y probá de nuevo.'))
      .finally(() => setCargando(false));
  };

  // Al cambiar de servicio (o cerrar el modal) no quedan timers vivos ni se
  // arrastra a la vista el secreto que se reveló en el anterior.
  useEffect(() => {
    cargar();
    const t = timers.current;
    return () => {
      for (const env of Object.keys(t)) { clearTimeout(t[env]); delete t[env]; }
      setRevelado({});
      setMsg({});
    };
    // `cargar` se re-crea en cada render: incluirla recargaría en loop. El
    // servicio es lo único que debe disparar la recarga.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [servicioKey]);

  // Escape con el confirm abierto: cancela SOLO el confirm. Va en captura y
  // frena la propagación porque /integraciones tiene un listener global de
  // Escape que si no cerraría el modal entero por debajo del diálogo.
  useEffect(() => {
    if (!aBorrar) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setABorrar(null);
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [aBorrar]);

  const ponerMsg = (env: string, m: Msg | null) =>
    setMsg((v) => { const nv = { ...v }; if (m) nv[env] = m; else delete nv[env]; return nv; });

  const ocultar = (env: string) => {
    clearTimeout(timers.current[env]);
    delete timers.current[env];
    setRevelado((r) => { const nr = { ...r }; delete nr[env]; return nr; });
  };

  const taparTodo = () => {
    for (const env of Object.keys(timers.current)) { clearTimeout(timers.current[env]); delete timers.current[env]; }
    setRevelado({});
  };

  // Si te vas de la pestaña o la ventana pierde el foco, se tapa sola sin esperar
  // al reloj: irse a otro lado con un token a la vista es justo lo que queremos
  // evitar. (Salir de /integraciones desmonta el componente → lo limpia el otro
  // efecto.) Solo escucha mientras haya algo revelado.
  const hayRevelado = Object.keys(revelado).length > 0;
  useEffect(() => {
    if (!hayRevelado) return;
    const onVis = () => { if (document.visibilityState === 'hidden') taparTodo(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('blur', taparTodo);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('blur', taparTodo);
    };
  }, [hayRevelado]);

  const copiar = async (env: string, valor: string) => {
    try {
      await navigator.clipboard.writeText(valor);
      ponerMsg(env, { ok: true, text: 'Copiada al portapapeles.' });
    } catch {
      ponerMsg(env, { ok: false, text: 'El navegador no dejó copiar — seleccionala a mano.' });
    }
  };

  const revelar = async (env: string) => {
    setRevelando(env); ponerMsg(env, null);
    try {
      const j = await fetch('/api/integraciones/credencial', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revelar', env }),
      }).then((r) => r.json());
      if (j.ok && typeof j.valor === 'string') {
        setRevelado((r) => ({ ...r, [env]: j.valor as string }));
        timers.current[env] = setTimeout(() => ocultar(env), OCULTAR_MS);
      } else ponerMsg(env, { ok: false, text: j.error ?? 'No se pudo mostrar la credencial.' });
    } catch { ponerMsg(env, { ok: false, text: 'No se pudo mostrar la credencial. Probá de nuevo.' }); }
    finally { setRevelando(null); }
  };

  // Probar es del SERVICIO (el ping necesita todos los campos), pero el
  // resultado se muestra en la fila desde la que lo pediste.
  const probar = async (env: string) => {
    if (!servicio) return;
    setProbando(env); ponerMsg(env, null);
    try {
      const enviados: Record<string, string> = {};
      for (const c of servicio.campos) {
        const v = (valores[c.env] ?? '').trim();
        if (v) enviados[c.env] = v;
      }
      const j = await fetch('/api/integraciones/credencial', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verificar', servicio: servicio.key, valores: enviados }),
      }).then((r) => r.json());
      ponerMsg(env, j.ok ? { ok: true, text: j.detalle ?? 'Conexión OK.' } : { ok: false, text: j.error ?? 'No se pudo verificar.' });
    } catch { ponerMsg(env, { ok: false, text: 'No se pudo verificar. Probá de nuevo.' }); }
    finally { setProbando(null); }
  };

  /**
   * El tilde NO es solo "guardar": primero prueba la credencial contra el
   * proveedor y, si no funciona, NO la guarda. Una key rota no entra: el usuario
   * no tiene que acordarse de apretar otro botón para enterarse.
   *
   * Con una salvedad honesta: el ping es del SERVICIO, no del campo. Si todavía
   * faltan otros campos obligatorios no hay contra qué probar —Meta pide token
   * Y cuenta— así que se guarda igual y se dice qué falta para poder probarla.
   * Sin esto, la primera key de un servicio de varios campos sería imposible de
   * guardar: siempre fallaría por culpa de las que todavía no cargaste.
   */
  const guardarCampo = async (env: string) => {
    if (!servicio) return;
    const v = (valores[env] ?? '').trim();
    if (!v) return;
    const n = ++seq.current;
    setGuardando(env); ponerMsg(env, null);
    try {
      const enviados = tipeados(servicio.campos, valores);
      const faltan = servicio.campos.filter((c) => !c.opcional && !c.configurado && !enviados[c.env]);
      // Espejo del guard anti-SSRF de lib/metodo-verificar.ts: si el host lo trae
      // el request y algún secreto sale de la base, ese ping se rechaza. No es que
      // la key esté mal — no se puede probar todavía.
      const hostTipeado = servicio.campos.some((c) => c.host && enviados[c.env]);
      const secretoGuardado = servicio.campos.some((c) => c.secreto && !enviados[c.env] && c.configurado);
      const motivoSinProbar = faltan.length
        ? `Falta ${faltan.map((c) => c.label).join(', ')} para poder probarla.`
        : (hostTipeado && secretoGuardado ? 'Para probarla con una URL nueva, volvé a pegar también las credenciales secretas.' : null);

      if (!motivoSinProbar) {
        const p = await fetch('/api/integraciones/credencial', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'verificar', servicio: servicio.key, valores: enviados }),
        }).then((r) => r.json());
        // No funciona → no se guarda. Es el punto de que el tilde valide.
        if (!p.ok) { ponerMsg(env, { ok: false, text: `${p.error ?? 'No se pudo validar.'} No la guardé.` }); return; }
      }

      const j = await fetch('/api/integraciones/credencial', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'guardar', servicio: servicio.key, valores: { [env]: v } }),
      }).then((r) => r.json());
      if (j.ok && j.servicio) {
        aplicar(j.servicio as Servicio, n);
        setValores((val) => { const nv = { ...val }; delete nv[env]; return nv; });
        ponerMsg(env, { ok: true, text: motivoSinProbar ? `Guardada. ${motivoSinProbar}` : 'Guardada y probada — funciona.' });
      } else ponerMsg(env, { ok: false, text: j.error ?? 'No se pudo guardar.' });
    } catch { ponerMsg(env, { ok: false, text: 'No se pudo guardar. Probá de nuevo.' }); }
    finally { setGuardando(null); }
  };

  const quitar = async (env: string) => {
    setQuitando(env); ponerMsg(env, null);
    try {
      const j = await fetch('/api/integraciones/credencial', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'borrar', env }),
      }).then((r) => r.json());
      if (j.ok) {
        ocultar(env);
        setValores((v) => { const nv = { ...v }; delete nv[env]; return nv; });
        cargar();
      } else ponerMsg(env, { ok: false, text: j.error ?? 'No se pudo quitar.' });
    } catch { ponerMsg(env, { ok: false, text: 'No se pudo quitar. Probá de nuevo.' }); }
    finally { setQuitando(null); }
  };

  if (cargando) {
    return <div style={{ fontFamily: MONO, fontSize: 12.5, color: 'var(--faint)', padding: '6px 0' }}>Cargando configuración…</div>;
  }
  if (errorCarga || !servicio) {
    return (
      <div style={{ ...caja, padding: '13px 15px' }}>
        <div style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600, marginBottom: 8 }}>{errorCarga ?? 'No se pudo cargar la configuración.'}</div>
        <button type="button" onClick={() => { setCargando(true); cargar(); }}
          style={{ padding: '9px 15px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Arriba de todo: qué pasa con lo que estás por pegar. */}
      <AvisoSeguridad abierto={segAbierto} onToggle={() => setSegAbierto((o) => !o)} />

      {/* ── La lista COMPLETA de credenciales del servicio, una barra por campo ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {servicio.campos.map((c) => {
          const tipeado = !!(valores[c.env] ?? '').trim();
          const sem = semaforo(c, tipeado);
          const cerrada = estaCerrada(c);
          const verValor = revelado[c.env];
          const m = msg[c.env];
          const ocupada = guardando === c.env || probando === c.env || quitando === c.env || revelando === c.env;
          return (
            <div key={c.env}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 7 }}>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.label}</span>
                <span style={{ flex: 'none', marginLeft: 'auto', fontFamily: MONO, fontSize: 10.5, color: sem.color, whiteSpace: 'nowrap' }}>{sem.texto}</span>
              </div>

              {/* UNA barra: semáforo + valor + acciones, todo adentro */}
              <div className="mk-key-row">
                <span aria-hidden style={{ flex: 'none', width: 7, height: 7, borderRadius: 999, background: sem.color }} />

                {cerrada && !verValor ? (
                  <span style={{ flex: 1, minWidth: 0, fontFamily: MONO, fontSize: 13, color: 'var(--dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    ••••{c.mask}
                  </span>
                ) : verValor ? (
                  // Revelada: NO se edita, se copia. Va como botón y no como input
                  // para que quede claro que no es un campo — y sigue siendo del
                  // mismo alto que el resto de los estados.
                  <button type="button" onClick={() => copiar(c.env, verValor)}
                    title="Clic para copiar" aria-label={`Copiar ${c.label}`}
                    style={{
                      flex: 1, minWidth: 0, alignSelf: 'stretch', border: 0, background: 'transparent',
                      padding: 0, textAlign: 'left', cursor: 'pointer',
                      fontFamily: MONO, fontSize: 13, color: 'var(--ink)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                    {verValor}
                  </button>
                ) : (
                  <input
                    className="mk-key-input"
                    type={c.secreto ? 'password' : 'text'}
                    value={valores[c.env] ?? ''}
                    placeholder={sem.placeholder}
                    autoComplete="off"
                    spellCheck={false}
                    aria-label={c.label}
                    onChange={(e) => setValores((v) => ({ ...v, [c.env]: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === 'Enter' && tipeado) guardarCampo(c.env); }}
                  />
                )}

                {/* Qué botones tiene cada estado:
                    · guardada       → ver · probar · quitar
                    · algo tipeado   → ayuda · guardar (el tilde YA prueba antes
                                       de guardar, así que un "probar" aparte
                                       sobra y confunde)
                    · vacía          → ayuda, y nada más: sin key no hay nada que
                                       guardar ni que probar. */}
                {cerrada ? (
                  <>
                    {verValor
                      ? <IconBtn name="eye-off" title="Ocultar" tone="primary" onClick={() => ocultar(c.env)} />
                      : <IconBtn name="eye" title="Ver la credencial (se oculta sola)" disabled={ocupada} onClick={() => revelar(c.env)} />}
                    <IconBtn name="plug" title={probando === c.env ? 'Probando conexión…' : 'Probar conexión'} disabled={ocupada} onClick={() => probar(c.env)} />
                    <IconBtn name="trash" title="Quitar credencial" tone="bad" disabled={ocupada} onClick={() => setABorrar(c)} />
                  </>
                ) : (
                  <>
                    <IconBtn name="help" title={ayudaAbierta[c.env] ? 'Ocultar la ayuda' : `¿Cómo consigo ${c.label.toLowerCase()}?`}
                      tone={ayudaAbierta[c.env] ? 'primary' : 'dim'}
                      onClick={() => setAyudaAbierta((a) => ({ ...a, [c.env]: !a[c.env] }))} />
                    {tipeado && (
                      <IconBtn name="check" title={guardando === c.env ? 'Probando y guardando…' : 'Probar y guardar esta credencial'} tone="good" disabled={ocupada} onClick={() => guardarCampo(c.env)} />
                    )}
                  </>
                )}
              </div>

              {/* El resultado sale ACÁ, abajo de su propia key. */}
              {m && (
                <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', margin: '7px 0 0', fontSize: 12.5, fontWeight: 500, color: m.ok ? 'var(--good)' : 'var(--bad)', lineHeight: 1.45 }}>
                  <span style={{ flex: 'none' }}>{m.ok ? '✓' : '✗'}</span>
                  <span>{m.text}</span>
                </div>
              )}
              {c.ilegible && <div style={{ fontSize: 12, color: 'var(--warn)', marginTop: 6, lineHeight: 1.45 }}>Guardada pero ilegible (rotó la clave de cifrado) — volvé a pegarla.</div>}

              {/* Ayuda de ESTA key. Reemplaza a la nota suelta que había debajo:
                  cada credencial se consigue en un lado distinto. */}
              {ayudaAbierta[c.env] && <PasosAyuda ayuda={c.ayuda ?? servicio.tutorial} />}
            </div>
          );
        })}
      </div>

      {/* zIndex 310: el modal de /integraciones va en 300 y el confirm tiene que
          quedar ARRIBA (el default de 120 lo dejaría invisible por debajo). */}
      {aBorrar && (
        <ConfirmDialog
          zIndex={310}
          tone="danger"
          title={`¿Quitar ${aBorrar.label}?`}
          message={<>Se borra de tu espacio y <b>{servicio.nombre} deja de funcionar</b> hasta que pegues una nueva. Es la única forma de cambiarla: no se puede pisar sin borrarla antes.</>}
          confirmLabel="Quitar credencial"
          onCancel={() => setABorrar(null)}
          onConfirm={() => { const env = aBorrar.env; setABorrar(null); quitar(env); }}
        />
      )}
    </div>
  );
}

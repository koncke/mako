'use client';

// =============================================================================
// /m/cuenta — quién eres, los avisos de este teléfono, el tema y las salidas
// =============================================================================
// ⚠️ EL PERMISO DE NOTIFICACIONES SE PIDE DENTRO DEL TOQUE, nunca al cargar:
// `activarAvisos()` es la PRIMERA llamada del onClick (lib/push-cliente.ts pide el
// permiso antes de su primer await). iOS lo exige, y un permiso pedido al cargar es
// un veto de la casa.
//
// ⚠️ TODO LO QUE DEPENDE DEL TELÉFONO SE LEE DESPUÉS DE MONTAR (`useEffect`): el
// server no sabe si es un iPhone, si está instalada ni qué permiso hay. Pintarlo en
// el primer render sería un desfase de hidratación — y peor, una fila que cambia de
// opinión al segundo.
//
// ⚠️ «VIENDO A UN CLIENTE» ES LA ÚNICA SALIDA: en /m no hay banner de impersonación
// (el cromo de escritorio está apagado) y la pill del header trae acá. Si esta
// pantalla no la dibuja, no hay salida (AGENTS.md, «si la única salida vive adentro
// de una pantalla condicional, no hay salida»).
// =============================================================================

import { useEffect, useState, useSyncExternalStore } from 'react';
import { Button, ButtonLink } from '@/app/_ui/Button';
import { Switch } from '@/app/_ui/Toggle';
import { useWs } from '@/app/_ui/Link';
import { aplicarModo } from '@/app/_components/InterruptorModo';
import { ATTR_MODO } from '@/lib/temas-candidatos';
import { conWs } from '@/lib/ws-tab';
import { haptico } from '@/lib/haptico';
import { cookieVistaEscritorio } from '@/lib/movil-dispositivo';
import { esIOS, estaInstalada, pedirInstalacion, puedeOfrecerInstalacion, suscribirInstalacion } from '@/lib/movil-instalar';
import { activarAvisos, desactivarAvisos, estadoSuscripcion, probar, type EstadoAvisos } from '@/lib/push-cliente';
import { PUSH_SOLO_ADMINS, PUSH_TIPOS, type NotifPush } from '@/lib/notif-catalogo';
import { FilaM, SeccionM, SalirDeLaVista, CerrarSesion, useToastM, useConexion } from '../_ui';
import { comoDesbloquear, ofertaInstalar, tiposParaRol, toastDePrueba, vistaAvisos } from './cuenta-ui';

export type DatosCuenta = {
  nombre: string;
  email: string;
  rol: string;
  negocio: string | null;
  /** Viendo a un cliente (super admin o agencia): su nombre y por dónde se sale. */
  vista: { cliente: string; salida: string; modoAgencia: boolean } | null;
  push: NotifPush;
  /** false = la sesión no tiene fila propia (no se pueden guardar preferencias). */
  guardable: boolean;
  esAdmin: boolean;
};

export function CuentaM({ datos }: { datos: DatosCuenta }) {
  const ws = useWs();
  const versionCompleta = () => {
    document.cookie = cookieVistaEscritorio();
    window.location.href = conWs('/inicio', ws);
  };

  return (
    <>
      <SeccionM titulo="Tu cuenta">
        <div className="m-lista">
          <FilaM
            titulo={datos.nombre || datos.email}
            // El email va en la segunda línea, entero: en el riel se cortaba a «martinkoncke@gm…».
            segunda={[datos.nombre ? datos.email : null, [datos.rol, datos.negocio].filter(Boolean).join(' en ')].filter(Boolean).join(' · ')}
          />
        </div>
        {datos.vista && (
          <div className="mc-vista">
            <p className="mc-frase">Estás viendo la cuenta de {datos.vista.cliente}.</p>
            <SalirDeLaVista salida={datos.vista.salida} modoAgencia={datos.vista.modoAgencia} variante="secondary" rotulo={`Salir de ${datos.vista.cliente}`} />
          </div>
        )}
      </SeccionM>

      <AvisosTelefono push={datos.push} guardable={datos.guardable} esAdmin={datos.esAdmin} />

      <SeccionM titulo="Apariencia">
        <ModoOscuro />
      </SeccionM>

      <div className="mc-salidas">
        <Button variant="secondary" size="md" full onClick={versionCompleta}>Abrir la versión completa</Button>
        <CerrarSesion />
      </div>
    </>
  );
}

// ── Avisos en este teléfono ──────────────────────────────────────────────────

type Plataforma = { ios: boolean; instalada: boolean };

function AvisosTelefono({ push, guardable, esAdmin }: { push: NotifPush; guardable: boolean; esAdmin: boolean }) {
  const toast = useToastM();
  const { enLinea } = useConexion();
  const [estado, setEstado] = useState<EstadoAvisos | null>(null);
  const [plat, setPlat] = useState<Plataforma | null>(null);
  const [ocupado, setOcupado] = useState<'activar' | 'probar' | 'apagar' | 'instalar' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const puedePedir = useSyncExternalStore(suscribirInstalacion, puedeOfrecerInstalacion, () => false);

  useEffect(() => {
    setPlat({ ios: esIOS(), instalada: estaInstalada() });
    estadoSuscripcion().then(setEstado).catch(() => setEstado('no-soportado'));
  }, []);

  const vista = vistaAvisos(estado);
  const instalar = plat ? ofertaInstalar({ ...plat, puedePedir }) : null;

  // ⚠️ Primera línea del handler: el permiso se pide DENTRO del gesto.
  const activar = () => {
    const pedido = activarAvisos();
    setOcupado('activar');
    setError(null);
    pedido.then((r) => {
      if (r.ok) { haptico('success'); toast('Avisos activados'); setEstado('activo'); return; }
      if (r.estado === 'bloqueado' || r.estado === 'instalar-primero' || r.estado === 'no-soportado' || r.estado === 'apagado') {
        setEstado(r.estado);
        return;
      }
      haptico('error');
      setError(r.estado === 'sin-claves' ? 'Los avisos no están disponibles todavía.'
        : r.estado === 'sin-cuenta' ? 'Esta sesión no tiene cuenta propia.'
        : 'No se pudo activar. Reintenta en un momento.');
    }).catch(() => setError('No se pudo activar. Reintenta en un momento.'))
      .finally(() => setOcupado(null));
  };

  const probarAviso = async () => {
    setOcupado('probar');
    try { toast(toastDePrueba(await probar())); } finally { setOcupado(null); }
  };

  const apagar = async () => {
    setOcupado('apagar');
    try {
      if (await desactivarAvisos()) { toast('Avisos apagados'); setEstado('apagado'); }
      else toast('No se pudo apagar');
    } finally { setOcupado(null); }
  };

  const instalarAndroid = async () => {
    setOcupado('instalar');
    try {
      const r = await pedirInstalacion();
      if (r === 'aceptada') { haptico('success'); toast('MaKo instalada'); }
    } finally { setOcupado(null); }
  };

  return (
    <SeccionM titulo="Avisos en este teléfono">
      {instalar === 'pasos-ios' && (
        <div className="mc-bloque">
          <p className="mc-frase">En iPhone, los avisos llegan con MaKo en tu pantalla de inicio.</p>
          <ButtonLink href="/m/cuenta/instalar" variant="primary" size="lg" full>Instalar MaKo</ButtonLink>
        </div>
      )}
      {instalar === 'boton' && (
        <div className="mc-bloque">
          <Button variant={vista === 'activo' ? 'secondary' : 'primary'} size="md" full
            loading={ocupado === 'instalar'} onClick={instalarAndroid}>
            Instalar MaKo
          </Button>
        </div>
      )}

      {vista === 'cargando' && <p className="mc-frase mc-dim" aria-busy="true">Revisando este teléfono…</p>}

      {vista === 'no-soportado' && instalar == null && (
        <p className="mc-frase">Este navegador no recibe avisos.</p>
      )}

      {vista === 'bloqueado' && (
        <div className="mc-bloque">
          <p className="mc-frase">Los avisos están bloqueados en este teléfono.</p>
          <p className="mc-frase mc-dim">{comoDesbloquear(!!plat?.ios, !!plat?.instalada)}</p>
        </div>
      )}

      {vista === 'activar' && (
        <div className="mc-bloque">
          <p className="mc-frase">Te aviso cuando algo espera tu decisión.</p>
          {error && <p className="mc-error" role="alert">{error}</p>}
          <Button variant="primary" size="lg" full loading={ocupado === 'activar'} disabled={!enLinea} onClick={activar}>
            Activar avisos
          </Button>
          {!enLinea && <p className="mc-frase mc-dim">Sin conexión.</p>}
        </div>
      )}

      {vista === 'activo' && (
        <>
          <Preferencias inicial={push} guardable={guardable} esAdmin={esAdmin} />
          <div className="mc-bloque">
            <Button variant="secondary" size="md" full loading={ocupado === 'probar'} disabled={!enLinea || ocupado != null} onClick={probarAviso}>
              Probar aviso
            </Button>
            <Button variant="tertiary" size="md" full loading={ocupado === 'apagar'} disabled={ocupado != null} onClick={apagar}>
              Apagar avisos en este teléfono
            </Button>
          </div>
        </>
      )}
    </SeccionM>
  );
}

/** Qué avisos le llegan a ESTA persona (en todos sus teléfonos): /api/perfil/notif-push. */
function Preferencias({ inicial, guardable, esAdmin }: { inicial: NotifPush; guardable: boolean; esAdmin: boolean }) {
  const toast = useToastM();
  const [prefs, setPrefs] = useState<NotifPush>(inicial);
  const tipos = tiposParaRol(PUSH_TIPOS, PUSH_SOLO_ADMINS, esAdmin);

  const guardar = async (nuevo: NotifPush) => {
    const antes = prefs;
    setPrefs(nuevo);
    try {
      const r = await fetch('/api/perfil/notif-push', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ push: nuevo }),
      });
      const j = (await r.json().catch(() => null)) as { ok?: boolean; guardado?: boolean; push?: NotifPush } | null;
      if (!r.ok || !j?.ok || j.guardado === false) throw new Error('no guardado');
      if (j.push) setPrefs(j.push);
    } catch {
      setPrefs(antes);
      toast('No se guardó');
    }
  };

  if (!guardable) return <p className="mc-frase mc-dim">Esta sesión no guarda preferencias.</p>;

  return (
    <div className="mc-prefs">
      <Switch
        checked={prefs.activo}
        onChange={(v) => guardar({ ...prefs, activo: v })}
        label="Recibir avisos"
      />
      {prefs.activo && (
        <ul className="mc-tipos">
          {tipos.map((t) => (
            <li key={t.id}>
              <Switch
                checked={prefs.items[t.id] !== false}
                onChange={(v) => guardar({ ...prefs, items: { ...prefs.items, [t.id]: v } })}
                label={t.titulo}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Claro / oscuro ───────────────────────────────────────────────────────────

/**
 * La MISMA preferencia que el escritorio (`aplicarModo`, la que usa InterruptorModo):
 * se recuerda en el navegador y vale para las dos vistas. El botón de escritorio no se
 * monta tal cual porque está pintado para el fondo oscuro de la barra lateral.
 */
function ModoOscuro() {
  const [oscuro, setOscuro] = useState(false);
  useEffect(() => {
    const sync = () => setOscuro(document.documentElement.getAttribute(ATTR_MODO) === 'oscuro');
    sync();
    window.addEventListener('mako-modo', sync);
    return () => window.removeEventListener('mako-modo', sync);
  }, []);
  return <Switch checked={oscuro} onChange={(v) => aplicarModo(v)} label="Modo oscuro" />;
}

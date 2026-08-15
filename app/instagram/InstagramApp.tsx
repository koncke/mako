'use client';

// =============================================================================
// InstagramApp — la tab entera: Publicaciones · Mensajes · Configuración
// =============================================================================
// Tres vistas hermanas del mismo nivel → Tabs (regla de la casa). El envío del
// DM y la escritura a Zernio viven en las server actions / la ruta de envío; acá
// solo se pinta y se orquesta.

import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Pagina, PageHeader, Section, Status, Switch, Tabs, Toast, useToast,
} from '@/app/_ui';
import { Button } from '@/app/_ui';
import { Icon } from '../_components/icons';
import type { EstadoConexionIg } from './ig-datos';
import { conectarInstagramAction, getConfigIgAction, setAutoRespuestaAction } from './actions';
import { Publicaciones } from './Publicaciones';
import { InboxDms } from './InboxDms';

type TabId = 'publicaciones' | 'mensajes' | 'configuracion';

export function InstagramApp({ conexionInicial }: { conexionInicial: EstadoConexionIg }) {
  const [tab, setTab] = useState<TabId>('publicaciones');
  const [conexion, setConexion] = useState<EstadoConexionIg>(conexionInicial);
  const { toast, show, clear } = useToast();

  return (
    <Pagina densidad="compacta">
      <PageHeader
        titulo="Instagram"
        proposito="Publica contenido y responde los DM de tu cuenta, con MaKo redactando los borradores."
        estado={
          conexion.cuenta
            ? <Status tono="good">@{conexion.cuenta.username}</Status>
            : <Status tono="warn">Sin cuenta conectada</Status>
        }
        tabs={
          <Tabs
            tabs={[
              { id: 'publicaciones', label: 'Publicaciones' },
              { id: 'mensajes', label: 'Mensajes' },
              { id: 'configuracion', label: 'Configuración' },
            ]}
            activa={tab}
            onCambio={(id) => setTab(id as TabId)}
          />
        }
      />

      {tab === 'publicaciones' && (
        <Publicaciones cuentaConectada={Boolean(conexion.cuenta)} avisar={show} />
      )}
      {tab === 'mensajes' && <InboxDms avisar={show} />}
      {tab === 'configuracion' && (
        <ConfigInstagram conexion={conexion} onConexion={setConexion} avisar={show} />
      )}

      <Toast state={toast} onClose={clear} />
    </Pagina>
  );
}

// ── Configuración de la tab ──────────────────────────────────────────────────

function ConfigInstagram({ conexion, onConexion, avisar }: {
  conexion: EstadoConexionIg;
  onConexion: (c: EstadoConexionIg) => void;
  avisar: (msg: string) => void;
}) {
  const [autoRespuesta, setAutoRespuesta] = useState<boolean | null>(null);
  const [busyConectar, setBusyConectar] = useState(false);
  const [busyToggle, setBusyToggle] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const r = await getConfigIgAction();
    if (!r.ok) { setError(r.error); return; }
    setAutoRespuesta(r.autoRespuesta);
    onConexion(r.conexion);
    if (r.conexion.error) setError(r.conexion.error);
  }, [onConexion]);

  useEffect(() => { void cargar(); }, [cargar]);

  const conectar = async () => {
    setBusyConectar(true);
    setError(null);
    const r = await conectarInstagramAction();
    if (!r.ok) { setBusyConectar(false); setError(r.error); return; }
    window.location.href = r.authUrl;
  };

  const toggleAuto = async (on: boolean) => {
    setBusyToggle(true);
    const r = await setAutoRespuestaAction(on);
    setBusyToggle(false);
    if (!r.ok) { setError(r.error ?? 'No se pudo guardar el cambio.'); return; }
    setAutoRespuesta(on);
    avisar(on ? 'Respuesta automática activada.' : 'Respuesta automática desactivada.');
  };

  return (
    <>
      {error && <Alert tono="bad">{error}</Alert>}

      <Section titulo="Cuenta conectada" card>
        {conexion.cuenta ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Icon name="instagram" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, color: 'var(--ink)' }}>@{conexion.cuenta.username}</div>
              {conexion.cuenta.displayName && (
                <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)' }}>{conexion.cuenta.displayName}</div>
              )}
            </div>
            <Status tono="good">Conectada</Status>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 220, fontSize: 'var(--fs-md)', color: 'var(--dim)' }}>
              {conexion.configurado
                ? 'Todavía no hay una cuenta de Instagram conectada en este workspace.'
                : 'Falta la API key de Zernio: se carga en la pestaña de integraciones.'}
            </div>
            <Button variant="primary" onClick={() => void conectar()} loading={busyConectar} icon={<Icon name="instagram" />}>
              Conectar cuenta de Instagram
            </Button>
          </div>
        )}
      </Section>

      <Section titulo="Respuesta automática de MaKo" card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Switch
            checked={autoRespuesta === true}
            onChange={(on) => void toggleAuto(on)}
            disabled={autoRespuesta === null || busyToggle}
            label="Enviar las respuestas de MaKo sin revisión"
            hint="Apagada, MaKo deja cada respuesta como borrador y una persona la envía con un clic desde Mensajes."
          />
          {autoRespuesta === true && (
            <Alert tono="warn">
              MaKo responde cada DM entrante por su cuenta, sin que nadie lo revise antes.
              Un mensaje enviado a un cliente real no se puede deshacer: si tu voz o tus
              secuencias todavía no están afinadas, conviene dejarla apagada.
            </Alert>
          )}
        </div>
      </Section>
    </>
  );
}

'use client';

// =============================================================================
// ConectarRedes — «Redes»: conectar Facebook, Instagram y los anuncios de Meta desde el modal de Zernio (23/10/2026)
// =============================================================================
// Martín: «Que ellos conecten su API de Zernio y luego cuando quieran hacer X cosa que requiera un login, que en MaKo esté el
// botón de logearse con Facebook, Instagram o lo que haga falta». Va abajo de la key en el modal de Zernio de /integraciones
// (ServicioConfigForm, sólo con la key guardada; el mismo modal que se abre desde cualquier tab con `ConectarIntegracion`), una
// fila por red con su estado y su botón. Los botones son los de la pieza común (`useConectarViaZernio`): lo mismo que usan Ads
// Manager, Instagram y Messenger de Automations y Chats. Se carga A DEMANDA (`next/dynamic`): los demás servicios no la traen.
//
// ⚠️ UN SOLO HOOK PARA TODAS LAS FILAS: la vuelta de página entera (`?zernio=<red>`) se procesa una vez y los botones comparten el
// estado («Conectando…» en la fila que se tocó, las demás esperan).
// ⚠️ Sólo LEE (`conexiones`): no reclama ruteo ni registra webhooks. Eso lo hace `conectada`, una vez, al quedar conectada una cuenta.

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { Button } from '@/app/_ui';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { EstadoConexion, leerConexiones, useConectarViaZernio } from '@/app/_components/ConectarViaZernio';
import { REDES, REDES_VISIBLES, estadoDeRed, lineaDeCobro, textoGratisZernio, type ConexionZernio, type RedZernio } from '@/lib/zernio-redes';

const SANS = "'Geist', sans-serif";
const caja: CSSProperties = { background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12 };

/** Cómo se llama lo que está conectado: el @usuario o el nombre de la cuenta (el primero que ande). */
function quienes(conexiones: readonly ConexionZernio[]): string {
  const sanas = conexiones.filter((c) => c.activa && !c.vencida);
  return sanas.map((c) => (c.usuario ? `@${c.usuario.replace(/^@/, '')}` : c.nombre)).filter(Boolean).slice(0, 2).join(' · ');
}

export default function ConectarRedes() {
  const [lista, setLista] = useState<ConexionZernio[] | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [errorLectura, setErrorLectura] = useState<string | null>(null);

  const leer = useCallback(async () => {
    const r = await leerConexiones();
    if (!r) { setErrorLectura('No pude leer tus redes. Revisa tu conexión.'); return; }
    if ('conexiones' in r) { setLista(r.conexiones); setTotal(r.total); setErrorLectura(null); } else setErrorLectura(r.error);
  }, []);
  useEffect(() => { void leer(); }, [leer]);

  // `volver`: la pestaña sin ventana emergente (teléfono, navegador interno) vuelve acá y se reabre este mismo modal.
  // `keyAca`: este bloque vive ADENTRO del modal de Zernio, donde está el campo de la key: con una key mala, lo dice acá (abrir otro modal de Zernio
  // encima quedaba detrás del de la grilla, invisible). `volver`: en un teléfono la vuelta es /integraciones (MaKo Mobile conecta ahí).
  const z = useConectarViaZernio({ volver: '/integraciones?abrir=zernio', keyAca: true, onConectado: () => { void leer(); } });
  const ocupado = z.fase === 'abriendo';

  return (
    <div data-conectar-redes style={{ ...caja, padding: 14, display: 'flex', flexDirection: 'column', gap: 10, fontFamily: SANS }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>Redes</span>
        <span style={{ fontSize: 12.5, lineHeight: 1.4, color: 'var(--dim)' }}>{lineaDeCobro(total)}</span>
        {/* Los límites de Zernio, al conectar (Martín, 28/10): lo que da gratis además de las 2 cuentas, y qué pasa al pasarse. */}
        <span data-gratis-zernio style={{ fontSize: 12.5, lineHeight: 1.4, color: 'var(--dim)' }}>{textoGratisZernio()}</span>
      </div>

      {errorLectura && (
        <span role="alert" style={{ fontSize: 12.5, color: 'var(--bad)' }}>{errorLectura}<ReportarASoporte /></span>
      )}

      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {REDES_VISIBLES.map((red: RedZernio) => {
          const e = lista ? estadoDeRed(red, lista) : null;
          const vencida = e?.estado === 'vencida' ? e.conexiones.find((c) => c.vencida) : undefined;
          // Los anuncios son UNA conexión por perfil (Zernio): «otra» no existe, se vuelve a conectar la misma (`force`).
          const esAnuncios = REDES[red].anuncios;
          const sana = e?.estado === 'conectada' ? e.conexiones.find((c) => c.activa && !c.vencida) : undefined;
          // ⚠️ «Conectando…» sólo mientras se pide el link: en «esperando» el botón de ESA fila sigue vivo (es la salida de quien cerró la ventana).
          const activaAhora = z.red === red && z.fase === 'abriendo';
          const quien = e?.estado === 'conectada' ? quienes(e.conexiones) : '';
          return (
            <li key={red} data-red={red} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <span aria-hidden style={{ width: 8, height: 8, borderRadius: 4, flex: 'none', background: e?.estado === 'conectada' ? 'var(--good)' : e?.estado === 'vencida' ? 'var(--warn)' : 'var(--border-strong)' }} />
              <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                <span style={{ fontSize: 13.5, color: 'var(--ink)', fontWeight: 600 }}>{REDES[red].etiqueta}</span>
                <span style={{ fontSize: 12, color: 'var(--dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {e?.estado === 'conectada' ? `Conectada${quien ? ` · ${quien}` : ''}` : e?.estado === 'vencida' ? 'Zernio pide reconectar esta cuenta.' : REDES[red].ayuda}
                </span>
              </span>
              <Button size="sm" variant={e?.estado === 'conectada' ? 'secondary' : 'primary'} loading={activaAhora} disabled={ocupado}
                data-conectar-zernio={red} onClick={() => z.conectar(red, { reconectarId: vencida?.accountId ?? (esAnuncios ? sana?.accountId : null) ?? null })}>
                {e?.estado === 'conectada' ? (esAnuncios ? 'Volver a conectar' : 'Conectar otra') : e?.estado === 'vencida' ? 'Reconectar' : 'Conectar'}
              </Button>
            </li>
          );
        })}
      </ul>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <EstadoConexion z={z} />
      </div>
      {z.modal}
    </div>
  );
}

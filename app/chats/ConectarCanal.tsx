'use client';

// =============================================================================
// ConectarCanal — conectar un canal sin salir de Chats (24/10/2026)
// =============================================================================
// docs/diseno-chats.md §8.4. Martín (por el Cerebro, 24/10): «Cuando quiero conectar un WhatsApp, mira que salta el diseño de
// la tab vieja de WhatsApp, eso está muy mal, solo debería saltar el QR» y «Faltan los Email aquí, para conectarlo, no solo
// WhatsApp, Messenger, Instagram». Antes WhatsApp llevaba a /whatsapp y el email a /email: la pantalla entera de otra tab.
//
// UNA pieza para los dos lugares que conectan (el estado vacío y «Conectar un canal» del chip Canales), y por adentro el
// MISMO modal de cada medio que usa Automations (`ConectarMedio`: «dos modales para lo mismo son los que dejan de decir lo
// mismo»):
//   · WhatsApp: sólo el QR (EvolutionConnect `inline`): el título, «Dispositivos vinculados → Vincular dispositivo» y «Nuevo
//     QR». Con un número ya conectado es uno MÁS (`nueva`); si el que hay está caído, se reconecta ése.
//   · Email: el remitente DEL NEGOCIO (`VincularRemitente`, su dominio). Nunca el de MaKo (nadie manda email con el remitente
//     de la plataforma) y sin lo de marketing de /email al lado.
//   · Instagram y Messenger: Zernio (`useConectarViaZernio`), la ventana en el clic, con la key DEL NEGOCIO.
// El WhatsApp recién conectado sigue en AdministrarWhatsApp (`recien`): la única vez que se pregunta si se traen los chats.

import { useCallback, useState, type ReactNode } from 'react';
import { Mail } from 'lucide-react';
import { Modal } from '@/app/_ui';
import { ConectarMedio } from '@/app/automations/ConectarMedio';
import { useConectarViaZernio } from '@/app/_components/ConectarViaZernio';
import { redDeCanal } from '@/lib/zernio-redes';
import { RUTA_CHATS } from '@/lib/chats-links';
import type { LineaChat } from '@/lib/chats-tipos';
import type { CanalConectable } from './FiltrosChats';
import { IconoCanal } from './iconos-canal';

/** Los cuatro, con lo que pide cada uno (una línea: qué vas a necesitar). */
export const CANALES_CONECTABLES: ReadonlyArray<{ canal: CanalConectable; nombre: string; linea: string }> = [
  { canal: 'whatsapp', nombre: 'WhatsApp', linea: 'Con el QR, desde tu celular' },
  { canal: 'instagram', nombre: 'Instagram', linea: 'Con tu cuenta de Instagram' },
  { canal: 'messenger', nombre: 'Messenger', linea: 'Con tu página de Facebook' },
  { canal: 'email', nombre: 'Email', linea: 'Con el email de tu negocio' },
];

export function IconoConectable({ canal, size = 20 }: { canal: CanalConectable; size?: number }) {
  return canal === 'email' ? <Mail size={size} strokeWidth={1.75} /> : <IconoCanal canal={canal} size={size} />;
}

/** Los cuatro botones (el estado vacío los dibuja sueltos; el modal, en lista). */
export function BotonesCanales({ onElegir, enLista = false }: { onElegir: (c: CanalConectable) => void; enLista?: boolean }) {
  return (
    <div className={enLista ? 'rio-conectar-lista' : 'rio-vacio-botones'}>
      {CANALES_CONECTABLES.map((c) => (
        <button key={c.canal} type="button" className={enLista ? 'rio-conectar-fila' : 'rio-btn'} onClick={() => onElegir(c.canal)}>
          <IconoConectable canal={c.canal} size={enLista ? 22 : 18} />
          {enLista ? <span className="rio-conectar-txt"><span className="rio-conectar-nombre">{c.nombre}</span><span>{c.linea}</span></span> : c.nombre}
        </button>
      ))}
    </div>
  );
}

export function useConectarCanal({ lineas, onWhatsappConectado, onConectado, alError, alNota }: {
  lineas: LineaChat[];
  /** El QR se escaneó: Chats abre la pregunta de sincronizar de ESA línea. */
  onWhatsappConectado: (linea: string | null) => void;
  /** Cualquier canal quedó conectado: la lista se relee. */
  onConectado: () => void;
  alError: (texto: string) => void;
  alNota: (texto: string) => void;
}): { elegir: () => void; conectar: (c: CanalConectable) => void; modal: ReactNode } {
  const [eligiendo, setEligiendo] = useState(false);
  const [medio, setMedio] = useState<'whatsapp' | 'email' | null>(null);
  const viaZernio = useConectarViaZernio({
    volver: RUTA_CHATS,
    onConectado: () => { alNota('Canal conectado'); onConectado(); },
    // La causa va como el TÍTULO del aviso (a la vista): como detalle sólo se ve en un tooltip, y en un teléfono no hay.
    alError: (texto, pago) => alError(pago ? `${texto} Agrega la tarjeta en tu cuenta de Zernio.` : texto),
    alNota,
  });
  const { conectar: conectarRed } = viaZernio;

  const conectar = useCallback((c: CanalConectable) => {
    setEligiendo(false);
    if (c === 'whatsapp' || c === 'email') { setMedio(c); return; }
    conectarRed(redDeCanal(c));
  }, [conectarRed]);

  // WhatsApp: con uno conectado, el QR es de un número MÁS; si no, se reconecta el que hay (o el primero, si no hay ninguno).
  const conectada = lineas.some((l) => l.estado === 'conectado');
  const caida = conectada ? null : (lineas.find((l) => l.esDefault) ?? lineas[0] ?? null);

  const modal = (
    <>
      {eligiendo && (
        <Modal titulo="Conectar un canal" onCerrar={() => setEligiendo(false)} ancho={440}>
          <BotonesCanales enLista onElegir={conectar} />
        </Modal>
      )}
      {medio === 'whatsapp' && (
        <ConectarMedio medio="whatsapp" nueva={conectada} linea={caida?.linea ?? null}
          onCerrar={() => setMedio(null)}
          onLinea={(l) => { setMedio(null); onConectado(); onWhatsappConectado(l); }}
          onConectado={() => { if (!conectada) { setMedio(null); onConectado(); onWhatsappConectado(caida?.linea ?? null); } }} />
      )}
      {medio === 'email' && (
        <ConectarMedio medio="email" onCerrar={() => { setMedio(null); onConectado(); }} />
      )}
      {viaZernio.modal}
    </>
  );
  return { elegir: () => setEligiendo(true), conectar, modal };
}

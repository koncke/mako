'use client';

// =============================================================================
// foto-cliente — la cara de un cliente que nadie eligió: su WhatsApp, o la de su email
// =============================================================================
// Pedido de Martín (06/10/2026): «sería bueno que siempre traigas la foto de perfil del
// cliente, buscala en WhatsApp y sino tiene, la foto del email».
//
// ⚠️ LO QUE LA PERSONA ELIGIÓ GANA SIEMPRE. Si el cliente tiene `icono` o `avatar_url`
// (lo que se pone desde el selector de su ficha), no se busca nada: esto es el respaldo de
// las iniciales, nunca el dato. Es el mismo orden que `caraDeUsuario` (lib/gravatar.ts).
//
// ⚠️ SE PRUEBA ANTES DE DIBUJAR, y no con el `onError` de `Marca`: ése cae directo a las
// iniciales, así que no hay forma de pasar de la foto de WhatsApp (que la mayoría de los
// números no expone) a la del email. Acá se carga cada candidata con un `Image()` y a
// `Marca` le llega sólo la que cargó — y el navegador la sirve de su caché, porque el proxy
// la devuelve con `max-age`. El resultado se recuerda por URL: la tarjeta, la tabla y la
// ficha del mismo cliente no la piden tres veces.
//
// ⚠️ EL `?ws=` VA EN LA URL DE WHATSAPP (`conWs`). Un `<img>` no pasa por el parche de
// fetch que lo agrega solo, así que sin esto el super admin mirando a un cliente pediría la
// foto a la línea de WhatsApp de SU workspace.
//
// La de email sale armada del server (`ficha.fotoEmail`, con `d=404`): el hash de Gravatar
// usa `node:crypto` y no puede vivir acá.

import { useEffect, useState } from 'react';
import { useWs } from '@/app/_ui/Link';
import { conWs } from '@/lib/ws-tab';
import type { ClienteCruce } from './cruce';

const probadas = new Map<string, Promise<boolean>>();

function carga(url: string): Promise<boolean> {
  let p = probadas.get(url);
  if (!p) {
    p = new Promise<boolean>((res) => {
      const img = new Image();
      img.onload = () => res(img.naturalWidth > 0);
      img.onerror = () => res(false);
      img.src = url;
    });
    probadas.set(url, p);
  }
  return p;
}

/** Las candidatas, en orden. Vacío si la persona ya eligió una. Puro: lo usa el test. */
export function candidatasDeFoto(c: Pick<ClienteCruce, 'icono' | 'avatarUrl' | 'ficha'>, ws: number | null): string[] {
  if (c.icono || c.avatarUrl) return [];
  const out: string[] = [];
  const digitos = (c.ficha?.contacto?.telefono ?? '').replace(/\D/g, '');
  // Menos de 8 dígitos no es un número de WhatsApp: pedirlo es una consulta a Evolution
  // que sólo puede contestar que no.
  if (digitos.length >= 8) out.push(conWs(`/api/whatsapp/evolution/mensajes?avatarimg=${digitos}`, ws));
  if (c.ficha?.fotoEmail) out.push(c.ficha.fotoEmail);
  return out;
}

/** La primera candidata que CARGA, o `null` (iniciales) mientras tanto y si ninguna. */
export function useFotoCliente(c: Pick<ClienteCruce, 'icono' | 'avatarUrl' | 'ficha'>): string | null {
  const ws = useWs();
  const lista = candidatasDeFoto(c, ws);
  const clave = lista.join('|');
  const [foto, setFoto] = useState<{ clave: string; url: string | null }>({ clave: '', url: null });
  useEffect(() => {
    if (!clave) return;
    let vivo = true;
    void (async () => {
      for (const u of clave.split('|')) {
        if (await carga(u)) { if (vivo) setFoto({ clave, url: u }); return; }
      }
      if (vivo) setFoto({ clave, url: null });
    })();
    return () => { vivo = false; };
  }, [clave]);
  // Una foto encontrada para OTRO cliente (la tarjeta se reusó) no se muestra.
  return foto.clave === clave ? foto.url : null;
}

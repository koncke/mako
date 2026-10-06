'use client';

// =============================================================================
// foto-contacto — la cara de una persona que nadie eligió: su WhatsApp, o la de su email
// =============================================================================
// Pedido de Martín (06/10/2026), dos veces el mismo día: para el lead del CRM («sería bueno
// que siempre traigas la foto de perfil del lead, buscala en WhatsApp y sino tiene, la foto
// del email») y para el cliente de Customer Success. Es UNA pieza para las dos fichas: la
// escribió primero la sesión de Customer Success (app/customer-success/foto-cliente.ts) y
// se generalizó acá para que el CRM no tuviera una segunda versión.
//
// ⚠️ LO QUE LA PERSONA ELIGIÓ GANA SIEMPRE. Si hay `icono` o `avatarUrl` (lo que se pone
// desde el selector de la ficha del cliente), no se busca nada: esto es el respaldo de las
// iniciales, nunca el dato. Es el mismo orden que `caraDeUsuario` (lib/gravatar.ts). Y la
// foto automática NUNCA se escribe en esas columnas: se calcula al leer.
//
// ⚠️ SE PRUEBA ANTES DE DIBUJAR, y no con el `onError` de un `<img>`: ése cae directo a las
// iniciales, así que no habría forma de pasar de la foto de WhatsApp (que la mayoría de los
// números no tiene guardada) a la del email. Cada candidata se carga con un `Image()` y se
// devuelve sólo la que cargó; el resultado se recuerda POR URL, así la cabecera y la tarjeta
// del mismo contacto no la piden dos veces.
//
// ⚠️ EL `?ws=` VA EN LA URL DE WHATSAPP (`conWs`). Un `<img>` no pasa por el parche de fetch
// que lo agrega solo, así que sin esto el super admin mirando a un cliente pediría la foto a
// la línea de WhatsApp de SU workspace.
//
// Dos cosas medidas (06/10/2026) que conviene saber antes de leer esto como un bug:
//   · «La foto del email» es Gravatar. La foto de una cuenta de Gmail no es pública: un lead
//     de Gmail sin Gravatar queda en iniciales (en el cliente más grande, 550 de 1155 emails
//     son de Gmail).
//   · La de WhatsApp sale de la URL guardada en `evolution_contactos`, que vence a los 10
//     días. Con la línea colgada el proxy puede tardar; mientras tanto se ven las iniciales.

import { useEffect, useState } from 'react';
import { useWs } from '@/app/_ui/Link';
import { candidatasDeFoto, type Contacto } from '@/lib/contacto-lead';

export type { Contacto } from '@/lib/contacto-lead';

const probadas = new Map<string, Promise<boolean>>();

function carga(url: string): Promise<boolean> {
  let p = probadas.get(url);
  if (!p) {
    p = new Promise<boolean>((res) => {
      const img = new Image();
      img.referrerPolicy = 'no-referrer';
      img.onload = () => res(img.naturalWidth > 0);
      img.onerror = () => res(false);
      img.src = url;
    });
    probadas.set(url, p);
  }
  return p;
}

export { candidatasDeFoto };

/** La primera candidata que CARGA, o `null` (iniciales) mientras tanto y si ninguna. */
export function useFotoContacto(c: Contacto): string | null {
  const ws = useWs();
  const clave = candidatasDeFoto(c, ws).join('|');
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
  // Una foto encontrada para OTRO contacto (el componente se reusó) no se muestra.
  return foto.clave === clave ? foto.url : null;
}

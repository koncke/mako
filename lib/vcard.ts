// =============================================================================
// vcard — leer la TARJETA DE CONTACTO que se comparte por WhatsApp
// =============================================================================
// EL CASO (2026-08-13, Leila). Quiso cargar un lead desde el grupo de MaKo:
//
//   Leila  — «Me puedes agregar MaKo este lead que asistió a la primera sesión?»
//   MaKo   — «no me pasaste el nombre ni los datos del contacto…»
//   Leila  — «Aquí»            ← y compartió la TARJETA DE CONTACTO
//   MaKo   — «No me llegó ningún dato ni contacto.»
//
// Lo segundo es literalmente falso: el mensaje LLEGÓ. El doer solo sabía leer
// `conversation`, `extendedTextMessage`, `imageMessage` y `documentMessage`, así
// que un `contactMessage` entraba, no producía ni texto ni adjunto, y MaKo
// concluía que no había venido nada.
//
// ⚠️ LA PARTE QUE MÁS DUELE NO ES QUE NO SE LEYERA: es que MaKo AFIRMÓ lo
// contrario de lo que pasó. Un formato que no se soporta se dice («me llegó una
// tarjeta de contacto y todavía no la sé abrir»); lo que no se puede hacer es
// mandar a la persona a repetir algo que ya hizo bien.
//
// Y compartir el contacto es LA forma natural de pasar un lead por WhatsApp: no
// se tipea un teléfono que ya está en la agenda. Que justo eso fuera lo único
// que no se entendía volvía inservible el camino más obvio.
//
// Sin `server-only`: es un parser puro y es lo que hay que poder testear.
// =============================================================================

export type ContactoVcard = { nombre: string; telefono: string | null; email: string | null };

/** Un `\` de escape de vCard delante de `,` `;` `\` no es parte del valor. */
const desescapar = (v: string): string => v.replace(/\\([,;\\])/g, '$1').replace(/\\n/gi, ' ').trim();

/**
 * Saca nombre, teléfono y email de un vCard.
 *
 * ⚠️ Las claves vienen CON PARÁMETROS (`TEL;type=CELL;waid=549…:+54 9 11…`), así
 * que no se puede comparar la línea contra `'TEL'` a secas: hay que cortar en el
 * primer `:` y quedarse con lo de antes del primer `;`. Es el error clásico de
 * parsear vCard con un split simple, y deja el teléfono en null justo cuando el
 * contacto viene de WhatsApp, que es el 100% de los casos acá.
 */
export function leerVcard(vcard: string): ContactoVcard | null {
  if (!vcard || !/BEGIN:VCARD/i.test(vcard)) return null;

  let nombre = '';
  let apellidoNombre = '';
  let telefono: string | null = null;
  let email: string | null = null;

  // El desdoblado va PRIMERO: el estándar corta las líneas largas y continúa en
  // la siguiente empezando con un espacio. Sin unirlas, un nombre largo o un
  // waid quedan partidos al medio.
  const plano = vcard.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');

  for (const linea of plano.split(/\r?\n/)) {
    const corte = linea.indexOf(':');
    if (corte < 0) continue;
    const clave = linea.slice(0, corte).split(';')[0].trim().toUpperCase();
    const valor = desescapar(linea.slice(corte + 1));
    if (!valor) continue;

    if (clave === 'FN' && !nombre) nombre = valor;
    // N viene como `Apellido;Nombre;;;` — se da vuelta, y solo se usa si no hay FN.
    else if (clave === 'N' && !apellidoNombre) {
      const [ape, nom] = valor.split(';');
      apellidoNombre = [nom, ape].map((x) => (x || '').trim()).filter(Boolean).join(' ');
    } else if (clave === 'TEL' && !telefono) {
      // `waid=` trae el número en formato internacional limpio y es MÁS confiable
      // que el valor visible, que suele venir con paréntesis y guiones de agenda.
      const waid = /waid=(\d{6,})/i.exec(linea)?.[1];
      const crudo = waid ?? valor;
      const soloDigitos = crudo.replace(/\D/g, '');
      telefono = soloDigitos.length >= 6 ? soloDigitos : null;
    } else if (clave === 'EMAIL' && !email && valor.includes('@')) {
      email = valor;
    }
  }

  const nombreFinal = (nombre || apellidoNombre).trim();
  // Sin NINGÚN dato útil no es un contacto: es ruido que no conviene proponer.
  if (!nombreFinal && !telefono && !email) return null;
  return { nombre: nombreFinal || 'Sin nombre', telefono, email };
}

/**
 * Los contactos de un mensaje entrante de WhatsApp (Evolution/Baileys).
 *
 * Son DOS formas y hay que aceptar las dos: compartir un contacto manda
 * `contactMessage`; compartir varios de una manda `contactsArrayMessage`. Con
 * solo la primera, mandar dos contactos juntos se pierde entero — y en silencio,
 * que es el modo de falla que este archivo viene a cerrar.
 */
export function contactosDelMensaje(msg: Record<string, unknown> | undefined): ContactoVcard[] {
  if (!msg) return [];
  const uno = msg.contactMessage as { vcard?: string; displayName?: string } | undefined;
  const varios = msg.contactsArrayMessage as { contacts?: Array<{ vcard?: string; displayName?: string }> } | undefined;

  const crudos = [
    ...(uno ? [uno] : []),
    ...(varios?.contacts ?? []),
  ];
  return crudos
    .map((c) => {
      const leido = leerVcard(c.vcard ?? '');
      if (leido) return leido;
      // Sin vCard legible, el `displayName` es lo único que quedó. Es poco, pero
      // es MUCHO más que decirle a la persona que no llegó nada.
      const dn = (c.displayName ?? '').trim();
      return dn ? { nombre: dn, telefono: null, email: null } : null;
    })
    .filter((c): c is ContactoVcard => c !== null);
}

/** Cómo se le cuenta al modelo lo que llegó, para que lo use como datos del lead. */
export function textoDeContactos(contactos: ContactoVcard[]): string {
  if (!contactos.length) return '';
  const filas = contactos.map((c) => {
    const partes = [c.nombre];
    if (c.telefono) partes.push(`tel ${c.telefono}`);
    if (c.email) partes.push(c.email);
    return `- ${partes.join(' · ')}`;
  });
  return contactos.length === 1
    ? `(compartió el contacto de ${contactos[0].nombre}${contactos[0].telefono ? `, tel ${contactos[0].telefono}` : ''}${contactos[0].email ? `, ${contactos[0].email}` : ''})`
    : `(compartió ${contactos.length} contactos)\n${filas.join('\n')}`;
}

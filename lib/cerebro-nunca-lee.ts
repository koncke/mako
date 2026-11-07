// =============================================================================
// Lo que el Second Brain NO puede leer, por más que sea «del cliente» (7/11/2026)
// =============================================================================
// EL PEDIDO QUE HACE FALTA ACOTAR, textual: «el Second Brain tiene que tomar **absolutamente todos** los datos
// del cliente». La forma obvia de cumplirlo es recorrer `lib/tablas-de-inquilino.ts` —la lista de lo que ES de
// cada negocio, la misma que usa `vaciarTablas` al borrarlo— y leer todo.
//
// ⚠️ **ESA LISTA INCLUYE LAS CREDENCIALES DEL CLIENTE.** Hacerlo así mete las claves API de un negocio en el
// prompt de un modelo. No es una exageración: `credenciales.valor_enc` guarda AES-256-GCM que **esta misma app
// descifra** (lib/cripto-credenciales.ts), así que no alcanza con «va cifrado». Y un prompt no es un lugar del
// que se pueda sacar algo: viaja al proveedor, puede quedar en sus logs, y lo que el modelo conteste lo lee
// cualquiera que tenga el chat.
//
// Hoy el cerebro NO las lee (medido el 7/11 recorriendo sus imports: alcanza 46 de 187 tablas del cliente, y
// ninguna de éstas). Esto está acá para que siga siendo así el día que alguien cumpla el pedido literal.
//
// ⚠️ NO ES UNA LISTA DE «DATOS SENSIBLES». Los mensajes de WhatsApp, las llamadas grabadas y los emails
// también lo son, y ésos SÍ pueden entrar: son el contenido del negocio, que es justamente lo que el cerebro
// tiene que conocer. Lo que está prohibido es otra cosa: **material de AUTENTICACIÓN**, lo que sirve para
// hacerse pasar por el cliente o entrar a sus cuentas. Esa distinción es la que decide si una tabla nueva va
// a esta lista.
//
// Puro, sin red y sin `server-only`: lo prueba `tests/cerebro-no-lee-secretos.test.ts`, que recorre los
// imports del cerebro de verdad.
// =============================================================================

/**
 * Las tablas que el Second Brain NO puede alcanzar, con por qué cada una.
 *
 * El criterio para sumar una: **¿lo que guarda sirve para hacerse pasar por el cliente o entrar a sus
 * cuentas?** Si la respuesta es sí, va acá, aunque sea un hash — un hash de un código de 6 dígitos se
 * rompe en segundos, y un prefijo de token le dice a quien lo vea cuál token buscar.
 */
export const NUNCA_LEE: Readonly<Record<string, string>> = {
  credenciales:
    'Las claves API del negocio. `valor_enc` es AES-256-GCM que ESTA app descifra: «va cifrado» no protege nada acá.',
  credenciales_auditoria:
    'El registro de quién tocó cada credencial y cuándo. No trae el valor, pero sí el mapa de qué tiene conectado y quién entra.',
  ia_pc_codigos:
    'Los códigos para emparejar la PC del cliente con su IA. Son hashes de un código corto: se rompen por fuerza bruta en segundos.',
  shares:
    'Los tokens de lo que el negocio compartió por link. `token_prefijo` basta para reconocer cuál es cada uno.',
};

/** Los nombres, para cruzar contra lo que una lectura alcanza. */
export const TABLAS_PROHIBIDAS: readonly string[] = Object.keys(NUNCA_LEE);

/**
 * ¿Esta tabla puede entrar al cerebro?
 *
 * Se usa en POSITIVO a propósito: una función que pregunta «¿está prohibida?» invita a escribir
 * `if (!prohibida) leer()`, y ahí una tabla NUEVA con credenciales entra sola porque todavía no está en la
 * lista. Preguntando «¿puede?» el default sigue siendo leer, que es lo que se quiere para las 183 restantes —
 * pero el que agrega una tabla de secretos tiene un solo lugar donde anotarla.
 */
export const puedeEntrarAlCerebro = (tabla: string): boolean => !(tabla in NUNCA_LEE);

/** Por qué no, para decirlo en un error o en un log. */
export const porQueNoEntra = (tabla: string): string | null => NUNCA_LEE[tabla] ?? null;

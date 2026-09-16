// =============================================================================
// meta-publicar-errores — por qué Meta no dejó publicar, dicho con dueño y salida
// =============================================================================
// Puro (sin server-only): lo usa /api/ads-manager/campaign-create y se prueba.
//
// Los tres rechazos se REPRODUJERON el 2026-09-11 sobre la cuenta de Código
// Inmobiliario (ws13), con una campaña y un conjunto de leads de prueba en PAUSA
// validando anuncios con `validate_only` (y todo borrado después):
//
//   1885499 «No tienes permiso de anunciante en la página» — el ganador reusado es
//           un post de OTRA página (770269612845316) y la conexión sólo es
//           anunciante en «Joan». Es el error que vio el cliente al publicar.
//   1885183 «La publicación se creó con una app en modo de desarrollo» — CUALQUIER
//           creativo nuevo a nombre de la página (subido o reconstruido): el token
//           lo emitió «Joan P2P app», la app propia del cliente, en modo desarrollo.
//   1487888 «Se requiere el píxel de seguimiento» — un post PROPIO reusado en un
//           conjunto de formulario: el post conserva su botón original, no lleva el
//           formulario, y Meta lo trata como conversión web sin pixel.
//
// ⚠️ EL 1885183 NO LE PIDE AL CLIENTE QUE PUBLIQUE SU APP, Y ES UNA REGLA, NO UN GUSTO.
// La versión vieja decía «hay que pasar esa app a modo público en developers.facebook.com».
// Martín lo cortó el 2026-09-16: «no me menciones más que el cliente tenga que publicar su
// app, esa no es opción». Y tiene razón como copy: mandar a un dueño de negocio al panel de
// desarrolladores de Meta a cambiarle el modo a una app es pedirle que haga de programador
// para poder usar MaKo. La salida verdadera es de la agencia (reconectar Meta con una app
// habilitada), así que el mensaje dice QUÉ pasó, de quién es, y a quién avisar — y nada más.
// ⚠️ Y SÍ HAY UNA SALIDA QUE EL CLIENTE PUEDE TOMAR HOY, medida el 2026-09-16 con el token de
// ws13, en seco (validate_only sobre /ads, que sí reproduce el 1885183) y con CONTROL: un post
// nuevo (object_story_spec) da 1885183; un creativo que apunta a un post PROPIO existente y el
// mismo creativo de un anuncio existente PASAN. La app en desarrollo sólo bloquea lo que ELLA
// pare. Por eso el mensaje ofrece «Usar un ganador» de la página propia — pero SÓLO cuando se
// sabe que no es una campaña de formulario: ahí reusar da 1487888 (medido el 11/09), y
// ofrecerlo sería mandar al cliente a otro rechazo. `pideFormulario` desconocido = no se ofrece.
// ⚠️ Por lo mismo ya NO se le pasa el nombre de la app: nombrarla invita justo a lo prohibido.
// El nombre sigue viajando en el texto crudo de Meta, que se guarda en el borrador y se loguea,
// así que para diagnosticar no se perdió nada.
// ⚠️ Los dos primeros NO son de MaKo, y el mensaje lo dice PRIMERO, nombrando a Meta
// (AGENTS.md: «cuando el que falla es un tercero, se lo nombra»). El texto crudo de
// Meta no decía de quién era ni qué hacer, y se leía como que MaKo no dejaba publicar.
// ⚠️ Y `validate_only` en `adcreatives` NO atrapa ninguno: el creativo con el post
// ajeno dio `success: true`. El rechazo llega recién al crear el ANUNCIO.
// =============================================================================

export const SUB_SIN_PERMISO_PAGINA = 1885499;
export const SUB_APP_EN_DESARROLLO = 1885183;
export const SUB_FALTA_ORIGEN_CONVERSION = 1487888;

export type ContextoPublicacion = {
  /** ¿Algún anuncio reusa un post existente (un ganador)? */
  reusaGanador?: boolean;
  /** ¿Algún conjunto optimiza por formulario instantáneo? */
  pideFormulario?: boolean;
};

/** El rechazo explicado, o null si no es uno de los conocidos (queda el texto de Meta). */
export function explicarRechazoPublicacion(subcode: number | null | undefined, ctx: ContextoPublicacion = {}): string | null {
  if (subcode === SUB_SIN_PERMISO_PAGINA) {
    return 'Meta rechazó el anuncio: usa un post de otra página de Facebook, y tu conexión de Meta no es anunciante en esa página. No es un error de MaKo. Elige un ganador de tu propia página, sube el creativo, o dale a tu conexión acceso de anunciante a esa página en la Configuración del negocio de Meta.';
  }
  if (subcode === SUB_APP_EN_DESARROLLO) {
    const salida = ctx.pideFormulario === false
      ? ' Mientras tanto sí puedes publicar: en «Usar un ganador» elige un anuncio de tu propia página de Facebook, en vez de subir un creativo nuevo.'
      : '';
    return `Meta rechazó el anuncio: no acepta creativos nuevos creados con la conexión de Meta que tiene esta cuenta. No es un error de MaKo ni de tu cuenta publicitaria, y la conexión la renovamos nosotros: escríbenos.${salida} Los anuncios que ya están publicados siguen corriendo.`;
  }
  if (subcode === SUB_FALTA_ORIGEN_CONVERSION && ctx.reusaGanador && ctx.pideFormulario) {
    return 'Meta rechazó el anuncio: un ganador reusado conserva su botón original y no puede llevar tu formulario instantáneo. Para una campaña de formulario, sube el creativo en vez de reusar el ganador.';
  }
  return null;
}

import 'server-only';

// =============================================================================
// github-descubrir — con el token alcanza; el repo lo elegís de una lista
// =============================================================================
// El dueño, después de configurarlo: «está mal el tutorial de "Repositorio". Tuve que
// adivinarlo... Sería mucho más fácil si es un desplegable para seleccionar y listo».
//
// Tenía razón: el campo pedía `usuario/repo` en un placeholder y el tutorial no decía de
// dónde sacarlo. Y encima el dato ya lo tenemos — el token fine-grained se emite CONTRA
// repos específicos, así que GitHub sabe perfectamente cuáles son.
//
// Es el mismo molde que Meta (lib/meta-descubrir.ts): pegás una sola cosa y MaKo
// completa el resto, y solo pregunta si de verdad hay más de una opción.
// =============================================================================

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export type RepoOpcion = { value: string; label: string };
export type DescubrimientoGithub = {
  ok: boolean;
  error?: string;
  /** Si hay UNO solo, va acá ya elegido: no tiene sentido preguntar. */
  repo?: string;
  /** Si hay varios, la lista para el desplegable. */
  opciones: RepoOpcion[];
  mensaje: string;
};

/**
 * Los repos a los que el token da acceso, más recientes primero.
 *
 * `/user/repos` devuelve exactamente el alcance del token: con un fine-grained atado a un
 * repo, devuelve ese uno. Con uno clásico, todos los del usuario. En los dos casos la
 * lista es LA VERDAD sobre lo que se puede leer, así que elegir de ahí no puede fallar
 * después — que es justo lo que pasaba escribiéndolo a mano.
 */
export async function descubrirGithub(token: string): Promise<DescubrimientoGithub> {
  const tk = (token ?? '').trim();
  if (!tk) return { ok: false, error: 'Falta el token.', opciones: [], mensaje: '' };

  try {
    const r = await fetch('https://api.github.com/user/repos?per_page=100&sort=pushed&affiliation=owner,collaborator,organization_member', {
      headers: { Authorization: `Bearer ${tk}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
      signal: AbortSignal.timeout(20_000),
    });
    if (r.status === 401) return { ok: false, error: 'El token no es válido o venció.', opciones: [], mensaje: '' };
    if (!r.ok) return { ok: false, error: `GitHub respondió ${r.status}.`, opciones: [], mensaje: '' };

    const j = await r.json() as Array<{ full_name?: string; private?: boolean; pushed_at?: string }>;
    const opciones: RepoOpcion[] = (Array.isArray(j) ? j : [])
      .map((x) => ({
        value: String(x.full_name ?? ''),
        // La fecha del último push desempata cuando hay varios parecidos: el que se está
        // trabajando es casi siempre el de arriba.
        label: `${x.full_name}${x.private ? ' · privado' : ''}${x.pushed_at ? ` · ${String(x.pushed_at).slice(0, 10)}` : ''}`,
      }))
      .filter((o) => o.value);

    if (!opciones.length) {
      return {
        ok: false,
        error: 'El token es válido pero no da acceso a ningún repo. Revisá que en «Repository access» hayas seleccionado el repo.',
        opciones: [], mensaje: '',
      };
    }
    if (opciones.length === 1) {
      return { ok: true, repo: opciones[0].value, opciones: [], mensaje: `Listo: ${opciones[0].value}.` };
    }
    return { ok: true, opciones, mensaje: `El token ve ${opciones.length} repos. Elegí cuál es el de MaKo.` };
  } catch (e) {
    return { ok: false, error: msg(e), opciones: [], mensaje: '' };
  }
}

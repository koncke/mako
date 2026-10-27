// =============================================================================
// drive-acceso — ¿un video de Google Drive lo puede ver un alumno? (MAU-19, 27/10/2026)
// =============================================================================
// Mauricio sube los videos de su curso a un Drive y los conecta a cada clase pegando el link (la clase ya aceptaba
// Drive). La trampa que lo hacía depender de alguien: él está logueado en SU Google, así que en el editor el video se
// ve perfecto aunque el archivo sea privado, y el alumno, que entra sin esa cuenta, ve «Necesitas acceso». Nadie se
// entera hasta que un alumno lo dice.
//
// Por eso el guardado de una clase (lib/curso-admin.ts, la pantalla y la API de MaKo pasan por ahí) pregunta a Drive
// SIN sesión, como un alumno, y con un video nuevo de Drive que no es público no guarda y dice cómo compartirlo.
//
// Lo medido el 27/10/2026, sin sesión y sin seguir redirecciones:
//   · un archivo público: 200, y el `<title>` es «<nombre> - Google Drive» (1HjoB20f…, «3. Musica - Google Drive»);
//   · un id que no existe: 404, en /view y en /preview.
//   · ⚠️ UN ARCHIVO PRIVADO NO SE MIDIÓ (no había uno a mano). Lo que se sabe de Drive es que sin sesión manda a
//     iniciar sesión (un 3xx a accounts.google.com) o contesta 401/403: los dos son «privado». Cualquier otra cosa —un
//     200 sin el título de Drive, un 5xx, un corte— es «no sé» (`null`), y con «no sé» SE GUARDA: un «no pude
//     preguntar» no se le cobra a Mauricio como un video roto.
//
// Sin `server-only`: `fetch` se inyecta, y los tests lo ejecutan.
// =============================================================================

export type AccesoDrive = 'publico' | 'privado' | 'no-existe';

/** Lo que contestó Drive, leído. `null` = no sé (y no se frena nada). */
export function accesoPorRespuesta(r: { status: number; location: string | null; titulo: string | null }): AccesoDrive | null {
  if (r.status === 200) return r.titulo && / - Google Drive\s*$/.test(r.titulo) ? 'publico' : null;
  if (r.status === 404) return 'no-existe';
  if (r.status === 401 || r.status === 403) return 'privado';
  if (r.status >= 300 && r.status < 400 && r.location) {
    try { return new URL(r.location, 'https://drive.google.com').hostname === 'accounts.google.com' ? 'privado' : null; } catch { return null; }
  }
  return null;
}

export const TEXTO_DRIVE_PRIVADO =
  'Ese video de Drive no está compartido: tus alumnos verían «Necesitas acceso». En Drive: Compartir → Acceso general → «Cualquier persona con el enlace», y vuelve a guardar.';
export const TEXTO_DRIVE_NO_EXISTE =
  'Ese video de Drive no existe o el link quedó cortado: cópialo otra vez desde Drive (Compartir → Copiar vínculo).';

/** El error que frena el guardado, o `null` si se guarda (público, o no se pudo saber). */
export function errorDeAccesoDrive(a: AccesoDrive | null): string | null {
  return a === 'privado' ? TEXTO_DRIVE_PRIVADO : a === 'no-existe' ? TEXTO_DRIVE_NO_EXISTE : null;
}

/** Cuánto se le espera a Drive antes de guardar igual. */
export const ESPERA_DRIVE_MS = 6000;

/**
 * Pregunta a Drive por el archivo, SIN sesión (como un alumno) y SIN seguir redirecciones: el 3xx a iniciar sesión es
 * justo la respuesta que dice «privado». Nunca tira: un corte o un error es `null`.
 */
export async function accesoDeDrive(id: string, f: typeof fetch = fetch, esperaMs = ESPERA_DRIVE_MS): Promise<AccesoDrive | null> {
  if (!/^[A-Za-z0-9_-]{10,}$/.test(id)) return 'no-existe';
  try {
    const r = await f(`https://drive.google.com/file/d/${id}/view`, {
      redirect: 'manual', signal: AbortSignal.timeout(esperaMs), headers: { 'user-agent': 'Mozilla/5.0 (MaKo; comprobar video del curso)' },
    });
    let titulo: string | null = null;
    if (r.status === 200) titulo = /<title>([^<]*)<\/title>/i.exec((await r.text()).slice(0, 60_000))?.[1]?.trim() ?? null;
    return accesoPorRespuesta({ status: r.status, location: r.headers.get('location'), titulo });
  } catch {
    return null;
  }
}

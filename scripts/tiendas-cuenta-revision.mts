// =============================================================================
// tiendas-cuenta-revision — la cuenta con la que entran los revisores de Google y de Apple (3/11/2026)
// =============================================================================
// Uso (desde la raíz del repo; ESCRIBE en la base de .env.local, que es PRODUCCIÓN). Va DESPUÉS de la revisión de seguridad de la excepción:
//   npx tsx --conditions=react-server scripts/tiendas-cuenta-revision.mts --carpeta "C:/Users/marti/.mako-tiendas" --medido
//
// Qué hace: crea (o encuentra) el usuario de lib/mfa-reglas.ts → CUENTA_DE_REVISION en el negocio de prueba, le pone una contraseña al azar y cierra su
// onboarding, que si no tapa /m (riesgo R5).
//
// ⚠️ ANTES MIDE EL NEGOCIO: esa contraseña la tienen terceros, y «Datos de Mau» o «simular» pueden haber dejado datos de un cliente de verdad ahí. Muestra los
//    números y no sigue sin `--medido`.
// ⚠️ CORRERLO DE NUEVO DEJA MUERTA LA CONTRASEÑA QUE TIENEN PLAY Y APPLE: pide `--rotar`. Rotar también cierra las sesiones abiertas (lib/auth.ts).
// ⚠️ LA CONTRASEÑA NO SALE POR PANTALLA: queda en `cuenta-revision.txt` adentro de --carpeta. Martín la pega en Play Console y en App Store Connect. Si la
//    carpeta cae adentro de un repo o de OneDrive, no corre.
// ⚠️ SÓLO EL NEGOCIO DE PRUEBA, en positivo: `CUENTA_DE_REVISION.ws` es un WS_PRUEBAS, y si no, no corre.
// =============================================================================

import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const REPO = process.cwd();
const imp = (rel: string) => import(pathToFileURL(path.join(REPO, rel)).href);
const dotenv = await import(pathToFileURL(path.join(REPO, 'node_modules', 'dotenv', 'lib', 'main.js')).href);
(dotenv.default ?? dotenv).config({ path: path.join(REPO, '.env.local'), quiet: true });

const i = process.argv.indexOf('--carpeta');
const carpeta = i > 0 ? path.resolve(process.argv[i + 1] ?? '') : '';
const dentroDeUnRepo = (d: string): boolean => existsSync(path.join(d, '.git')) || (path.dirname(d) !== d && dentroDeUnRepo(path.dirname(d)));
if (!carpeta || carpeta.toLowerCase().startsWith(REPO.toLowerCase()) || /onedrive/i.test(carpeta) || dentroDeUnRepo(carpeta)) {
  console.error('⛔ Falta --carpeta, afuera de todo repo y de OneDrive: ahí queda la contraseña.');
  process.exit(1);
}

const { CUENTA_DE_REVISION, esCuentaDeRevision } = await imp('lib/mfa-reglas.ts');
const { WS_PRUEBAS } = await imp('lib/auth-session.ts');
if (!WS_PRUEBAS.includes(CUENTA_DE_REVISION.ws)) { console.error('⛔ La cuenta de revisión sólo vive en un negocio de prueba.'); process.exit(1); }

const { buscarUsuarioPorEmail, crearUsuario } = await imp('lib/usuarios.ts');
const { guardarContrasena, tieneContrasena } = await imp('lib/contrasena.ts');
const { getSupabaseServer } = await imp('lib/supabase.ts');
const { runWithWorkspace } = await imp('lib/workspace.ts');
const { cerrarPasosOnboarding, pasosDeCapaActual } = await imp('lib/onboarding-state.ts');

// Lo que hay en el negocio, antes de darle a un tercero una puerta a él.
const db = getSupabaseServer();
const contar = async (tabla: string, col = 'workspace_id') => {
  const { count, error } = await db.from(tabla).select('*', { count: 'exact', head: true }).eq(col, CUENTA_DE_REVISION.ws);
  return error ? `no pude leer (${error.message})` : String(count ?? 0);
};
console.log(`Negocio ${CUENTA_DE_REVISION.ws}: leads ${await contar('leads')} · credenciales ${await contar('credenciales')} · líneas de WhatsApp ${await contar('evolution_instancias')} · clientes de agencia ${await contar('agencia_clientes', 'agencia_ws')} · personas ${await contar('usuarios')}`);
if (!process.argv.includes('--medido')) {
  console.error('⛔ Mira esos números: ni un dato de un cliente de verdad, ni una línea conectada. Si está bien, corre con --medido.');
  process.exit(1);
}

let u = await buscarUsuarioPorEmail(CUENTA_DE_REVISION.email);
if (!u) {
  u = await crearUsuario({ email: CUENTA_DE_REVISION.email, nombre: 'Revisión de las tiendas', rol: 'usuario', estado: 'activo', workspace_id: CUENTA_DE_REVISION.ws, rol_ws: CUENTA_DE_REVISION.rolWs });
}
if (!esCuentaDeRevision(u) || u.estado === 'suspendido') { console.error('⛔ Ya existe un usuario con ese correo, y no es la cuenta de revisión o está suspendido. No toco nada.'); process.exit(1); }
if ((await tieneContrasena(u.id)) === true && !process.argv.includes('--rotar')) {
  console.error('⛔ Ya tiene contraseña, y Play y Apple tienen ésa. Para cambiarla, corre con --rotar y pégala de nuevo en las dos.');
  process.exit(1);
}

// 20 bytes al azar: en base64url son 27 caracteres. Se le suma lo que pide la regla de contraseñas.
const contrasena = `Mk-${randomBytes(20).toString('base64url')}-9`;
// El archivo PRIMERO: si algo falla después, la contraseña nueva no se pierde.
mkdirSync(carpeta, { recursive: true });
const archivo = path.join(carpeta, 'cuenta-revision.txt');
writeFileSync(archivo, `Correo: ${u.email}\nContraseña: ${contrasena}\n`, { mode: 0o600 });
const r = await guardarContrasena(u.id, contrasena, u.email);
if (!r.ok) { console.error(`⛔ No pude guardar la contraseña: ${r.error}`); process.exit(1); }
// Un factor que quedó de antes no protege nada acá (la excepción corre antes) y sirve para cambiar la contraseña por detrás.
await db.from('usuario_mfa').delete().eq('usuario_id', u.id);
await db.from('usuario_passkeys').delete().eq('usuario_id', u.id);

await runWithWorkspace(CUENTA_DE_REVISION.ws, async () => {
  const pasos = await pasosDeCapaActual();
  await cerrarPasosOnboarding(pasos.map((paso: string) => ({ paso, done: true })), 'sistema:tiendas');
});

console.log(`✓ Cuenta de revisión lista (usuario ${u.id}, negocio ${CUENTA_DE_REVISION.ws}). La contraseña quedó en ${archivo}.`);

// =============================================================================
// tiendas-cuenta-revision — la cuenta con la que entran los revisores de Google y de Apple (3/11/2026)
// =============================================================================
// Uso (desde la raíz del repo; ESCRIBE en la base de .env.local, que es PRODUCCIÓN). Va DESPUÉS de la revisión de seguridad de la excepción:
//   npx tsx --conditions=react-server scripts/tiendas-cuenta-revision.mts --carpeta "C:/Users/marti/.mako-tiendas"
//
// Qué hace: crea (o encuentra) el usuario de lib/mfa-reglas.ts → CUENTA_DE_REVISION en el negocio de prueba, le pone una contraseña al azar y cierra su
// onboarding, que si no tapa /m (riesgo R5). Se puede correr de nuevo: la contraseña se rota.
//
// ⚠️ LA CONTRASEÑA NO SALE POR PANTALLA: queda en `cuenta-revision.txt` adentro de --carpeta, afuera del repo. Martín la pega en Play Console y en App Store
//    Connect. Si la carpeta cae adentro del repo, no corre.
// ⚠️ SÓLO EL NEGOCIO DE PRUEBA, en positivo: `CUENTA_DE_REVISION.ws` es un WS_PRUEBAS, y si no, no corre.
// =============================================================================

import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const REPO = process.cwd();
const imp = (rel: string) => import(pathToFileURL(path.join(REPO, rel)).href);
const dotenv = await import(pathToFileURL(path.join(REPO, 'node_modules', 'dotenv', 'lib', 'main.js')).href);
(dotenv.default ?? dotenv).config({ path: path.join(REPO, '.env.local'), quiet: true });

const i = process.argv.indexOf('--carpeta');
const carpeta = i > 0 ? path.resolve(process.argv[i + 1] ?? '') : '';
if (!carpeta || carpeta.toLowerCase().startsWith(REPO.toLowerCase())) {
  console.error('⛔ Falta --carpeta, afuera del repo: ahí queda la contraseña.');
  process.exit(1);
}

const { CUENTA_DE_REVISION, esCuentaDeRevision } = await imp('lib/mfa-reglas.ts');
const { WS_PRUEBAS } = await imp('lib/auth-session.ts');
if (!WS_PRUEBAS.includes(CUENTA_DE_REVISION.ws)) { console.error('⛔ La cuenta de revisión sólo vive en un negocio de prueba.'); process.exit(1); }

const { buscarUsuarioPorEmail, crearUsuario } = await imp('lib/usuarios.ts');
const { guardarContrasena } = await imp('lib/contrasena.ts');
const { runWithWorkspace } = await imp('lib/workspace.ts');
const { cerrarPasosOnboarding, pasosDeCapaActual } = await imp('lib/onboarding-state.ts');

let u = await buscarUsuarioPorEmail(CUENTA_DE_REVISION.email);
if (!u) {
  u = await crearUsuario({ email: CUENTA_DE_REVISION.email, nombre: 'Revisión de las tiendas', rol: 'usuario', estado: 'activo', workspace_id: CUENTA_DE_REVISION.ws, rol_ws: 'admin' });
}
if (!esCuentaDeRevision(u)) { console.error('⛔ Ya existe un usuario con ese correo, y no es la cuenta de revisión. No toco nada.'); process.exit(1); }

// 20 bytes al azar: en base64url son 27 caracteres. Se le suma lo que pide la regla de contraseñas.
const contrasena = `Mk-${randomBytes(20).toString('base64url')}-9`;
const r = await guardarContrasena(u.id, contrasena, u.email);
if (!r.ok) { console.error(`⛔ No pude guardar la contraseña: ${r.error}`); process.exit(1); }

await runWithWorkspace(CUENTA_DE_REVISION.ws, async () => {
  const pasos = await pasosDeCapaActual();
  await cerrarPasosOnboarding(pasos.map((paso: string) => ({ paso, done: true })), 'sistema:tiendas');
});

mkdirSync(carpeta, { recursive: true });
const archivo = path.join(carpeta, 'cuenta-revision.txt');
writeFileSync(archivo, `Correo: ${u.email}\nContraseña: ${contrasena}\n`, { mode: 0o600 });
console.log(`✓ Cuenta de revisión lista (usuario ${u.id}, negocio ${CUENTA_DE_REVISION.ws}). La contraseña quedó en ${archivo}.`);

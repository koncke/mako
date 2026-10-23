// =============================================================================
// Un `claude auth login` de mentira, para tests/ia-pc-login-sin-terminal.test.ts — NO es un test
// =============================================================================
// Hace lo que hace el de verdad sin consola (medido el 23/10/2026): imprime la URL de autorización, espera el código por
// stdin y sale con 0 si es el bueno, con 1 si no. Anota en CLAUDE_FALSO_ANOTA lo que recibió y su CLAUDE_CONFIG_DIR.
// =============================================================================

import { writeFileSync } from 'node:fs';

process.stdout.write('Opening browser to sign in…\n');
process.stdout.write("If the browser didn't open, visit: https://claude.com/cai/oauth/authorize?code=true&client_id=prueba&state=abc\n");
process.stdout.write('Paste code here if prompted > ');
let entrada = '';
process.stdin.on('data', (b) => {
  entrada += b;
  if (!entrada.includes('\n')) return;
  const codigo = entrada.trim();
  writeFileSync(process.env.CLAUDE_FALSO_ANOTA ?? 'claude-falso.txt', JSON.stringify({ codigo, configDir: process.env.CLAUDE_CONFIG_DIR ?? null, args: process.argv.slice(2), apiKey: process.env.ANTHROPIC_API_KEY ?? null }));
  process.stdout.write(codigo === 'BUENO1234#estado' ? 'Login successful.\n' : 'Login failed: Request failed with status code 400\n');
  process.exit(codigo === 'BUENO1234#estado' ? 0 : 1);
});

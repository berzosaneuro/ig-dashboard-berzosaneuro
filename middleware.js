// Protege el dashboard (todo excepto /api/*) con HTTP Basic Auth real, a
// nivel de servidor — no es un candado en el JavaScript del navegador, que
// cualquiera podría desactivar viendo el código fuente. Sin las credenciales
// correctas (DASHBOARD_USER / DASHBOARD_PASS, configuradas como variables de
// entorno en Vercel), el navegador ni siquiera recibe el HTML.
//
// /api/* queda fuera a propósito: /api/sync lo llama el cron de Vercel
// automáticamente y no debe bloquearse.
// /.well-known/* también queda fuera: Vercel lo usa para verificar dominios
// y emitir certificados SSL (retos ACME) — si se bloqueara, un dominio
// nuevo se quedaría sin certificado para siempre.

export const config = {
  matcher: '/((?!api/|\\.well-known/).*)',
};

export default function middleware(request) {
  const user = process.env.DASHBOARD_USER;
  const pass = process.env.DASHBOARD_PASS;

  // Si no hay credenciales configuradas, no bloquear (evita dejar el sitio
  // inaccesible por error de configuración) — pero esto no debería pasar en
  // producción una vez añadidas las env vars.
  if (!user || !pass) return;

  const auth = request.headers.get('authorization');
  if (auth) {
    const [scheme, encoded] = auth.split(' ');
    if (scheme === 'Basic' && encoded) {
      const decoded = atob(encoded);
      const sep = decoded.indexOf(':');
      const gotUser = decoded.slice(0, sep);
      const gotPass = decoded.slice(sep + 1);
      if (gotUser === user && gotPass === pass) return;
    }
  }

  return new Response('Autenticación requerida', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Dashboard Berzosa Neuro"' },
  });
}

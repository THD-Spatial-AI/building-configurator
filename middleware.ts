export const config = {
  matcher: '/(.*)',
};

export default function middleware(req: Request) {
  const authHeader = req.headers.get('authorization');

  if (authHeader?.startsWith('Basic ')) {
    const decoded = atob(authHeader.slice(6));
    const colon   = decoded.indexOf(':');
    const user    = decoded.slice(0, colon);
    const pass    = decoded.slice(colon + 1);

    if (
      user === process.env.BASIC_AUTH_USER &&
      pass === process.env.BASIC_AUTH_PASSWORD
    ) {
      return; // allow through
    }
  }

  return new Response('Access restricted — please enter your credentials.', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="EnerPlanET Prototype", charset="UTF-8"',
    },
  });
}

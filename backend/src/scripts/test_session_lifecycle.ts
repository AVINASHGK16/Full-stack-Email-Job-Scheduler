import http from 'http';
import app from '../app';
import { prisma } from '../db';
import bcrypt from 'bcryptjs';

async function runSessionLifecycleTest() {
  console.log('===============================================================');
  console.log('🧪 VERIFYING MANUAL LOGIN & LOGOUT SESSION LIFECYCLE');
  console.log('===============================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, message: string) {
    totalTests++;
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passedTests++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
    }
  }

  // Start test HTTP server on an ephemeral port
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as { port: number };
  const baseUrl = `http://localhost:${address.port}`;

  const testEmail = 'lifecycle-test@audit.test';
  const testPassword = 'SecureLifecyclePass123!';
  const passwordHash = await bcrypt.hash(testPassword, 10);

  // Setup test user in database
  const user = await prisma.user.upsert({
    where: { email: testEmail },
    update: { passwordHash },
    create: {
      email: testEmail,
      name: 'Lifecycle Tester',
      passwordHash,
    },
  });

  try {
    // ── STEP 1: Unauthenticated request to /auth/me ───────────────
    console.log('--- [STEP 1] Access /auth/me before login (Expected: 401) ---');
    const res1 = await fetch(`${baseUrl}/auth/me`, { method: 'GET' });
    assert(res1.status === 401, 'Unauthenticated GET /auth/me returns 401');

    // ── STEP 2: POST /auth/login with valid credentials ────────────
    console.log('\n--- [STEP 2] POST /auth/login with valid credentials (Expected: 200 & connect.sid cookie) ---');
    const res2 = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: testPassword }),
    });

    assert(res2.status === 200, 'POST /auth/login returns 200 OK');
    const data2 = (await res2.json()) as { data?: { email?: string } };
    assert(data2.data?.email === testEmail, 'Response contains user profile');
    assert(!('passwordHash' in (data2.data || {})), 'passwordHash is omitted from login response');

    // Extract session cookie from Set-Cookie header
    const setCookieHeader = res2.headers.get('set-cookie');
    assert(!!setCookieHeader && setCookieHeader.includes('connect.sid'), 'Set-Cookie header contains connect.sid session cookie');

    const cookie = setCookieHeader ? setCookieHeader.split(';')[0] : '';

    // ── STEP 3: Authenticated request to /auth/me using session cookie
    console.log('\n--- [STEP 3] Authenticated GET /auth/me using session cookie (Expected: 200) ---');
    const res3 = await fetch(`${baseUrl}/auth/me`, {
      method: 'GET',
      headers: { Cookie: cookie },
    });

    assert(res3.status === 200, 'GET /auth/me with session cookie returns 200 OK');
    const data3 = (await res3.json()) as { data?: { id?: string; email?: string } };
    assert(data3.data?.id === user.id, 'GET /auth/me returns correct user ID');
    assert(data3.data?.email === testEmail, 'GET /auth/me returns correct email');

    // ── STEP 4: POST /auth/logout using session cookie ─────────────
    console.log('\n--- [STEP 4] POST /auth/logout using session cookie (Expected: 200 & destroyed session) ---');
    const res4 = await fetch(`${baseUrl}/auth/logout`, {
      method: 'POST',
      headers: { Cookie: cookie },
    });

    assert(res4.status === 200, 'POST /auth/logout returns 200 OK');

    // ── STEP 5: Request to /auth/me using old session cookie (Expected: 401)
    console.log('\n--- [STEP 5] GET /auth/me after logout using old cookie (Expected: 401) ---');
    const res5 = await fetch(`${baseUrl}/auth/me`, {
      method: 'GET',
      headers: { Cookie: cookie },
    });

    assert(res5.status === 401, 'Old session cookie is invalidated and returns 401 Unauthorized');

    console.log('\n===============================================================');
    console.log(`📊 SESSION LIFECYCLE AUDIT: ${passedTests}/${totalTests} TESTS PASSED`);
    console.log('===============================================================\n');
  } finally {
    // Cleanup
    await prisma.user.deleteMany({ where: { email: testEmail } });
    await prisma.$disconnect();
    server.close();
  }
}

runSessionLifecycleTest().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

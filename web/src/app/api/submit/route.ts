import { NextResponse } from 'next/server';
import crypto from 'crypto';

const OWNER = process.env.GITHUB_OWNER!;
const REPO = process.env.GITHUB_REPO!;
const TOKEN = process.env.GITHUB_TOKEN!;
const BASE_BRANCH = process.env.GITHUB_BASE_BRANCH || 'main';
const PENDING_DIR = process.env.PENDING_DIR || 'Data/pending/people';
const FINGERPRINT_SALT = process.env.FINGERPRINT_SALT || 'dev-salt';

const errorMsg = (en: string, fa: string) => `${en} / ${fa}`;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1h
const RATE_LIMIT_MAX = 100;
const memoryBucket = new Map<string, number[]>();

function rateLimit(key: string) {
  const now = Date.now();
  const arr = memoryBucket.get(key) || [];
  const fresh = arr.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (fresh.length >= RATE_LIMIT_MAX) return false;
  fresh.push(now);
  memoryBucket.set(key, fresh);
  return true;
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function isValidHttpUrl(s: string) {
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function fingerprint(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const ua = req.headers.get('user-agent') || 'unknown';
  const h = crypto.createHash('sha256');
  h.update(`${FINGERPRINT_SALT}|${ip}|${ua}`);
  return h.digest('hex');
}

async function gh<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'pending-submit-bot',
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API ${res.status}: ${text}`);
  }
  return res.json();
}

// Optional Turnstile verification (if TURNSTILE_SECRET_KEY set)
async function verifyTurnstile(token: string, req: Request) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true; // not enabled
  if (!token) return false;

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '';
  const form = new URLSearchParams();
  form.set('secret', secret);
  form.set('response', token);
  if (ip) form.set('remoteip', ip);

  const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: form,
    cache: 'no-store',
  });

  const data = await r.json();
  return !!data.success;
}

export async function POST(req: Request) {
  try {
    if (!OWNER || !REPO || !TOKEN) {
      return NextResponse.json({ error: errorMsg('Server not configured', 'تنظیمات سرور کامل نیست') }, { status: 500 });
    }

    const fp = fingerprint(req);
    if (!rateLimit(fp)) {
      return NextResponse.json(
        { error: errorMsg('Rate limit exceeded. Try later.', 'تعداد درخواست‌ها زیاد است، بعداً تلاش کنید') },
        { status: 429 }
      );
    }

    const body = await req.json();
    const okCaptcha = await verifyTurnstile(String(body.turnstileToken || ''), req);
    if (!okCaptcha)
      return NextResponse.json({ error: errorMsg('Captcha failed', 'اعتبارسنجی کپچا ناموفق بود') }, { status: 400 });

    const name = String(body.name || '').trim();
    if (name.length < 2)
      return NextResponse.json({ error: errorMsg('Name is required', 'نام لازم است') }, { status: 400 });

    const accounts = Array.isArray(body.accounts) ? body.accounts : [];
    if (accounts.length < 1)
      return NextResponse.json(
        { error: errorMsg('At least one account is required', 'حداقل یک حساب لازم است') },
        { status: 400 }
      );
    for (const a of accounts) {
      if (!a?.platform)
        return NextResponse.json(
          { error: errorMsg('Account platform is required', 'پلتفرم حساب لازم است') },
          { status: 400 }
        );
      if (!a?.url || !isValidHttpUrl(String(a.url)))
        return NextResponse.json(
          { error: errorMsg('Each account needs a valid URL', 'برای هر حساب یک لینک معتبر لازم است') },
          { status: 400 }
        );
    }

    const claims = Array.isArray(body.claims) ? body.claims : [];
    if (claims.length < 1)
      return NextResponse.json(
        { error: errorMsg('At least one claim is required', 'حداقل یک ادعا لازم است') },
        { status: 400 }
      );
    for (const c of claims) {
      if (!String(c?.summary || '').trim())
        return NextResponse.json(
          { error: errorMsg('Each claim needs a summary', 'برای هر ادعا یک خلاصه لازم است') },
          { status: 400 }
        );
      const ev = Array.isArray(c?.evidence) ? c.evidence : [];
      if (ev.length < 1)
        return NextResponse.json(
          { error: errorMsg('Each claim needs at least one evidence item', 'هر ادعا باید حداقل یک مدرک داشته باشد') },
          { status: 400 }
        );
      for (const e of ev) {
        if (!e?.original_url || !isValidHttpUrl(String(e.original_url)))
          return NextResponse.json(
            { error: errorMsg('Evidence original_url must be a valid URL', 'لینک اصلی مدرک باید معتبر باشد') },
            { status: 400 }
          );
        if (e?.archived_url && !isValidHttpUrl(String(e.archived_url)))
          return NextResponse.json(
            { error: errorMsg('Evidence archived_url must be a valid URL', 'لینک آرشیو مدرک باید معتبر باشد') },
            { status: 400 }
          );
        if (!String(e?.excerpt || '').trim())
          return NextResponse.json(
            { error: errorMsg('Evidence excerpt is required', 'گزیده مدرک لازم است') },
            { status: 400 }
          );
        if (!String(e?.context_note || '').trim())
          return NextResponse.json(
            { error: errorMsg('Evidence context_note is required', 'توضیح زمینه برای مدرک لازم است') },
            { status: 400 }
          );
      }
    }

    const slug = slugify(name);
    const submissionId = crypto.randomBytes(6).toString('hex'); // 12 chars
    const submittedAt = new Date().toISOString();

    const fileName = `${slug}-${submissionId}.json`;
    const filePath = `${PENDING_DIR}/${fileName}`;

    const normalizedClaims = claims.map((c: any) => ({
      type: String(c.type || 'other'),
      summary: String(c.summary || '').trim(),
      date_range: c.date_range ? String(c.date_range) : undefined,
      evidence: (c.evidence || []).map((e: any) => ({
        original_url: String(e.original_url).trim(),
        archived_url: e.archived_url ? String(e.archived_url).trim() : undefined,
        captured_at: submittedAt,
        excerpt: String(e.excerpt || '').trim(),
        context_note: String(e.context_note || '').trim(),
      })),
    }));

    const payload = {
      schema_version: 1,
      review_status: 'pending',
      submission_id: submissionId,
      submitted_at: submittedAt,
      submitter_fingerprint: fp,

      name,
      aliases: Array.isArray(body.aliases) ? body.aliases.slice(0, 30) : [],
      affiliations: Array.isArray(body.affiliations) ? body.affiliations.slice(0, 50) : [],
      summary: String(body.summary || '')
        .trim()
        .slice(0, 1500),

      accounts: accounts.slice(0, 30).map((a: any) => ({
        platform: String(a.platform),
        handle: a.handle ? String(a.handle).slice(0, 100) : undefined,
        url: String(a.url).slice(0, 500),
      })),

      claims: normalizedClaims.slice(0, 10),
      confidence: ['low', 'medium', 'high'].includes(body.confidence) ? body.confidence : 'medium',
    };

    const baseRef = await gh<{ object: { sha: string } }>(`/repos/${OWNER}/${REPO}/git/ref/heads/${BASE_BRANCH}`);
    const baseSha = baseRef.object.sha;

    const branchName = `submit/${slug}-${submissionId}`;
    await gh(`/repos/${OWNER}/${REPO}/git/refs`, {
      method: 'POST',
      body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: baseSha }),
    });

    const contentB64 = Buffer.from(JSON.stringify(payload, null, 2)).toString('base64');

    const putPath = `/repos/${OWNER}/${REPO}/contents/${filePath.split('/').map(encodeURIComponent).join('/')}`;
    await gh(putPath, {
      method: 'PUT',
      body: JSON.stringify({
        message: `Pending submission: ${name}`,
        content: contentB64,
        branch: branchName,
      }),
    });

    const pr = await gh<{ html_url: string }>(`/repos/${OWNER}/${REPO}/pulls`, {
      method: 'POST',
      body: JSON.stringify({
        title: `Pending submission: ${name}`,
        head: branchName,
        base: BASE_BRANCH,
        body:
          `Automated submission to **pending queue**.\n\n` +
          `- Name: ${name}\n` +
          `- File: \`${filePath}\`\n` +
          `- Submission ID: \`${submissionId}\`\n` +
          `- Review status: pending\n\n` +
          `Reviewer checklist is in PR template.\n`,
      }),
    });

    return NextResponse.json({ ok: true, pull_request_url: pr.html_url });
  } catch (e: any) {
    const fallback = errorMsg('Unknown error', 'خطای نامشخص');
    const message = e?.message ? errorMsg(String(e.message), 'خطای غیرمنتظره') : fallback;
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

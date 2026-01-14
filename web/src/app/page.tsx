'use client';

import React, { useState } from 'react';

type Account = { platform: string; handle?: string; url: string };
type Evidence = { original_url: string; archived_url?: string; excerpt: string; context_note: string };
type Claim = { type: string; summary: string; date_range?: string; evidence: Evidence[] };

const PLATFORMS = [
  'x',
  'instagram',
  'linkedin',
  'telegram',
  'youtube',
  'tiktok',
  'facebook',
  'website',
  'other',
] as const;

const REPO_URL = 'https://github.com/ali-ajam/Islamic-Republic-Influence-Networks/tree/main/Data';

function Label({ en, fa, required }: { en: string; fa: string; required?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
      <div style={{ fontWeight: 700 }}>
        {en} {required ? <span style={{ color: '#b91c1c' }}>*</span> : null}
      </div>
      <div dir='rtl' style={{ opacity: 0.85, fontWeight: 600 }}>
        {fa} {required ? <span style={{ color: '#b91c1c' }}>*</span> : null}
      </div>
    </div>
  );
}

export default function SubmitPage() {
  const [name, setName] = useState('');

  const [accounts, setAccounts] = useState<Account[]>([{ platform: 'x', handle: '', url: '' }]);

  const [claims, setClaims] = useState<Claim[]>([
    {
      type: 'amplification',
      summary: '',
      date_range: '',
      evidence: [{ original_url: '', archived_url: '', excerpt: '', context_note: '' }],
    },
  ]);

  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [loading, setLoading] = useState(false);

  function updateAccount(i: number, patch: Partial<Account>) {
    setAccounts((prev) => prev.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));
  }

  function updateClaim(i: number, patch: Partial<Claim>) {
    setClaims((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }

  function updateEvidence(ci: number, ei: number, patch: Partial<Evidence>) {
    setClaims((prev) =>
      prev.map((c, idx) => {
        if (idx !== ci) return c;
        const evidence = c.evidence.map((e, j) => (j === ei ? { ...e, ...patch } : e));
        return { ...c, evidence };
      })
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setStatus(null);

    // Optional: integrate Turnstile later, attach token here
    const turnstileToken = (window as any).turnstileToken || '';

    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name,
          accounts,
          claims,
          turnstileToken,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Submission failed');

      setStatus({ ok: true, message: `PR created: ${data.pull_request_url}` });
    } catch (err: any) {
      setStatus({ ok: false, message: err?.message || 'Something went wrong' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={page}>
      <div style={container}>
        <header style={{ marginBottom: 18 }}>
          <h1 style={{ fontSize: 28, margin: 0, fontWeight: 900, letterSpacing: -0.2 }}>Submit a Profile</h1>
          <p style={{ marginTop: 10, marginBottom: 0, color: '#475569', lineHeight: 1.5 }}>
            Submissions create a GitHub Pull Request into a <b>pending review queue</b>. Please include at least one
            claim and evidence.
          </p>
        </header>

        <form onSubmit={onSubmit} style={{ display: 'grid', gap: 16 }}>
          {/* Identity */}
          <section style={card}>
            <Label en='Full name' fa='نام کامل' required />
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={input}
              placeholder='e.g., Firstname Lastname'
            />
          </section>

          {/* Accounts */}
          <section style={card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <h2 style={h2}>Accounts</h2>
              <div dir='rtl' style={faHint}>
                حساب‌ها
              </div>
            </div>
            <p style={hint}>
              Add all known accounts. URL is required.
              <span dir='rtl' style={{ marginLeft: 8 }}>
                همه حساب‌ها را اضافه کنید. لینک ضروری است.
              </span>
            </p>

            {accounts.map((a, i) => (
              <div key={i} style={rowBlock}>
                <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 12 }}>
                  <label style={{ display: 'grid', gap: 8 }}>
                    <Label en='Platform' fa='پلتفرم' required />
                    <select
                      value={a.platform}
                      onChange={(e) => updateAccount(i, { platform: e.target.value })}
                      style={input}
                    >
                      {PLATFORMS.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label style={{ display: 'grid', gap: 8 }}>
                    <Label en='Handle (optional)' fa='نام کاربری (اختیاری)' />
                    <input
                      value={a.handle || ''}
                      onChange={(e) => updateAccount(i, { handle: e.target.value })}
                      style={input}
                      placeholder='e.g., username'
                    />
                  </label>
                </div>

                <label style={{ display: 'grid', gap: 8 }}>
                  <Label en='Account URL' fa='لینک حساب' required />
                  <input
                    required
                    value={a.url}
                    onChange={(e) => updateAccount(i, { url: e.target.value })}
                    style={input}
                    placeholder='https://...'
                  />
                </label>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button
                    type='button'
                    onClick={() => setAccounts((prev) => [...prev, { platform: 'other', handle: '', url: '' }])}
                    style={btn}
                  >
                    + Add account
                    <span dir='rtl' style={{ marginLeft: 8 }}>
                      + افزودن حساب
                    </span>
                  </button>

                  {accounts.length > 1 && (
                    <button
                      type='button'
                      onClick={() => setAccounts((prev) => prev.filter((_, idx) => idx !== i))}
                      style={btnGhost}
                    >
                      Remove
                      <span dir='rtl' style={{ marginLeft: 8 }}>
                        حذف
                      </span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </section>

          {/* Claims */}
          <section style={card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <h2 style={h2}>Claim(s) & Evidence</h2>
              <div dir='rtl' style={faHint}>
                ادعا و مدرک
              </div>
            </div>
            <p style={hint}>
              Keep claims factual. Provide links + short excerpt + context note.
              <span dir='rtl' style={{ marginLeft: 8 }}>
                ادعا را واقعی و دقیق بنویسید. لینک + نقل‌قول کوتاه + توضیح زمینه لازم است.
              </span>
            </p>

            {claims.map((c, ci) => (
              <div key={ci} style={rowBlock}>
                <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 12 }}>
                  <label style={{ display: 'grid', gap: 8 }}>
                    <Label en='Claim type' fa='نوع ادعا' required />
                    <select value={c.type} onChange={(e) => updateClaim(ci, { type: e.target.value })} style={input}>
                      <option value='support'>support</option>
                      <option value='amplification'>amplification</option>
                      <option value='coordination'>coordination</option>
                      <option value='funding'>funding</option>
                      <option value='other'>other</option>
                    </select>
                  </label>

                  <label style={{ display: 'grid', gap: 8 }}>
                    <Label en='Date range (optional)' fa='بازه زمانی (اختیاری)' />
                    <input
                      value={c.date_range || ''}
                      onChange={(e) => updateClaim(ci, { date_range: e.target.value })}
                      style={input}
                      placeholder='e.g., 2022-09 to 2022-11'
                    />
                  </label>
                </div>

                <label style={{ display: 'grid', gap: 8 }}>
                  <Label en='Claim summary' fa='خلاصه ادعا' required />
                  <textarea
                    required
                    value={c.summary}
                    onChange={(e) => updateClaim(ci, { summary: e.target.value })}
                    style={textarea}
                    placeholder='Write a short, factual description of what happened.'
                  />
                </label>

                <div style={{ display: 'grid', gap: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ fontWeight: 900 }}>Evidence</div>
                    <div dir='rtl' style={{ fontWeight: 800, opacity: 0.85 }}>
                      مدرک
                    </div>
                  </div>

                  {c.evidence.map((ev, ei) => (
                    <div key={ei} style={evidenceCard}>
                      <label style={{ display: 'grid', gap: 8 }}>
                        <Label en='Original URL' fa='لینک اصلی' required />
                        <input
                          required
                          value={ev.original_url}
                          onChange={(e) => updateEvidence(ci, ei, { original_url: e.target.value })}
                          style={input}
                          placeholder='https://...'
                        />
                      </label>

                      <label style={{ display: 'grid', gap: 8 }}>
                        <Label en='Archived URL (recommended)' fa='لینک آرشیو (پیشنهادی)' />
                        <input
                          value={ev.archived_url || ''}
                          onChange={(e) => updateEvidence(ci, ei, { archived_url: e.target.value })}
                          style={input}
                          placeholder='https://archive.today/...'
                        />
                      </label>

                      <label style={{ display: 'grid', gap: 8 }}>
                        <Label en='Excerpt' fa='نقل‌قول کوتاه' required />
                        <textarea
                          required
                          value={ev.excerpt}
                          onChange={(e) => updateEvidence(ci, ei, { excerpt: e.target.value })}
                          style={textareaSm}
                          placeholder='Paste a short excerpt from the evidence.'
                        />
                      </label>

                      <label style={{ display: 'grid', gap: 8 }}>
                        <Label en='Context note' fa='توضیح زمینه' required />
                        <textarea
                          required
                          value={ev.context_note}
                          onChange={(e) => updateEvidence(ci, ei, { context_note: e.target.value })}
                          style={textareaSm}
                          placeholder='Explain briefly why this supports the claim.'
                        />
                      </label>

                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <button
                          type='button'
                          onClick={() => {
                            const nextEvidence = [
                              ...c.evidence,
                              { original_url: '', archived_url: '', excerpt: '', context_note: '' },
                            ];
                            updateClaim(ci, { evidence: nextEvidence } as any);
                          }}
                          style={btn}
                        >
                          + Add evidence
                          <span dir='rtl' style={{ marginLeft: 8 }}>
                            + افزودن مدرک
                          </span>
                        </button>

                        {c.evidence.length > 1 && (
                          <button
                            type='button'
                            onClick={() => {
                              const nextEvidence = c.evidence.filter((_, idx) => idx !== ei);
                              updateClaim(ci, { evidence: nextEvidence } as any);
                            }}
                            style={btnGhost}
                          >
                            Remove
                            <span dir='rtl' style={{ marginLeft: 8 }}>
                              حذف
                            </span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button
                    type='button'
                    onClick={() =>
                      setClaims((prev) => [
                        ...prev,
                        {
                          type: 'amplification',
                          summary: '',
                          date_range: '',
                          evidence: [{ original_url: '', archived_url: '', excerpt: '', context_note: '' }],
                        },
                      ])
                    }
                    style={btn}
                  >
                    + Add claim
                    <span dir='rtl' style={{ marginLeft: 8 }}>
                      + افزودن ادعا
                    </span>
                  </button>

                  {claims.length > 1 && (
                    <button
                      type='button'
                      onClick={() => setClaims((prev) => prev.filter((_, idx) => idx !== ci))}
                      style={btnGhost}
                    >
                      Remove claim
                      <span dir='rtl' style={{ marginLeft: 8 }}>
                        حذف ادعا
                      </span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </section>

          <button type='submit' disabled={loading} style={submitBtn}>
            {loading ? 'Submitting…' : 'Create PR (Pending Review)'}
            <span dir='rtl' style={{ marginLeft: 10, fontWeight: 700 }}>
              ارسال و ساخت PR
            </span>
          </button>

          {status && (
            <div
              style={{
                padding: 12,
                borderRadius: 14,
                border: '1px solid #e2e8f0',
                background: status.ok ? '#ecfdf5' : '#fef2f2',
              }}
            >
              {status.message}
            </div>
          )}

          <footer style={{ marginTop: 6, paddingTop: 12, borderTop: '1px solid #e2e8f0' }}>
            <div
              style={{ color: '#475569', display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}
            >
              <div>
                Data repo:
                <a
                  href={REPO_URL}
                  target='_blank'
                  rel='noreferrer'
                  style={{ marginLeft: 8, color: '#0f172a', fontWeight: 700 }}
                >
                  Islamic-Republic-Influence-Networks
                </a>
              </div>
              <div dir='rtl'>
                مخزن داده:
                <a
                  href={REPO_URL}
                  target='_blank'
                  rel='noreferrer'
                  style={{ marginRight: 8, color: '#0f172a', fontWeight: 800 }}
                >
                  لینک گیت‌هاب
                </a>
              </div>
            </div>
          </footer>
        </form>
      </div>
    </div>
  );
}

// ---- Styles (light theme, no dark mode look) ----
const page: React.CSSProperties = {
  minHeight: '100vh',
  background: '#f8fafc',
  color: '#0f172a',
  padding: '28px 14px',
};

const container: React.CSSProperties = {
  maxWidth: 940,
  margin: '0 auto',
};

const card: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: 18,
  padding: 16,
  boxShadow: '0 1px 0 rgba(15,23,42,0.03)',
};

const rowBlock: React.CSSProperties = {
  marginTop: 12,
  paddingTop: 12,
  borderTop: '1px solid #eef2f7',
  display: 'grid',
  gap: 12,
};

const evidenceCard: React.CSSProperties = {
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: 16,
  padding: 14,
  display: 'grid',
  gap: 12,
};

const input: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid #cbd5e1',
  borderRadius: 12,
  background: '#fff',
  color: '#0f172a',
  outline: 'none',
};

const textarea: React.CSSProperties = { ...input, minHeight: 96, resize: 'vertical' };
const textareaSm: React.CSSProperties = { ...input, minHeight: 78, resize: 'vertical' };

const h2: React.CSSProperties = {
  margin: 0,
  fontSize: 18,
  fontWeight: 900,
  letterSpacing: -0.2,
};

const hint: React.CSSProperties = {
  marginTop: 8,
  marginBottom: 0,
  color: '#475569',
  lineHeight: 1.5,
};

const faHint: React.CSSProperties = {
  color: '#475569',
  fontWeight: 800,
};

const btn: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 12,
  border: '1px solid #cbd5e1',
  background: '#ffffff',
  cursor: 'pointer',
  fontWeight: 800,
};

const btnGhost: React.CSSProperties = {
  ...btn,
  background: '#f8fafc',
};

const submitBtn: React.CSSProperties = {
  padding: '12px 14px',
  borderRadius: 14,
  border: '1px solid #0f172a',
  background: '#0f172a',
  color: '#ffffff',
  cursor: 'pointer',
  fontWeight: 900,
};

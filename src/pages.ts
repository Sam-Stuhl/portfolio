// Two small pages Google's OAuth consent screen requires before an app can
// leave Testing: a homepage and a privacy policy, both on a domain Sam owns.
// The app is ATLAS, Sam's own assistant, which reads and drafts in his Gmail.
// Plain HTML, inline, in the résumé's type so the site reads as one thing.

function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<style>
  body { font-family: Georgia, "Times New Roman", serif; color: #2E2C29; background: #fff;
         max-width: 40rem; margin: 3rem auto; padding: 0 1rem; line-height: 1.55; }
  h1 { font-variant: small-caps; letter-spacing: 0.04em; border-bottom: 1px solid #2E2C29;
       padding-bottom: 0.3rem; font-weight: normal; }
  a { color: #136A6F; }
  @media (prefers-color-scheme: dark) { body { background: #1b1a19; color: #e8e4de; }
    h1 { border-color: #e8e4de; } a { color: #5fb3b8; } }
</style>
</head>
<body>
${body}
</body>
</html>
`;
}

export const ATLAS_HTML = page(
  "ATLAS",
  `<h1>ATLAS</h1>
<p>ATLAS is Samuel Stuhl's personal assistant: software he wrote for himself, running on
his own computer. It is not a product, and it has one user.</p>
<p>With his permission it reads his Gmail to tell him what needs him, and writes replies as
drafts. It sends an email only when he has reviewed the exact message and tapped Send.</p>
<p><a href="/privacy">Privacy policy</a></p>`,
);

export const PRIVACY_HTML = page(
  "ATLAS privacy policy",
  `<h1>ATLAS privacy policy</h1>
<p>Updated September 28, 2026.</p>
<p>ATLAS is a personal assistant used only by Samuel Stuhl, on accounts that belong to him.
Nobody else can sign in to it.</p>
<p><strong>What it accesses.</strong> With his consent, ATLAS reads messages in his Gmail
accounts (<code>gmail.readonly</code>) and creates and sends drafts (<code>gmail.compose</code>).
It sends a message only after he has seen that exact message and approved it.</p>
<p><strong>Where the data goes.</strong> Email is processed on his own computer. Parts of a
message may be sent to the AI model that helps him read and reply to it (Anthropic's Claude),
under that provider's terms. Nothing is sold, shared with anyone else, or used for
advertising.</p>
<p><strong>Storage and removal.</strong> Access tokens are kept on his computer, readable
only by his account. Access can be revoked at any time at
<a href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</a>.</p>
<p><strong>Google API data.</strong> ATLAS's use of information received from Google APIs
adheres to the
<a href="https://developers.google.com/terms/api-services-user-data-policy">Google API
Services User Data Policy</a>, including the Limited Use requirements.</p>
<p>Questions: <a href="mailto:sam.stuhl.personal@gmail.com">sam.stuhl.personal@gmail.com</a></p>`,
);

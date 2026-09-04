// samstuhl.com
//
// Today this serves exactly two things: the résumé as HTML and the same résumé
// as a PDF download. Both are baked into the bundle at build time, so a request
// touches Cloudflare and nothing else.
//
// The custom domain claims the whole apex, so everything else gets a bare 404.
// That is deliberate: the portfolio site does not exist yet, and a 404 is a
// cleaner "nothing here" than a Cloudflare origin error.

import { HTML_ETAG, PDF_ETAG, RESUME_HTML } from "./generated/resume";
import resumePdf from "../build/assets/resume.pdf";
import favicon from "./favicon.svg";

const PDF_FILENAME = "Samuel-Stuhl-Resume.pdf";
const CACHE = "public, max-age=300, must-revalidate";

/** 304 when the client already has this exact build. */
function notModified(request: Request, etag: string): boolean {
  const ifNoneMatch = request.headers.get("if-none-match");
  if (!ifNoneMatch) return false;
  // Compare on the opaque value alone: our tags are weak, and an intermediary
  // may hand back either form.
  const bare = (tag: string) => tag.trim().replace(/^W\//, "");
  return ifNoneMatch.split(",").map(bare).includes(bare(etag));
}

function send(request: Request, body: BodyInit, etag: string, headers: HeadersInit): Response {
  const common = { etag, "cache-control": CACHE, ...Object.fromEntries(new Headers(headers)) };
  if (notModified(request, etag)) {
    return new Response(null, { status: 304, headers: common });
  }
  // A HEAD must carry the same headers as its GET but no body.
  return new Response(request.method === "HEAD" ? null : body, { headers: common });
}

export default {
  fetch(request: Request): Response {
    const { pathname } = new URL(request.url);

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("method not allowed\n", {
        status: 405,
        headers: { allow: "GET, HEAD", "content-type": "text/plain; charset=utf-8" },
      });
    }

    if (pathname === "/resume/") {
      return Response.redirect(new URL("/resume", request.url).toString(), 308);
    }

    if (pathname === "/resume") {
      return send(request, RESUME_HTML, HTML_ETAG, {
        "content-type": "text/html; charset=utf-8",
      });
    }

    if (pathname === "/favicon.svg") {
      return new Response(request.method === "HEAD" ? null : favicon, {
        headers: {
          "content-type": "image/svg+xml; charset=utf-8",
          "cache-control": "public, max-age=86400",
        },
      });
    }

    if (pathname === "/resume.pdf") {
      return send(request, resumePdf, PDF_ETAG, {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${PDF_FILENAME}"`,
      });
    }

    return new Response("not found\n", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  },
} satisfies ExportedHandler;

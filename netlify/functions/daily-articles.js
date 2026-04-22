const https = require("https");

// ─── HTTP helper ───────────────────────────────────────────────────────────
function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", c => data += c);
      res.on("end", () => resolve({ status: res.statusCode, body: data }));
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

// ─── Firestore: list all users ─────────────────────────────────────────────
async function getUsers(projectId, apiKey) {
  const path = "/v1/projects/" + projectId + "/databases/(default)/documents/cadastros?pageSize=200&key=" + apiKey;
  const res = await request({ hostname: "firestore.googleapis.com", path, method: "GET" }, null);
  if (res.status !== 200) { console.error("Firestore list error:", res.body); return []; }
  const json = JSON.parse(res.body);
  if (!json.documents) return [];
  return json.documents.map(doc => {
    const f = doc.fields || {};
    return {
      nome: f.nome?.stringValue || "",
      email: f.email?.stringValue || "",
      especialidade: f.especialidade?.stringValue || "",
      temas: f.temas?.stringValue || "",
      ativo: f.ativo?.booleanValue !== false
    };
  }).filter(u => u.email && u.ativo);
}

// ─── PubMed: search article ────────────────────────────────────────────────
async function searchPubMed(query) {
  const encoded = encodeURIComponent(query + " [tiab]");
  const searchPath = "/entrez/eutils/esearch.fcgi?db=pubmed&term=" + encoded + "&retmax=5&sort=date&retmode=json&datetype=pdat&reldate=365";
  const searchRes = await request({ hostname: "eutils.ncbi.nlm.nih.gov", path: searchPath, method: "GET" }, null);
  if (searchRes.status !== 200) return null;
  const searchJson = JSON.parse(searchRes.body);
  const ids = searchJson.esearchresult?.idlist || [];
  if (ids.length === 0) return null;
  // Pick random from top 5
  const pmid = ids[Math.floor(Math.random() * ids.length)];
  // Fetch abstract
  const fetchPath = "/entrez/eutils/efetch.fcgi?db=pubmed&id=" + pmid + "&retmode=xml&rettype=abstract";
  const fetchRes = await request({ hostname: "eutils.ncbi.nlm.nih.gov", path: fetchPath, method: "GET" }, null);
  if (fetchRes.status !== 200) return null;
  const xml = fetchRes.body;
  // Parse title
  const titleMatch = xml.match(/<ArticleTitle[^>]*>([sS]*?)</ArticleTitle>/);
  const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : "Artigo sem titulo";
  // Parse abstract
  const abstractMatch = xml.match(/<AbstractText[^>]*>([sS]*?)</AbstractText>/g);
  let abstract = "";
  if (abstractMatch) {
    abstract = abstractMatch.map(a => a.replace(/<[^>]+>/g, "").trim()).join(" ");
  }
  // Parse journal
  const journalMatch = xml.match(/<Title>([sS]*?)</Title>/);
  const journal = journalMatch ? journalMatch[1].trim() : "";
  // Parse year
  const yearMatch = xml.match(/<PubDate>[\s\S]*?<Year>(\d{4})<\/Year>/);
  const year = yearMatch ? yearMatch[1] : new Date().getFullYear().toString();
  // Parse authors
  const authorMatches = xml.match(/<LastName>([sS]*?)</LastName>/g) || [];
  const authors = authorMatches.slice(0, 3).map(a => a.replace(/<[^>]+>/g, "").trim());
  const authorStr = authors.length > 0 ? authors.join(", ") + (authorMatches.length > 3 ? " et al." : "") : "Autores nao informados";
  return { pmid, title, abstract: abstract.substring(0, 1200), journal, year, authors: authorStr };
}

// ─── Generate structured summary ──────────────────────────────────────────
function generateSummary(article, especialidade, tema) {
  if (!article.abstract || article.abstract.length < 50) {
    return "Resumo detalhado nao disponivel para este artigo. Acesse o link abaixo para ler o artigo completo no PubMed.";
  }
  const abs = article.abstract;
  const sentences = abs.split(/\.\s+/).filter(s => s.length > 20);
  const intro = sentences[0] || abs.substring(0, 200);
  const body = sentences.slice(1, Math.min(sentences.length - 1, 5)).join(". ");
  const conclusion = sentences[sentences.length - 1] || "";
  return intro + (body ? ". " + body : "") + (conclusion && conclusion !== intro ? ". " + conclusion : "") + ".";
}

// ─── Build email HTML ──────────────────────────────────────────────────────
function buildEmail(user, article, tema) {
  const pubmedUrl = "https://pubmed.ncbi.nlm.nih.gov/" + article.pmid + "/";
  const summary = generateSummary(article, user.especialidade, tema);
  const firstName = user.nome.split(" ")[0];

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Inter,Helvetica,Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:24px 16px;">

  <!-- Header -->
  <div style="background:#0b1120;border-radius:16px 16px 0 0;padding:28px 32px;text-align:center;">
    <span style="font-size:1.4rem;font-weight:800;background:linear-gradient(135deg,#0ea5e9,#06b6d4);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">OdontoFeed</span>
    <p style="color:#94a3b8;font-size:0.78rem;margin:6px 0 0;letter-spacing:1px;text-transform:uppercase;">Artigo do Dia · ${new Date().toLocaleDateString("pt-BR",{weekday:"long",day:"numeric",month:"long"})}</p>
  </div>

  <!-- Body -->
  <div style="background:#ffffff;padding:32px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
    <p style="color:#64748b;font-size:0.9rem;margin:0 0 20px;">Ol\u00e1, <strong style="color:#0f172a;">${firstName}</strong>! Seu artigo di\u00e1rio de <strong style="color:#0ea5e9;">${user.especialidade}</strong> chegou.</p>

    <!-- Tema badge -->
    <div style="margin-bottom:20px;">
      <span style="background:#eff6ff;color:#0ea5e9;border:1px solid #bfdbfe;padding:5px 14px;border-radius:999px;font-size:0.78rem;font-weight:600;">${tema}</span>
    </div>

    <!-- Title -->
    <h1 style="font-size:1.15rem;font-weight:800;color:#0f172a;line-height:1.4;margin:0 0 20px;">${article.title}</h1>

    <!-- Meta -->
    <div style="background:#f8fafc;border-radius:10px;padding:14px 18px;margin-bottom:24px;font-size:0.82rem;color:#64748b;">
      <span style="margin-right:16px;">\u{1F4DA} <strong>${article.journal}</strong></span>
      <span style="margin-right:16px;">\u{1F4C5} ${article.year}</span>
      <span>\u{1F465} ${article.authors}</span>
    </div>

    <!-- Summary -->
    <div style="border-left:3px solid #0ea5e9;padding-left:18px;margin-bottom:28px;">
      <p style="font-size:0.78rem;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#0ea5e9;margin:0 0 10px;">Resumo</p>
      <p style="color:#334155;font-size:0.9rem;line-height:1.75;margin:0;">${summary}</p>
    </div>

    <!-- CTA -->
    <div style="text-align:center;margin-bottom:8px;">
      <a href="${pubmedUrl}" style="display:inline-block;background:linear-gradient(135deg,#0ea5e9,#06b6d4);color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:700;font-size:0.95rem;">Ler artigo completo no PubMed \u2192</a>
    </div>
    <p style="text-align:center;color:#94a3b8;font-size:0.78rem;margin-top:12px;">PMID: ${article.pmid}</p>
  </div>

  <!-- Footer -->
  <div style="background:#0b1120;border-radius:0 0 16px 16px;padding:20px 32px;text-align:center;">
    <p style="color:#475569;font-size:0.78rem;margin:0;">OdontoFeed &mdash; Ci\u00eancia odontol\u00f3gica direto para voc\u00ea</p>
    <p style="color:#334155;font-size:0.72rem;margin:6px 0 0;">Para cancelar o recebimento, responda este email com "cancelar".</p>
  </div>

</div>
</body>
</html>`;
}

// ─── Send email ────────────────────────────────────────────────────────────
async function sendEmail(resendKey, to, subject, html) {
  const payload = JSON.stringify({ from: "OdontoFeed <artigos@odontofeed.com>", to, subject, html });
  return request({
    hostname: "api.resend.com", path: "/emails", method: "POST",
    headers: {
      "Authorization": "Bearer " + resendKey,
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(payload)
    }
  }, payload);
}

// ─── Main handler (Netlify Scheduled Function) ─────────────────────────────
exports.handler = async function(event) {
  console.log("OdontoFeed daily dispatch started:", new Date().toISOString());

  const projectId = process.env.FIREBASE_PROJECT_ID || "orthoradar";
  const apiKey = process.env.FIREBASE_API_KEY;
  const resendKey = process.env.RESEND_API_KEY;

  if (!apiKey || !resendKey) {
    console.error("Missing env vars: FIREBASE_API_KEY or RESEND_API_KEY");
    return { statusCode: 500, body: "Missing env vars" };
  }

  // 1. Get all active users
  const users = await getUsers(projectId, apiKey);
  console.log("Users found:", users.length);

  let sent = 0;
  let errors = 0;

  for (const user of users) {
    try {
      const temas = user.temas.split(",").map(t => t.trim()).filter(Boolean);
      if (temas.length === 0) { console.log("No themes for", user.email); continue; }

      // Pick a random tema for today
      const tema = temas[Math.floor(Math.random() * temas.length)];
      const query = tema + " " + user.especialidade + " dentistry";

      // 2. Search PubMed
      const article = await searchPubMed(query);
      if (!article) { console.log("No article found for", tema); errors++; continue; }

      console.log("Article found for", user.email, ":", article.title.substring(0, 60));

      // 3. Build and send email
      const html = buildEmail(user, article, tema);
      const subject = "\u{1F9EA} " + article.title.substring(0, 70) + (article.title.length > 70 ? "..." : "");
      const emailRes = await sendEmail(resendKey, user.email, subject, html);

      if (emailRes.status === 200 || emailRes.status === 201) {
        console.log("Email sent to", user.email);
        sent++;
      } else {
        console.error("Email error for", user.email, emailRes.status, emailRes.body.substring(0, 100));
        errors++;
      }

      // Rate limit: wait 500ms between emails
      await new Promise(r => setTimeout(r, 500));

    } catch (err) {
      console.error("Error processing user", user.email, err.message);
      errors++;
    }
  }

  const result = { sent, errors, total: users.length, timestamp: new Date().toISOString() };
  console.log("Daily dispatch complete:", result);
  return { statusCode: 200, body: JSON.stringify(result) };
};
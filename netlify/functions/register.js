const https = require("https");

function httpsRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (c) => { data += c; });
      res.on("end", () => resolve({ status: res.statusCode, body: data }));
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

exports.handler = async function(event) {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: cors, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: cors, body: JSON.stringify({ error: "Method not allowed" }) };

  try {
    const { name, email, especialidade, temas } = JSON.parse(event.body || "{}");
    if (!name || !email || !especialidade) {
      return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "Campos obrigatorios: name, email, especialidade" }) };
    }

    const projectId = process.env.FIREBASE_PROJECT_ID || "orthoradar";
    const apiKey = process.env.FIREBASE_API_KEY;

    // Firestore document fields
    const temasStr = Array.isArray(temas) ? temas.join(", ") : (temas || "");
    function fsVal(val) {
      if (typeof val === "boolean") return { booleanValue: val };
      return { stringValue: String(val) };
    }
    const fields = {
      nome: fsVal(name),
      email: fsVal(email),
      especialidade: fsVal(especialidade),
      temas: fsVal(temasStr),
      dataCadastro: fsVal(new Date().toISOString()),
      ativo: fsVal(true)
    };

    const docId = email.replace(/[^a-zA-Z0-9]/g, "_") + "_" + Date.now();
    const fsBody = JSON.stringify({ fields });
    const path = "/v1/projects/" + projectId + "/databases/(default)/documents/cadastros?documentId=" + docId + (apiKey ? "&key=" + apiKey : "");

    const fsResult = await httpsRequest({
      hostname: "firestore.googleapis.com",
      path,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(fsBody)
      }
    }, fsBody);

    console.log("Firestore response:", fsResult.status, fsResult.body.substring(0, 200));

    // Send welcome email via Resend
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      const temasHtml = Array.isArray(temas) ? temas.map(t => '<span style="display:inline-block;background:rgba(14,165,233,0.15);color:#0ea5e9;padding:4px 12px;border-radius:999px;font-size:0.82rem;margin:3px;">' + t + '</span>').join("") : temasStr;
      const emailHtml = '<div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;background:#0b1120;color:#f1f5f9;padding:40px;border-radius:16px;">' +
        '<div style="margin-bottom:24px;"><span style="background:linear-gradient(135deg,#0ea5e9,#06b6d4);-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-size:1.5rem;font-weight:800;">OdontoFeed</span></div>' +
        '<h1 style="font-size:1.6rem;font-weight:800;margin-bottom:8px;">Bem-vindo, ' + name.split(" ")[0] + '!</h1>' +
        '<p style="color:#94a3b8;margin-bottom:28px;">Seu cadastro foi realizado com sucesso. A partir de amanha voce comecara a receber artigos cientificos diretamente no seu email.</p>' +
        '<div style="background:#1e2d45;border:1px solid #2a3f5f;border-radius:12px;padding:24px;margin-bottom:24px;">' +
        '<p style="margin:0 0 6px;font-size:0.8rem;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;">Sua especialidade</p>' +
        '<p style="color:#0ea5e9;font-size:1.1rem;font-weight:700;margin:0 0 16px;">' + especialidade + '</p>' +
        '<p style="margin:0 0 10px;font-size:0.8rem;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;">Temas selecionados</p>' +
        '<div>' + temasHtml + '</div></div>' +
        '<p style="color:#94a3b8;font-size:0.9rem;line-height:1.7;">Todo dia voce recebera 1 artigo curado do PubMed com resumo detalhado em portugues, objetivos, metodologia e aplicacao clinica pratica.</p>' +
        '<div style="margin-top:32px;padding-top:24px;border-top:1px solid #2a3f5f;"><p style="color:#475569;font-size:0.8rem;margin:0;">OdontoFeed &mdash; Ciencia odontologica direto para voce<br>Para cancelar, responda este email com "cancelar".</p></div></div>';

      const emailPayload = JSON.stringify({
        from: "OdontoFeed <artigos@odontofeed.com>",
        to: email,
        subject: "Bem-vindo ao OdontoFeed! Seu primeiro artigo chega amanha",
        html: emailHtml
      });

      const emailResult = await httpsRequest({
        hostname: "api.resend.com",
        path: "/emails",
        method: "POST",
        headers: {
          "Authorization": "Bearer " + resendKey,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(emailPayload)
        }
      }, emailPayload);

      console.log("Email result:", emailResult.status);
    }

    if (fsResult.status === 200 || fsResult.status === 201) {
      return { statusCode: 200, headers: cors, body: JSON.stringify({ success: true }) };
    } else {
      return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "Firestore error", status: fsResult.status }) };
    }

  } catch (err) {
    console.error("Error:", err.message);
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: err.message }) };
  }
};
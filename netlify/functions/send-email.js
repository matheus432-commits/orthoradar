const https = require("https");

exports.handler = async function (event) {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
      body: "",
    };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }
  const apiKey = process.env.RESEND_API_KEY;
  const { to, subject, html } = JSON.parse(event.body);
  const data = JSON.stringify({
    from: "OdontoFeed <artigos@odontofeed.com>",
    to,
    subject,
    html,
  });
  return new Promise((resolve) => {
    const options = {
      hostname: "api.resend.com",
      path: "/emails",
      method: "POST",
      headers: {
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(data),
      },
    };
    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", (c) => { body += c; });
      res.on("end", () => {
        resolve({
          statusCode: res.statusCode,
          headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
          body,
        });
      });
    });
    req.on("error", (e) => {
      resolve({ statusCode: 500, body: JSON.stringify({ error: e.message }) });
    });
    req.write(data);
    req.end();
  });
};
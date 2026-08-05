// Netlify Function: proxies requests to Google's Gemini API (free tier,
// no credit card required) so the API key never touches the browser.
//
// Setup:
// 1. Go to https://aistudio.google.com/apikey — sign in with a Google
//    account, click "Create API key". No billing, no credit card.
// 2. In Netlify: Site configuration > Environment variables > Add a variable
//    named GEMINI_API_KEY with that key as the value.
// 3. Deploy — the app already calls "/.netlify/functions/ai" instead of
//    calling Google directly, so nothing else to wire up.
//
// Free tier limits (subject to change on Google's side): roughly
// 10-15 requests per minute and several hundred per day on the Flash
// model — plenty for a personal app like this one. If you ever outgrow
// it, Google's paid tier is also far cheaper than most alternatives.
//
// To test locally before deploying: install the Netlify CLI
// (npm install -g netlify-cli), run `netlify dev` from the project folder,
// and create a local .env file with GEMINI_API_KEY=... in it
// (never commit that file).

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "GEMINI_API_KEY isn't set in Netlify's environment variables yet." })
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid request body" }) };
  }

  const prompt = payload.prompt || "";
  const image = payload.image; // optional: { mimeType, data } where data is base64 (no prefix)

  const parts = [{ text: prompt }];
  if (image && image.data && image.mimeType) {
    parts.push({ inlineData: { mimeType: image.mimeType, data: image.data } });
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }]
        })
      }
    );

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("") || "";

    if (!response.ok) {
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: data?.error?.message || "Gemini API error" })
      };
    }

    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text })
    };
  } catch (e) {
    return {
      statusCode: 502,
      body: JSON.stringify({ error: "Couldn't reach Gemini's API", detail: String(e) })
    };
  }
};

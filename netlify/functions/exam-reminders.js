// Netlify Scheduled Function: sends exam-countdown push notifications.
//
// Runs once a day (see the schedule in netlify.toml), reads every learner's
// exam reminders from Firestore and pushes to their devices when an exam is
// 7, 2 or 1 days away. Unlike notifyUser() in index.html, these reach a
// learner whose app is closed.
//
// Setup:
// 1. Firebase console > Project settings > Cloud Messaging > Web Push
//    certificates > Generate key pair. Paste that key into FCM_VAPID_KEY in
//    index.html (it is a public key, safe to commit).
// 2. Firebase console > Project settings > Service accounts > Generate new
//    private key. That downloads a JSON file.
// 3. Netlify: Site configuration > Environment variables > add
//    FIREBASE_SERVICE_ACCOUNT with the whole contents of that JSON file as the
//    value. Never commit it.
//
// No npm dependencies: the service account is exchanged for an access token
// with a hand-rolled JWT, then Firestore and FCM are called over REST.

const crypto = require("crypto");

const SCOPES = [
  "https://www.googleapis.com/auth/datastore",
  "https://www.googleapis.com/auth/firebase.messaging"
].join(" ");

/* Days before an exam that are worth a nudge. */
const NUDGE_DAYS = [7, 3, 2, 1];

function base64url(input) {
  return Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function getAccessToken(account) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64url(JSON.stringify({
    iss: account.client_email,
    scope: SCOPES,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  }));
  const signature = crypto
    .createSign("RSA-SHA256")
    .update(`${header}.${claim}`)
    .sign(account.private_key.replace(/\\n/g, "\n"), "base64")
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claim}.${signature}`
    })
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Token exchange failed: ${body.error_description || res.status}`);
  return body.access_token;
}

/* Firestore REST wraps every value in a type tag; unwrap it back to plain JS. */
function decode(value) {
  if (value === undefined || value === null) return null;
  if ("nullValue" in value) return null;
  if ("stringValue" in value) return value.stringValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("timestampValue" in value) return value.timestampValue;
  if ("arrayValue" in value) return (value.arrayValue.values || []).map(decode);
  if ("mapValue" in value) return decodeFields(value.mapValue.fields || {});
  return null;
}

function decodeFields(fields) {
  const out = {};
  for (const key of Object.keys(fields)) out[key] = decode(fields[key]);
  return out;
}

async function listUsers(projectId, token) {
  const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users`;
  const users = [];
  let pageToken = "";
  do {
    const url = `${base}?pageSize=300${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`;
    const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
    const body = await res.json();
    if (!res.ok) throw new Error(`Firestore list failed: ${body.error?.message || res.status}`);
    for (const document of body.documents || []) {
      users.push({
        uid: document.name.split("/").pop(),
        ...decodeFields(document.fields || {})
      });
    }
    pageToken = body.nextPageToken || "";
  } while (pageToken);
  return users;
}

/* "Today" has to be resolved in the learner's own timezone, or someone in
   Johannesburg gets "tomorrow" nudges a day early. */
function todayIn(timeZone) {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
  } catch (e) {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg" }).format(new Date());
  }
}

function daysBetween(fromDate, toDate) {
  const a = Date.parse(`${fromDate}T00:00:00Z`);
  const b = Date.parse(`${toDate}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86400000);
}

function wording(subject, days) {
  if (days === 1) {
    return {
      title: `${subject} is tomorrow`,
      body: "One focused review tonight — go over your flashcards and past paper mistakes."
    };
  }
  if (days === 2) {
    return {
      title: `${subject} in 2 days`,
      body: "Time for final revision. Open your deck and run through the tricky cards."
    };
  }
  if (days === 3) {
    return {
      title: `${subject} in 3 days`,
      body: "Three days out — tackle the topics you've been avoiding while you still can."
    };
  }
  return {
    title: `${subject} in a week`,
    body: "A week to go — start working through past papers while there's still time."
  };
}

async function sendPush(projectId, token, deviceToken, message) {
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      message: {
        token: deviceToken,
        // Data-only: sw.js decides how the notification looks.
        data: { title: message.title, body: message.body, url: "./", tag: message.tag },
        webpush: { headers: { Urgency: "high", TTL: "86400" } }
      }
    })
  });
  if (res.ok) return { ok: true };
  const body = await res.json().catch(() => ({}));
  const status = body.error?.details?.[0]?.errorCode || body.error?.status || String(res.status);
  return { ok: false, stale: status === "UNREGISTERED" || status === "INVALID_ARGUMENT" };
}

async function dropTokens(projectId, token, uid, tokens) {
  await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${uid}` +
      `?updateMask.fieldPaths=${encodeURIComponent("push.tokens")}`,
    {
      method: "PATCH",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({
        fields: {
          push: {
            mapValue: {
              fields: { tokens: { arrayValue: { values: tokens.map((t) => ({ stringValue: t })) } } }
            }
          }
        }
      })
    }
  );
}

exports.handler = async () => {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    return { statusCode: 500, body: JSON.stringify({ error: "FIREBASE_SERVICE_ACCOUNT isn't set in Netlify's environment variables yet." }) };
  }

  let account;
  try {
    account = JSON.parse(raw);
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: "FIREBASE_SERVICE_ACCOUNT isn't valid JSON." }) };
  }

  const projectId = account.project_id;

  try {
    const token = await getAccessToken(account);
    const users = await listUsers(projectId, token);

    let sent = 0;
    let pruned = 0;

    for (const user of users) {
      const push = user.push || {};
      const tokens = Array.isArray(push.tokens) ? push.tokens.filter(Boolean) : [];
      if (push.enabled !== true || !tokens.length) continue;

      const reminders = (user.data && user.data.reminders) || [];
      const today = todayIn(push.timeZone || "Africa/Johannesburg");

      const due = reminders
        .map((r) => ({ subject: r.subject, days: daysBetween(today, r.date), id: r.id }))
        .filter((r) => r.subject && NUDGE_DAYS.includes(r.days));
      if (!due.length) continue;

      const stale = new Set();
      for (const exam of due) {
        const message = { ...wording(exam.subject, exam.days), tag: `exam-${exam.id}-${exam.days}` };
        for (const deviceToken of tokens) {
          const result = await sendPush(projectId, token, deviceToken, message);
          if (result.ok) sent++;
          else if (result.stale) stale.add(deviceToken);
        }
      }

      if (stale.size) {
        const remaining = tokens.filter((t) => !stale.has(t));
        await dropTokens(projectId, token, user.uid, remaining);
        pruned += stale.size;
      }
    }

    return { statusCode: 200, body: JSON.stringify({ users: users.length, sent, pruned }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: String(e) }) };
  }
};

# 🔒 Locked Inn

**An AI-powered study companion built for South African high school and primary school learners.**

Locked Inn helps students study smarter — turning any topic into instant flashcards, answering questions through a conversational AI tutor, and keeping learners focused with exam countdowns and a clean, motivating interface.

🔗 **Live app:** lockedinn.co.za

---

## ✨ Features

- **AI Flashcard Generation** — learners enter a topic and get study-ready flashcards generated on the fly
- **Conversational AI Tutor** — an in-app tutor that answers questions and explains concepts in plain language
- **Exam Countdown Timers** — visual countdowns to keep learners aware of what's coming and when
- **Secure Sign-up / Login** — authentication gate so each learner has their own space
- **Bold, modern UI** — deep cosmic purple, chrome animations, and electric-lime accents designed to feel energetic rather than academic-boring

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | JavaScript, HTML5, CSS3 |
| Authentication & Data | Firebase |
| AI | Google Gemini API |
| Hosting & Deployment | Netlify |
| PWA | Service Worker (`sw.js`) for offline-ready behaviour |

---

## 🧠 How the AI Works

Locked Inn calls the **Google Gemini API** to power two features:

1. **Flashcards** — a topic prompt is sent to the model, which returns structured question/answer pairs mapped to the flashcard UI.
2. **Tutor** — a conversational endpoint that takes learner questions and returns clear, age-appropriate explanations.

The Gemini API key is stored securely as an environment variable (`GEMINI_API_KEY`) in Netlify — never committed to the repo.

---

## 🔐 Security Notes

- The Firebase `apiKey` in the client is a **public web configuration key** (by design — Firebase web keys identify the project, they don't grant access). Data access is controlled by Firebase Security Rules.
- No secret keys, service-account credentials, or `.env` files are committed to this repository.

---

## 🚀 Getting Started (Local)

```bash
# Clone the repo
git clone https://github.com/multi2editor/locked-inn-app.git

# Open the project
cd locked-inn-app

# Serve locally (any static server works, e.g.)
npx serve .
```

To run the AI features locally, add your own `GEMINI_API_KEY` as an environment variable.

---


---

## 👤 Author

Built by **Nomvelo Thabethe** — freelance web developer & designer based in Durban, South Africa.

Building practical, locally-relevant web products — from education tools to SaaS for schools.

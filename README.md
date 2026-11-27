# F.R.I.D.A.Y. — Browser HUD assistant

A Japanese-speaking F.R.I.D.A.Y.-inspired assistant with an amber HUD, browser speech input/output, and Groq chat completions. The Groq API key stays on the Flask server.

## Project structure

```text
.
├── .env.example
├── .gitignore
├── app.py
├── requirements.txt
└── static/
    ├── app.js
    ├── index.html
    └── styles.css
```

## Setup (GitHub Codespaces)

Python 3.10+ is required.

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Set `GROQ_API_KEY` in `.env` to your Groq API key. Never put the key in `static/` or commit `.env`. The default model is `llama-3.1-8b-instant`; optionally change `GROQ_MODEL` to `llama-3.3-70b-versatile`.

Run the app:

```bash
python app.py
```

In Codespaces, open the **Ports** tab, forward port **5000** if needed, and open its HTTPS forwarded URL in a Chromium-based browser. Microphone and speech features require a secure context; the Codespaces HTTPS URL provides one. Allow microphone access when prompted.

## Use

- Type a message and press **Send** or Enter.
- Press the microphone button and speak. Say “フライデー” or “Friday” before a command if desired; the wake word is removed before sending.
- Use **Voice** to toggle spoken replies. Speech recognition and speech synthesis availability depends on the browser and its language support.
- Chat history is held in this browser tab's `sessionStorage`.

## Configuration

| Variable | Default | Description |
| --- | --- | --- |
| `GROQ_API_KEY` | — | Required Groq API key |
| `GROQ_MODEL` | `llama-3.1-8b-instant` | Groq chat completion model |
| `PORT` | `5000` | HTTP port |
| `FLASK_DEBUG` | `false` | Enable Flask debug mode for local development only |

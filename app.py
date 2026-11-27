import os

from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_from_directory
from groq import APIError, Groq

load_dotenv()

app = Flask(__name__, static_folder="static")
app.config["MAX_CONTENT_LENGTH"] = 1024 * 1024

SYSTEM_PROMPT = """You are F.R.I.D.A.Y., a highly capable, calm, intelligent AI assistant.
Respond primarily in Japanese, address the user as 「ボス」 (Boss), and keep replies concise and brisk.
Occasionally add a light Irish-English expression such as “Well then” or “Aye”, but do not overdo it.
Use subtle, dry humor when appropriate. Be clear, helpful, and honest about uncertainty.
"""
ALLOWED_MODELS = {"llama-3.1-8b-instant", "llama-3.3-70b-versatile"}


@app.get("/")
def home():
    return send_from_directory(app.static_folder, "index.html")


@app.get("/api/health")
def health():
    return jsonify({"status": "ok"})


@app.post("/api/chat")
def chat():
    api_key = os.getenv("GROQ_API_KEY", "").strip()
    if not api_key or api_key == "your_groq_api_key_here":
        return jsonify({"error": "サーバーに GROQ_API_KEY が設定されていません。"}), 503

    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "JSON形式のリクエストが必要です。"}), 400

    incoming = data.get("messages")
    if not isinstance(incoming, list) or not incoming:
        return jsonify({"error": "会話メッセージが必要です。"}), 400

    # Keep only recent user/assistant messages; the system prompt is always server-controlled.
    messages = []
    for item in incoming[-20:]:
        if not isinstance(item, dict):
            continue
        role = item.get("role")
        content = item.get("content")
        if role not in {"user", "assistant"} or not isinstance(content, str):
            continue
        content = content.strip()
        if content:
            messages.append({"role": role, "content": content[:8000]})

    if not messages or messages[-1]["role"] != "user":
        return jsonify({"error": "最後のメッセージはユーザーの発言である必要があります。"}), 400

    model = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant").strip()
    if model not in ALLOWED_MODELS:
        return jsonify({"error": "GROQ_MODEL はサポート対象のモデルを指定してください。"}), 500

    try:
        client = Groq(api_key=api_key)
        completion = client.chat.completions.create(
            model=model,
            messages=[{"role": "system", "content": SYSTEM_PROMPT}, *messages],
            temperature=0.7,
            max_tokens=700,
        )
    except APIError:
        app.logger.exception("Groq API request failed")
        return jsonify({"error": "Groq APIへの接続に失敗しました。設定と接続を確認してください。"}), 502

    reply = completion.choices[0].message.content
    if not reply:
        return jsonify({"error": "AIから空の応答が返されました。もう一度お試しください。"}), 502
    return jsonify({"reply": reply})


if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    debug = os.getenv("FLASK_DEBUG", "false").lower() == "true"
    app.run(host="0.0.0.0", port=port, debug=debug)

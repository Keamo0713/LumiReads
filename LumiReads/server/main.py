from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
import io
import requests
import os
import fitz  # PyMuPDF
import base64 # Import base64

app = FastAPI()

# Allow all origins (adjust in production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Keys and Model
GEMINI_API_KEY = "AIzaSyDz2Au-LYj909Q_YFP_f0mdGV9GzzNfw_4"
GEMINI_MODEL = "models/gemini-2.5-pro"
ELEVENLABS_API_KEY = "sk_b1f590a169fef6027c7268a78f2db2d9d118ae2cd5680964"
ELEVENLABS_VOICE_ID = "TX3LPaxmHKxFdv7VOQHJ"  # Your ElevenLabs voice ID

# ----- Helper Functions -----

def extract_text(file: UploadFile) -> str:
    ext = os.path.splitext(file.filename)[-1].lower()
    if ext == ".pdf":
        doc = fitz.open(stream=file.file.read(), filetype="pdf")
        return "".join(page.get_text() for page in doc)
    return file.file.read().decode("utf-8")

def summarize_with_gemini(text: str, language: str = "en") -> str:
    url = f"https://generativelanguage.googleapis.com/v1/{GEMINI_MODEL}:generateContent"
    headers = {"Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY}
    body = {
        "contents": [
            {"parts": [{"text": f"Summarize this story in {language}:\n{text}"}]}
        ]
    }
    res = requests.post(url, headers=headers, json=body)
    try:
        return res.json()["candidates"][0]["content"]["parts"][0]["text"]
    except Exception:
        print("Gemini response error:", res.text)
        return "Failed to summarize."

def generate_audio(summary: str, voice=ELEVENLABS_VOICE_ID) -> bytes:
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice}"
    headers = {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json"
    }
    body = {
        "text": summary,
        "model_id": "eleven_monolingual_v1",
        "voice_settings": {"stability": 0.5, "similarity_boost": 0.5}
    }
    res = requests.post(url, json=body, headers=headers)
    if res.status_code == 200:
        return res.content
    else:
        print("ElevenLabs TTS error:", res.status_code, res.text)
        return None

# ----- API Endpoints -----

@app.post("/summarize")
async def summarize(file: UploadFile = File(...), language: str = Form("en")):
    try:
        text = extract_text(file)
        if not text.strip():
            return JSONResponse(content={"summary": "No text found in file."}, status_code=400)

        summary = summarize_with_gemini(text, language)
        audio_content = generate_audio(summary)

        response_content = {"summary": summary}
        if audio_content:
            response_content["audio"] = base64.b64encode(audio_content).decode('utf-8')
        else:
            response_content["audio"] = None # Indicate audio generation failed

        return JSONResponse(content=response_content)

    except Exception as e:
        print("Summarize error:", e)
        return JSONResponse(content={"summary": "An error occurred during processing."}, status_code=500)

@app.get("/search_book")
def search_book(title: str):
    url = f"https://openlibrary.org/search.json?title={title}"
    res = requests.get(url)
    data = res.json()
    return [
        {
            "title": doc.get("title"),
            "author": doc.get("author_name", ["Unknown"])[0],
            "key": doc.get("key"),
            "cover_i": doc.get("cover_i")
        }
        for doc in data.get("docs", [])[:10]
    ]

@app.post("/summarize_book")
def summarize_book(book_key: str = Form(...), language: str = Form("en")):
    try:
        url = f"https://openlibrary.org{book_key}.json"
        res = requests.get(url)

        if res.status_code != 200:
            return JSONResponse(content={"summary": "Failed to fetch book data."}, status_code=400)

        book = res.json()
        description = book.get("description", "")
        if isinstance(description, dict):
            description = description.get("value", "")

        if not description.strip():
            return JSONResponse(content={"summary": "No description found for this book."}) # Ensure JSONResponse

        summary = summarize_with_gemini(description, language)
        audio_content = generate_audio(summary)

        response_content = {"summary": summary}
        if audio_content:
            response_content["audio"] = base64.b64encode(audio_content).decode('utf-8')
        else:
            response_content["audio"] = None # Indicate audio generation failed

        return JSONResponse(content=response_content)

    except Exception as e:
        print("Book summarization error:", e)
        return JSONResponse(content={"summary": "Failed to summarize the book."}, status_code=500)
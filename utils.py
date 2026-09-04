import os
from dotenv import load_dotenv

load_dotenv()

GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")

# ---- Lazy client init so a missing key for ONE provider doesn't crash the whole app ----
_groq_client = None
_gemini_client = None


def _get_groq_client():
    global _groq_client
    if _groq_client is None:
        if not GROQ_API_KEY:
            raise RuntimeError("GROQ_API_KEY not set — check your .env file")
        from groq import Groq
        _groq_client = Groq(api_key=GROQ_API_KEY)
    return _groq_client


def _get_gemini_client():
    global _gemini_client
    if _gemini_client is None:
        if not GEMINI_API_KEY:
            raise RuntimeError("GEMINI_API_KEY not set — check your .env file")
        from google import genai
        _gemini_client = genai.Client(api_key=GEMINI_API_KEY)
    return _gemini_client


SYSTEM_PROMPT = (
    "You are a specialized clinical decision-support AI for neonatal care. "
    "You are NOT an autonomous diagnostic system — you support, you do not replace, "
    "clinician judgment. Never state a finding with more certainty than the given "
    "confidence score warrants, and never issue a diagnosis different from the "
    "provided classification result."
)


def _build_prompt(prediction_class: str, confidence: float, rag_context: str = "") -> str:
    """
    Builds the report-generation prompt. rag_context is optional — pass retrieved
    clinical knowledge-base snippets here once the RAG layer is wired in.
    """
    context_block = f"\nRelevant clinical context:\n{rag_context}\n" if rag_context else ""
    return f"""
Act as an expert NICU Clinical Decision Support AI.

Analysis Result: {prediction_class} ({confidence * 100:.1f}% confidence).
{context_block}
Provide a concise clinical report containing:
1. Summary of findings.
2. Potential neonatal interpretations.
3. Recommended cardiorespiratory monitoring steps.
4. A clear disclaimer that this is decision support only, not an autonomous
   diagnosis, and clinician confirmation is required.

Keep it professional, structured, and objective. Do not state a diagnosis with
more certainty than the given confidence score warrants.
""".strip()


def generate_clinical_report_stream(
    prediction_class: str,
    confidence: float,
    rag_context: str = "",
    provider: str = "groq",
):
    """
    Generates a streaming clinical report.
    provider: "groq" (default, fast) or "gemini" (fallback if Groq is rate-limited
    or unavailable). Both yield text chunks with the same interface, so app.py
    doesn't need to change based on which provider is used.
    """
    prompt = _build_prompt(prediction_class, confidence, rag_context)

    if provider == "groq":
        yield from _stream_groq(prompt)
    elif provider == "gemini":
        yield from _stream_gemini(prompt)
    else:
        yield f"\n\n*Unknown provider '{provider}'*"


def _stream_groq(prompt: str):
    # Try active Groq model list
    groq_models = ["groq/compound", "openai/gpt-oss-120b", "qwen/qwen3.6-27b"]
    client = None
    try:
        client = _get_groq_client()
    except Exception as e:
        yield f"\n\n*Error initializing Groq client: {e}*\n\n*Retrying with Gemini fallback...*\n\n"
        yield from _stream_gemini(prompt)
        return

    for model_name in groq_models:
        try:
            stream = client.chat.completions.create(
                model=model_name,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
                stream=True,
            )
            for chunk in stream:
                if chunk.choices[0].delta.content is not None:
                    yield chunk.choices[0].delta.content
            return  # Success!
        except Exception:
            continue

    # Fallback to Gemini if Groq models fail
    yield from _stream_gemini(prompt)


def _stream_gemini(prompt: str):
    gemini_models = ["gemini-2.5-flash", "gemini-2.5-flash", "gemini-3.6-flash"]
    client = None
    try:
        client = _get_gemini_client()
    except Exception as e:
        yield f"\n\n*Error connecting to Gemini API: {e}*"
        return

    for g_model in gemini_models:
        try:
            stream = client.models.generate_content_stream(
                model=g_model,
                contents=f"{SYSTEM_PROMPT}\n\n{prompt}",
            )
            for chunk in stream:
                if chunk.text:
                    yield chunk.text
            return  # Success!
        except Exception:
            continue

    yield "\n\n*Unable to generate report: All LLM models unavailable.*"


def generate_clinical_report(prediction_class: str, confidence: float, rag_context: str = "", provider: str = "groq") -> str:
    """Helper to return full string clinical report synchronously."""
    return "".join(list(generate_clinical_report_stream(prediction_class, confidence, rag_context, provider)))

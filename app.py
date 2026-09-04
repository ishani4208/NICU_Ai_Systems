import streamlit as st
import os
import sys
from PIL import Image

# Ensure UTF-8 output encoding
sys.stdout.reconfigure(encoding='utf-8')

from inference import NICUClassifier
from utils import generate_clinical_report_stream, generate_clinical_report

# --- Streamlit Page Configuration ---
st.set_page_config(
    page_title="NeoListen AI | NICU Respiratory Diagnostic System",
    page_icon="🫁",
    layout="wide",
    initial_sidebar_state="expanded"
)

# --- Custom CSS for Modern Clinical Dark Theme ---
st.markdown("""
<style>
    /* Dark Theme Custom Palette */
    .stApp {
        background-color: #0b0f19;
        color: #e2e8f0;
    }
    .main-header {
        background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
        padding: 24px;
        border-radius: 16px;
        border: 1px solid #334155;
        margin-bottom: 24px;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
    }
    .title-text {
        font-family: 'Inter', sans-serif;
        font-size: 2.2rem;
        font-weight: 800;
        background: linear-gradient(90deg, #38bdf8 0%, #818cf8 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin: 0;
    }
    .subtitle-text {
        color: #94a3b8;
        font-size: 1.05rem;
        margin-top: 6px;
    }
    .metric-card {
        background: #1e293b;
        border-radius: 12px;
        padding: 20px;
        border: 1px solid #334155;
        text-align: center;
    }
    .badge-normal {
        background-color: #065f46;
        color: #34d399;
        padding: 6px 16px;
        border-radius: 20px;
        font-weight: 700;
        font-size: 1.2rem;
        display: inline-block;
    }
    .badge-wheeze {
        background-color: #881337;
        color: #fb7185;
        padding: 6px 16px;
        border-radius: 20px;
        font-weight: 700;
        font-size: 1.2rem;
        display: inline-block;
    }
    .badge-crackle {
        background-color: #78350f;
        color: #fbbf24;
        padding: 6px 16px;
        border-radius: 20px;
        font-weight: 700;
        font-size: 1.2rem;
        display: inline-block;
    }
    .report-box {
        background: #1e293b;
        border-radius: 12px;
        padding: 24px;
        border: 1px solid #334155;
        line-height: 1.6;
    }
</style>
""", unsafe_allow_html=True)

# --- Cache Model Classifier Init ---
@st.cache_resource
def load_classifier():
    return NICUClassifier("resnet18_nicu.pth")

try:
    classifier = load_classifier()
except Exception as e:
    st.error(f"Error loading model weights `resnet18_nicu.pth`: {e}")
    st.stop()

# --- Header ---
st.markdown("""
<div class="main-header">
    <div class="title-text">🫁 NeoListen AI System</div>
    <div class="subtitle-text">Neonatal Intensive Care Unit (NICU) Respiratory Sound Classifier & Decision Support Engine</div>
</div>
""", unsafe_allow_html=True)

# --- Sidebar Inputs ---
st.sidebar.header("📁 Audio Input & Controls")

input_mode = st.sidebar.radio(
    "Choose Audio Input Method:",
    ["Preset Demo Samples", "Upload Custom Audio File"]
)

audio_file_path = None

if input_mode == "Preset Demo Samples":
    sample_choice = st.sidebar.selectbox(
        "Select Demo Recording:",
        ["sample_wheeze.wav (Wheeze Recording)", "sample_normal.wav (Normal Recording)", "sample_crackle.wav (Crackle Recording)"]
    )
    if "sample_wheeze" in sample_choice:
        audio_file_path = "demo_samples/sample_wheeze.wav"
    elif "sample_normal" in sample_choice:
        audio_file_path = "demo_samples/sample_normal.wav"
    else:
        audio_file_path = "demo_samples/sample_crackle.wav"

else:
    uploaded_file = st.sidebar.file_uploader("Upload `.wav` audio recording:", type=["wav", "mp3"])
    if uploaded_file is not None:
        os.makedirs("temp_uploads", exist_ok=True)
        audio_file_path = os.path.join("temp_uploads", uploaded_file.name)
        with open(audio_file_path, "wb") as f:
            f.write(uploaded_file.getbuffer())

st.sidebar.divider()
st.sidebar.header("⚙️ Clinical Report Settings")
provider = st.sidebar.selectbox("LLM Report Provider:", ["groq", "gemini"])
rag_context = st.sidebar.text_area("Optional RAG Clinical Context:", "", placeholder="Enter patient history or clinical notes...")

# --- Main Layout ---
if audio_file_path and os.path.exists(audio_file_path):
    col1, col2 = st.columns([1, 1])

    with col1:
        st.subheader("🔊 Audio Signal & Spectrogram")
        st.audio(audio_file_path)

        with st.spinner("Processing Butterworth Bandpass Filter (100Hz - 2000Hz)..."):
            res = classifier.predict(audio_file_path, generate_report=False)

        st.markdown("**Generated Mel-Spectrogram (3-Channel RGB):**")
        if os.path.exists(res["spectrogram_path"]):
            spec_img = Image.open(res["spectrogram_path"])
            st.image(spec_img, use_container_width=True)

    with col2:
        st.subheader("🎯 Diagnostic Classification")

        pred_class = res["predicted_class"]
        conf_pct = res["confidence"] * 100.0

        if pred_class == "Normal":
            badge_html = f'<div class="badge-normal">✅ {pred_class} ({conf_pct:.1f}%)</div>'
        elif pred_class == "Wheeze":
            badge_html = f'<div class="badge-wheeze">⚠️ {pred_class} ({conf_pct:.1f}%)</div>'
        else:
            badge_html = f'<div class="badge-crackle">⚡ {pred_class} ({conf_pct:.1f}%)</div>'

        st.markdown(badge_html, unsafe_allow_html=True)
        st.write("")
        st.progress(min(float(res["confidence"]), 1.0))

        st.markdown("### Class Probability Distribution")
        probs = res["all_probabilities"]
        for cls_name, prob_val in probs.items():
            st.write(f"**{cls_name}**: `{prob_val * 100:.2f}%`")
            st.progress(min(float(prob_val), 1.0))

    st.divider()

    # --- Clinical Decision Support LLM Report ---
    st.subheader("📄 AI Clinical Decision Support Report")

    if st.button("🚀 Generate Clinical Report", type="primary"):
        report_placeholder = st.empty()
        full_report = ""

        with st.spinner("Generating LLM Decision Support Report..."):
            for chunk in generate_clinical_report_stream(pred_class, res["confidence"], rag_context=rag_context, provider=provider):
                full_report += chunk
                report_placeholder.markdown(f'<div class="report-box">{full_report}</div>', unsafe_allow_html=True)

else:
    st.info("👈 Please select a preset demo sound or upload an audio file from the sidebar to begin analysis.")

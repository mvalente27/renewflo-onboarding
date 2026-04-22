"""
Streamlit demo host for the RenewFlo Client Onboarding form.
Run with:  streamlit run app.py
"""
import streamlit as st
import pathlib

st.set_page_config(
    page_title="RenewFlo | Onboarding Demo",
    page_icon="🌊",
    layout="wide",
    initial_sidebar_state="collapsed",
)

# ── Sidebar controls ──────────────────────────────────────────────
with st.sidebar:
    st.title("Demo Controls")
    mode = st.radio(
        "View mode",
        ["Interactive Demo (mock data)", "blank Form (production-ready)"],
        index=0,
    )
    st.divider()
    st.caption("Submissions in demo mode are **simulated** — no files are uploaded.")
    st.caption("Switch to the blank form to preview the real production starting state.")

# ── Load the right HTML file ──────────────────────────────────────
base = pathlib.Path(__file__).parent / "frontend"

if "Demo" in mode:
    html_path = base / "demo.html"
else:
    html_path = base / "index.html"

html_content = html_path.read_text(encoding="utf-8")

# Streamlit's components.html strips the outer <html>/<body> tags,
# so we embed the body content inside a div and preserve all scripts.
st.components.v1.html(html_content, height=1100, scrolling=True)

# 🍱 Canteen IQ: Agentic Decision Support System (DSS)

> **Optimizing Institutional Canteen Inventory via Multi-Agent Systems & Context-Aware Signals.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)
[![Framework: LangGraph](https://img.shields.io/badge/Framework-LangGraph-orange.svg)](https://github.com/langchain-ai/langgraph)

**Canteen IQ** is a context-aware Multi-Agent System (MAS) designed to solve the "Small-Data" inventory problem in institutional canteens. By orchestrating specialized AI agents, the system bridges the gap between historical sales patterns and unstructured campus signals (Academic Calendars, Weather, and Exams).

---

## 🚀 Key Performance Results
Based on a **150-day semester simulation** at PES University:
*   **📉 62.9% Reduction** in Perishable Waste.
*   **🚀 71.5% Reduction** in Stockouts (Service Gain).
*   **🎯 87.7% Forecast Accuracy** compared to Manual Heuristics.
*   **🛡️ 100% Financial Safety Compliance** via MDP Risk Gates.

---

## 🧠 System Architecture
The system uses **LangGraph** to orchestrate four specialized agents in a directed state graph:

1.  **Forecasting Agent (The Quant):** An ensemble model (XGBoost + LightGBM) that provides a base demand prediction.
2.  **Trend Agent (The Scout):** A telemetry node that parses **PESU Academic Calendars** via Tesseract OCR and fetches real-time weather modifiers.
3.  **Risk Agent (The Guard):** A **Markov Decision Process (MDP)** gate that validates orders against a strict 80% liquidity threshold.
4.  **Explanation Agent (The Translator):** A locally-served **Llama 3** (via Ollama) that translates numbers into "Hinglish" and English narratives for the operator.

---

## 🛠️ Tech Stack
*   **Frontend:** Next.js 14, TailwindCSS, Framer Motion (Glassmorphic Dashboard).
*   **Backend:** FastAPI (Python), LangGraph, Pydantic.
*   **ML/AI:** XGBoost, LightGBM, Ollama (Llama 3), Tesseract OCR.
*   **Database:** Supabase (PostgreSQL) with real-time subscriptions.

---

## 📦 Installation & Setup

### 1. Clone the Repository
```bash
git clone https://github.com/JARVIS-28/agentic-canteen-dss.git
cd agentic-canteen-dss
```
### 2. Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python main.py
```
### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

## 📊 Performance Audit
To verify the system's accuracy against the baseline, you can run the built-in audit script:
```bash
python tests/simulation/performance_comparison.py
```

## 📜 Academic Reference
This project was developed as part of a Final Year Internship at PES University.
* **Internal Guide**: Prof. Pranjali Thakre
* **Center**: CoDMAV (Centre for Data Modelling, Analytics and Visualization)

## 📄 License
Distributed under the MIT License. See LICENSE for more information.

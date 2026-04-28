# Research: College Canteen Inventory Decision Support System (DSS) using Multi-Agent Systems (MAS)

This document consolidates research on methodologies, papers, and tools specifically designed for **Small-Data Inventory Environments** (like institutional canteens) using a Multi-Agent System approach.

---

## 1. Methodologies for Small-Data Inventory
When historical data is scarce (e.g., < 1 year of sales), traditional Deep Learning or Reinforcement Learning models are ineffective. Instead, the following methodologies are recommended for the "Bharat-MAS" system:

### **A. ABC-XYZ Matrix Segmenting**
The system should prioritize management effort based on an item's value and predictability:
*   **ABC:** Categorizes products based on their total revenue (A=High, B=Medium, C=Low).
*   **XYZ:** Categorizes products based on demand predictability (X=Stable, Y=Seasonal/Variable, Z=Highly Erratic/Fests).
*   **DSS Interaction:** For "AX" items, use standard forecasting. For "CZ" items (like canteen fests/specials), use **Manual Override** or **Fuzzy Rules**.

### **B. Fuzzy Logic Inference (Rule-Based Reasoning)**
A "Knowledge-Based" agent that mimics the operator's intuition:
*   **Fuzzy Rules:** `IF Demand is "High" AND Event is "Exams" THEN Prediction is "Stimulants/Snacks Boosted"`.
*   **Logic:** It converts vague inputs ("High," "Low," "Urgent") into precise ordering recommendations.

### **C. Bayesian Demand Sensing (The "Better RL" Alternative)**
Calculates the probability of demand. Unlike Reinforcement Learning, which requires a vast number of "trial and error" episodes to learn a policy, Bayesian sensing only needs 3-5 data points to "update" its belief. Every time a sale is recorded, the probability distribution adjusts. This is the **preferred alternative for small-data environments** because:
*   **No Black-Box Rewards:** RL rewards can be unstable in canteens; Bayesian priors are mathematically stable.
*   **Prior Knowledge Integration:** Easily incorporates "Priors" like the Academic Calendar impact before any sales are even recorded.

### **D. Heuristic Rule-based Multi-Agent System**
Instead of a single complex model, use specialized agents with expert-derived SOPs (Standard Operating Procedures).
*   **Auditability:** Every decision (e.g., "Add 20% due to rain") is logged and explainable.
*   **Zero-Shot Deployment:** Operates immediately without the "Training Phase" required by DQN/PPO models.

### **E. Silver-Meal Heuristic**
A classic optimization algorithm for variable demand. It calculates the optimal order quantity to minimize the "Total Cost per Period" (holding cost + setup cost).

---

## 2. Key Research Papers

| Paper Title | Core Contribution | Relevance to Canteen DSS |
| :--- | :--- | :--- |
| **Sales Prediction Based on ML (Yifan Sun, 2024)** | Shows how XOR-fusion of XGBoost and LightGBM models improves MAPE accuracy. | Your current `Forecasting Agent` uses this weighted ensemble logic for stable base predictions. |
| **InvAgent: A LLM-based MAS (2024)** | Shows how LLMs act as Zero-Shot inventory managers via "Reasoning Chains." | Basis for the `Explanation Agent` providing narrative advice to the canteen operator. |
| **Bayesian Sensing for Low-Interaction Retail** | Proves Bayesian priors are superior to RL for sparse data environments. | Replaces the need for complex Reinforcement Learning with stable probabilistic updates. |
| **Inventory Management in SMEs using ABC-VED** | Introduces VED (Vital, Essential, Desirable) ranking. | Ensures "Vital" items (Milk/Tea) never stock out during PES exam weeks. |
| **Agent-Based Simulation for Food Waste** | Uses MAS to match prep-work to external events (Weather/Holidays). | Demonstrates that matching "Daily Prep" to campus events reduces waste by ~25%. |

---

## 3. Alternative MAS Architectures

### **The "Supervisor" Pattern (Recommended Alternative for Bharat-MAS)**
Instead of a linear chain of agents, use a **Hierarchical Supervisor**.
*   **Supervisor (Canteen Master):** Orchestrates and delegates tasks.
*   **Worker Agents:**
    *   **Market Scout:** Fetches external weather and Zomato-style sentiment.
    *   **Historical Forecaster:** Uses small-data statistics to provide a baseline.
    *   **Finance Auditor:** Checks the cash flow/risk constraints.
*   **XAI Advisor:** Translates everyone's data into a simple "Advisor Report."

---

## 4. Relevent Data Sources for the Indian Context

| Data Type | Source / Tool | Why use it? |
| :--- | :--- | :--- |
| **Wholesale Prices** | **Agmarknet / Gov.in** | To track local Mandi prices for fresh produce (Potatoes, Onions) to adjust cost-basis. |
| **Weather** | **IMD (India Meteorological Dept)** | To track heatwaves or heavy rain, which significantly shift student dining habits. |
| **Local Sentiment** | **Zomato Bangalore Dataset** | For pre-trained "Food Intelligence" if your own data is small. |
| **Financial Pulse** | **WPI (Wholesale Price Index)** | National indices for food inflation to keep canteen pricing sustainable. |

---

## 5. Tool Recommendations

*   **Python Libraries:**
    *   `scikit-fuzzy`: For building the knowledge-based reasoning agent.
    *   `Statsmodels`: For "Holt-Winters" triple exponential smoothing (best for small seasonal data).
    *   `LangGraph`: (Currently using) For agentic state management.
    *   `SimPy`: For simulating canteen queues and peak volumes.
*   **Large Language Models (Local/Serverless):**
    *   **Gemma-2-2b-it (Google):** Ultra-lightweight for local reasoning.
    *   **Phi-3-mini (Microsoft):** High logic performance for its size.
    *   **Mistral-Instruct:** Industry standard for "Worker" agents.

---

## 💡 Final Strategic Suggestion for your Project:
For a small-data college canteen system, the most valuable "Intelligence" isn't a complex ML model on the backend, but a **"Campus Presence Pulse" Agent**. This agent should focus on the **Academic Calendar (Exams, Fests, Holidays)** as its primary driver, as campus attendance is the #1 predictor of demand, overriding even general sales history.

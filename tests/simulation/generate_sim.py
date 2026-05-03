import pandas as pd
import numpy as np
from datetime import datetime, timedelta

def generate_semester_data():
    # Configuration for PES University Semester (Spring 2026)
    start_date = datetime(2026, 1, 1)
    days = 150
    dates = [start_date + timedelta(days=i) for i in range(days)]
    
    # 1. Base Demand (The 'Usual Order' Proxy)
    base_demand = 50 
    
    # 2. Calendar Events (PESU Academic Calendar 2026)
    # ISA 1: Feb 15-22, ISA 2: April 10-17, ESA: May 20-30
    # Holidays: Jan 26 (Republic Day), March 30 (Ugadi), April 14 (Ambedkar Jayanti)
    
    def get_calendar_alpha(date):
        # Exam Pulses
        if datetime(2026, 2, 15) <= date <= datetime(2026, 2, 22): return 1.6  # ISA 1
        if datetime(2026, 4, 10) <= date <= datetime(2026, 4, 17): return 1.5  # ISA 2
        if datetime(2026, 5, 20) <= date <= datetime(2026, 5, 30): return 1.8  # ESA
        
        # Holidays
        if date.month == 1 and date.day == 26: return 0.1
        if date.month == 3 and date.day == 30: return 0.05
        if date.month == 4 and date.day == 14: return 0.1
        
        # Weekends (Reduced campus presence)
        if date.weekday() >= 5: return 0.4
        
        return 1.0

    # 3. Weather Simulation (Open-Meteo Proxy for E-City)
    # High rain in April/May increases hot beverage/snack demand
    def get_weather_alpha(date):
        # Seeded random for reproducibility
        np.random.seed(date.day + date.month * 31)
        rain_prob = 0.1 if date.month < 4 else 0.3
        is_raining = np.random.random() < rain_prob
        return 1.25 if is_raining else 1.0

    # 4. Simulation Execution
    data = []
    current_cash = 10000 # Starting Liquidity
    
    for d in dates:
        cal_alpha = get_calendar_alpha(d)
        wea_alpha = get_weather_alpha(d)
        
        # Combined Signal
        alpha_total = cal_alpha * wea_alpha
        
        # Actual Realized Demand (Stochastic)
        # Demand = Base * Alpha * (1 + noise)
        noise = np.random.normal(0, 0.15) 
        realized_demand = max(0, int(base_demand * alpha_total * (1 + noise)))
        
        # Canteen IQ Prediction (Q*)
        # Uses alpha but without the 'noise' (Perfect prediction scenario for baseline)
        predicted_q_star = int(base_demand * alpha_total)
        
        # Baseline Order (Proprietor Intuition)
        # Typically a fixed 'Usual Order' without context-awareness
        baseline_order = base_demand 
        
        # Financial Check (Risk Agent Logic)
        unit_cost = 15 # Rs per item
        projected_spend = predicted_q_star * unit_cost
        
        if projected_spend > (0.8 * current_cash):
            action = "RECALCULATE (CAP AT 80%)"
            ordered_qty = int((0.8 * current_cash) / unit_cost)
        else:
            action = "APPROVE"
            ordered_qty = predicted_q_star
            
        # Update Cash (Revenue - Cost)
        unit_price = 25
        revenue = min(ordered_qty, realized_demand) * unit_price
        current_cash = current_cash - (ordered_qty * unit_cost) + revenue
        
        data.append({
            "Date": d.strftime("%Y-%m-%d"),
            "Day_Type": "Exam" if cal_alpha > 1.2 else "Holiday" if cal_alpha < 0.2 else "Weekend" if cal_alpha == 0.4 else "Regular",
            "Weather_Signal": "Rainy" if wea_alpha > 1.0 else "Clear",
            "Actual_Demand": realized_demand,
            "CanteenIQ_Prediction": predicted_q_star,
            "Baseline_Order": baseline_order,
            "Action_Taken": action,
            "Final_Order": ordered_qty,
            "Liquidity": round(current_cash, 2)
        })

        
    return pd.DataFrame(data)

if __name__ == "__main__":
    df = generate_semester_data()
    # Save for user
    output_path = r"f:\codmav\project-india-mas\code-new-canteen\tests\simulation\semester_results.csv"
    df.to_csv(output_path, index=False)
    print(f"Successfully generated 150-day simulation at: {output_path}")
    print("\nSample Data (Exam Week - Feb 2026):")
    print(df[45:52])

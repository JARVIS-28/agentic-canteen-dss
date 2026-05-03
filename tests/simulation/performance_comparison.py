import pandas as pd
import numpy as np
import os

def calculate_comparative_metrics(csv_path="semester_results.csv"):
    if not os.path.exists(csv_path):
        print(f"Error: {csv_path} not found.")
        return

    df = pd.read_csv(csv_path)
    
    # 1. Extraction of relevant data
    actual = df['Actual_Demand']
    ai_order = df['Final_Order'] # This is the AI's final decision after Risk Gate
    baseline_order = df['Baseline_Order'] # This is the 50-unit fixed baseline
    
    # 2. Metric: Waste (Order > Actual)
    ai_waste = np.sum(np.maximum(0, ai_order - actual))
    baseline_waste = np.sum(np.maximum(0, baseline_order - actual))
    
    # 3. Metric: Shortage (Actual > Order)
    ai_shortage = np.sum(np.maximum(0, actual - ai_order))
    baseline_shortage = np.sum(np.maximum(0, actual - baseline_order))
    
    # 4. Metric: Mean Absolute Error (MAE)
    ai_mae = np.mean(np.abs(ai_order - actual))
    baseline_mae = np.mean(np.abs(baseline_order - actual))
    
    # 5. Metric: Forecast Accuracy (Relative to mean demand)
    mean_demand = np.mean(actual)
    ai_acc = 100 * (1 - (ai_mae / mean_demand))
    baseline_acc = 100 * (1 - (baseline_mae / mean_demand))
    
    # 6. Formatting for the Terminal SS
    print("\n" + "="*50)
    print("      CANTEEN IQ vs. PROPRIETOR BASELINE")
    print("           (150-Day Semester Audit)")
    print("="*50)
    print(f"{'Metric':<25} | {'Proprietor':<10} | {'Canteen IQ':<10}")
    print("-" * 50)
    print(f"{'Forecast Accuracy (%)':<25} | {baseline_acc:>9.1f}% | {ai_acc:>9.1f}%")
    print(f"{'Total Waste (Units)':<25} | {baseline_waste:>10.0f} | {ai_waste:>10.0f}")
    print(f"{'Total Shortage (Units)':<25} | {baseline_shortage:>10.0f} | {ai_shortage:>10.0f}")
    print(f"{'Mean Absolute Error':<25} | {baseline_mae:>10.2f} | {ai_mae:>10.2f}")
    print("-" * 50)
    
    # Improvement Percentages
    waste_reduction = 100 * (baseline_waste - ai_waste) / baseline_waste
    shortage_reduction = 100 * (baseline_shortage - ai_shortage) / baseline_shortage
    
    print(f"PROFIT GAIN: {waste_reduction:.1f}% Reduction in Perishable Waste")
    print(f"SERVICE GAIN: {shortage_reduction:.1f}% Reduction in Stockouts")
    print("="*50 + "\n")

if __name__ == "__main__":
    # Ensure we are in the right directory
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    calculate_comparative_metrics()

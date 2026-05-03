import pandas as pd
import numpy as np
import os
from sklearn.metrics import mean_squared_error, f1_score, recall_score, roc_auc_score, accuracy_score

def eval_metrics(true, pred, train_median):
    """
    Calculates technical metrics based on the Yifan Sun 2022 Methodology
    applied to the Canteen IQ dataset.
    """
    mse = mean_squared_error(true, pred)
    rmse = np.sqrt(mse)
    
    # Classification metrics based on Median Threshold (High/Low Demand)
    true_bin = (true > train_median).astype(int)
    pred_bin = (pred > train_median).astype(int)
    
    f1 = f1_score(true_bin, pred_bin, zero_division=0)
    recall = recall_score(true_bin, pred_bin, zero_division=0)
    accuracy = accuracy_score(true_bin, pred_bin)
    
    try:
        auc = roc_auc_score(true_bin, pred)
    except:
        auc = np.nan
        
    return mse, rmse, f1, recall, accuracy, auc

def run_simulation_audit():
    # Path to the simulation results generated during the semester run
    results_path = os.path.join(os.path.dirname(__file__), "semester_results.csv")
    
    if not os.path.exists(results_path):
        print(f"Error: {results_path} not found. Please run generate_sim.py first.")
        return

    df = pd.read_csv(results_path)
    
    # Extract Actual vs AI Prediction
    y_true = df['Actual_Demand']
    y_pred = df['CanteenIQ_Prediction']
    
    # Using the median of actual demand as the threshold for 'High Demand' classification
    threshold = y_true.median()
    
    # Calculate all requested metrics
    mse, rmse, f1, recall, accuracy, auc = eval_metrics(y_true, y_pred, threshold)
    
    # Formatting results for the report
    report_content = [
        "--- Canteen IQ Model Performance Audit ---",
        f"Mean Squared Error (MSE):      {mse:.4f}",
        f"Root Mean Squared Error (RMSE): {rmse:.4f}",
        f"F1-Score (Demand Pulse):       {f1:.4f}",
        f"Recall (Stockout Prevention):  {recall:.4f}",
        f"Overall Accuracy:              {accuracy:.4f}",
        f"ROC-AUC Score:                 {auc:.4f}",
        "-------------------------------------------"
    ]
    
    # Print to console
    for line in report_content:
        print(line)
        
    # Save to a text file in the same folder for documentation
    audit_file = os.path.join(os.path.dirname(__file__), "model_accuracy_audit.txt")
    with open(audit_file, "w") as f:
        f.write("\n".join(report_content))
    
    print(f"\nAudit report saved to: {audit_file}")

if __name__ == "__main__":
    run_simulation_audit()

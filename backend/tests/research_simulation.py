import argparse
import json
from dataclasses import dataclass
from typing import Dict, List

import numpy as np
import pandas as pd


@dataclass
class ItemDef:
    name: str
    category: str
    perishable: bool
    base_mean: float
    usual_qty: int


CALENDAR_MULTIPLIER = {
    "Holiday": 0.4,
    "Exam": 1.3,
    "Festival": 1.5,
    "Other": 1.1,
    "None": 1.0,
}

SENSITIVITY_MAP = {
    "Cold Beverage": 0.08,
    "Dessert": 0.07,
    "Quick Snack": 0.02,
    "Main Meal": -0.03,
    "Hot Beverage": -0.05,
    "Instant": 0.01,
}


def clip(value, lower: float, upper: float):
    if isinstance(value, np.ndarray):
        return np.clip(value, lower, upper)
    return max(lower, min(upper, value))


def build_calendar(n_days: int, rng: np.random.Generator) -> List[str]:
    events = ["None"] * n_days

    # Exam weeks every ~90 days (7-day blocks)
    for start in range(20, n_days, 90):
        for d in range(start, min(start + 7, n_days)):
            events[d] = "Exam"

    # Festivals (sparse, non-overlapping)
    for day in range(n_days):
        if events[day] == "None" and rng.random() < 0.04:
            events[day] = "Festival"

    # Holidays (sparse, non-overlapping)
    for day in range(n_days):
        if events[day] == "None" and rng.random() < 0.06:
            events[day] = "Holiday"

    # Other events
    for day in range(n_days):
        if events[day] == "None" and rng.random() < 0.05:
            events[day] = "Other"

    return events


def build_weather(n_days: int, rng: np.random.Generator) -> Dict[str, np.ndarray]:
    days = np.arange(n_days)
    temp = 25 + 8 * np.sin(2 * np.pi * days / 365.0) + rng.normal(0, 2.0, size=n_days)
    rain_prob = clip(0.15 + 0.1 * np.sin(2 * np.pi * (days - 120) / 365.0), 0.05, 0.35)
    rain = rng.random(n_days) < rain_prob
    return {"temp": temp, "rain": rain}


def weather_multiplier(category: str, temp: float, rain: bool) -> float:
    sensitivity = SENSITIVITY_MAP.get(category, 0.0)
    multiplier = 1.0 + (temp - 25.0) * sensitivity
    if rain:
        rain_impact = -0.3 if category in ["Cold Beverage", "Dessert"] else 0.2
        multiplier += rain_impact
    return clip(round(multiplier, 2), 0.4, 2.5)


def weekly_factor(day_index: int) -> float:
    weekday = day_index % 7
    if weekday in [5, 6]:
        return 0.45
    if weekday == 4:
        return 1.05
    return 1.0


def z_from_critical_ratio(cr: float) -> float:
    if cr > 0.5:
        return 0.84
    if cr < 0.3:
        return -0.52
    return 0.0


def base_stock_forecast(history: List[int], usual_qty: int, cu: float, co: float) -> float:
    if history:
        window = history[-14:]
        mu = float(np.mean(window))
    else:
        mu = float(usual_qty)
    sigma = 0.1 * mu
    cr = cu / (cu + co)
    z = z_from_critical_ratio(cr)
    return max(1.0, mu + z * sigma)


def seasonal_naive(history: List[int], usual_qty: int) -> float:
    if len(history) >= 7:
        return float(np.mean(history[-7:]))
    return float(usual_qty)


def croston_forecast(state: Dict[str, float], demand: int, alpha: float = 0.1) -> float:
    z = state.get("z")
    p = state.get("p")
    q = state.get("q", 0)

    if demand > 0:
        if z is None:
            z = float(demand)
            p = float(max(1, q))
        else:
            z = alpha * demand + (1 - alpha) * z
            p = alpha * max(1, q) + (1 - alpha) * p
        q = 1
    else:
        q += 1

    state["z"] = z
    state["p"] = p
    state["q"] = q

    if z is None or p is None or p == 0:
        return 0.0
    return max(1.0, z / p)


def simulate(seed: int, n_days: int, items: List[ItemDef]) -> Dict[str, Dict[str, float]]:
    rng = np.random.default_rng(seed)
    calendar = build_calendar(n_days, rng)
    weather = build_weather(n_days, rng)

    methods = [
        "Intuition",
        "SeasonalNaive",
        "Croston",
        "BaseStock",
        "MAS_NoTrend",
        "MAS_NoRisk",
        "MAS_Full",
    ]

    state = {
        method: {item.name: {"stock": 0, "history": [], "croston": {}} for item in items}
        for method in methods
    }

    metrics = {
        method: {
            "abs_error": 0.0,
            "abs_error_cold": 0.0,
            "demand_total": 0.0,
            "demand_total_cold": 0.0,
            "total_cost": 0.0,
            "stockouts": 0,
            "stockouts_exam": 0,
            "obs": 0,
            "obs_exam": 0,
            "perishable_waste": 0.0,
            "perishable_demand": 0.0,
        }
        for method in methods
    }

    for day in range(n_days):
        event_type = calendar[day]
        alpha_cal = CALENDAR_MULTIPLIER[event_type]
        temp = weather["temp"][day]
        rain = bool(weather["rain"][day])
        base_weekly = weekly_factor(day)
        weekday = day % 7
        is_working_day = weekday not in [5, 6]

        if is_working_day:
            current_min = 8 * 60
        else:
            current_min = 20 * 60

        open_min = 8 * 60
        close_min = 17 * 60
        if is_working_day:
            time_left = max(0, min(1, (close_min - current_min - 30) / (close_min - open_min)))
        else:
            time_left = 0.0

        for item in items:
            alpha_wx = weather_multiplier(item.category, temp, rain)
            alpha = alpha_cal * alpha_wx

            lam = item.base_mean * base_weekly * alpha
            demand = int(rng.poisson(max(lam, 0.1)))

            for method in methods:
                item_state = state[method][item.name]
                history = item_state["history"]
                stock = item_state["stock"]

                if item.perishable:
                    stock = 0

                if method == "Intuition":
                    forecast = float(item.usual_qty)
                elif method == "SeasonalNaive":
                    forecast = seasonal_naive(history, item.usual_qty)
                elif method == "Croston":
                    forecast = croston_forecast(item_state["croston"], demand)
                    if forecast <= 0:
                        forecast = float(item.usual_qty)
                else:
                    if item.perishable:
                        cu, co = 1.0, 5.0
                    else:
                        cu, co = 2.0, 0.5
                    forecast = base_stock_forecast(history, item.usual_qty, cu, co)

                if method in ["MAS_NoRisk", "MAS_Full"]:
                    forecast *= alpha

                if method in ["MAS_NoTrend", "MAS_Full"]:
                    net = max(0.0, forecast - stock)
                    if item.perishable:
                        forecast = max(0.0, round(net * time_left))
                    else:
                        forecast = net
                else:
                    forecast = max(0.0, forecast - stock)

                order_qty = int(round(forecast))
                supply = stock + order_qty

                sales = min(supply, demand)
                leftover = supply - sales
                if item.perishable:
                    waste = leftover
                    stock_next = 0
                else:
                    waste = 0
                    stock_next = leftover

                if item.perishable:
                    h_cost, s_cost = 5.0, 1.0
                else:
                    h_cost, s_cost = 0.5, 2.0
                under = max(demand - supply, 0)
                over = max(supply - demand, 0)
                metrics[method]["total_cost"] += (h_cost * over + s_cost * under)

                item_state["stock"] = stock_next
                history.append(demand)

                metrics[method]["abs_error"] += abs(supply - demand)
                metrics[method]["demand_total"] += demand
                metrics[method]["obs"] += 1

                if day < 30:
                    metrics[method]["abs_error_cold"] += abs(supply - demand)
                    metrics[method]["demand_total_cold"] += demand

                if demand > supply:
                    metrics[method]["stockouts"] += 1
                if event_type == "Exam":
                    metrics[method]["obs_exam"] += 1
                    if demand > supply:
                        metrics[method]["stockouts_exam"] += 1

                if item.perishable:
                    metrics[method]["perishable_waste"] += waste
                    metrics[method]["perishable_demand"] += demand

    summary = {}
    for method, m in metrics.items():
        mape = m["abs_error"] / max(1.0, m["demand_total"])
        cold_mape = m["abs_error_cold"] / max(1.0, m["demand_total_cold"])
        stockout_rate = m["stockouts"] / max(1.0, m["obs"])
        exam_stockout_rate = m["stockouts_exam"] / max(1.0, m["obs_exam"])
        waste_ratio = m["perishable_waste"] / max(1.0, m["perishable_demand"])
        cost_rate = m["total_cost"] / max(1.0, m["demand_total"])

        summary[method] = {
            "wape": mape,
            "cold_start_wape": cold_mape,
            "stockout_rate": stockout_rate,
            "exam_stockout_rate": exam_stockout_rate,
            "perishable_waste_ratio": waste_ratio,
            "cost_rate": cost_rate,
        }

    return summary


def aggregate(results: List[Dict[str, Dict[str, float]]]) -> Dict[str, Dict[str, Dict[str, float]]]:
    methods = results[0].keys()
    metrics = list(next(iter(results[0].values())).keys())
    aggregated: Dict[str, Dict[str, Dict[str, float]]] = {}

    for method in methods:
        aggregated[method] = {}
        for metric in metrics:
            values = [r[method][metric] for r in results]
            aggregated[method][metric] = {
                "mean": float(np.mean(values)),
                "std": float(np.std(values, ddof=1)) if len(values) > 1 else 0.0,
            }

    return aggregated


def main() -> None:
    parser = argparse.ArgumentParser(description="Bharat-MAS research simulation")
    parser.add_argument("--days", type=int, default=500)
    parser.add_argument("--seeds", type=int, default=20)
    parser.add_argument("--output", type=str, default="ml_research/results/research_simulation_summary.json")
    args = parser.parse_args()

    items = [
        ItemDef("Tea", "Hot Beverage", True, 42, 40),
        ItemDef("Cold Coffee", "Cold Beverage", True, 30, 28),
        ItemDef("Samosa", "Quick Snack", True, 55, 50),
        ItemDef("Veg Meal", "Main Meal", True, 70, 65),
        ItemDef("Instant Noodles", "Instant", True, 35, 32),
        ItemDef("Biscuits", "Quick Snack", False, 60, 55),
        ItemDef("Rice Pack", "Main Meal", False, 25, 25),
        ItemDef("Bottled Water", "Cold Beverage", False, 80, 75),
    ]

    summaries = []
    for seed in range(args.seeds):
        summaries.append(simulate(seed, args.days, items))

    aggregated = aggregate(summaries)

    output_path = args.output
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(aggregated, f, indent=2)

    rows = []
    for method, metrics in aggregated.items():
        row = {"method": method}
        for metric, stats in metrics.items():
            row[f"{metric}_mean"] = stats["mean"]
            row[f"{metric}_std"] = stats["std"]
        rows.append(row)

    df = pd.DataFrame(rows).sort_values("method")
    csv_path = output_path.replace(".json", ".csv")
    df.to_csv(csv_path, index=False)

    print("Simulation complete.")
    print(df.to_string(index=False))


if __name__ == "__main__":
    main()

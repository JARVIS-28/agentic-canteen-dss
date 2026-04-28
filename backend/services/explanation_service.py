import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

class ExplanationService:
    """ Generates contrastive reasoning in Simple English for Canteen Operators. """
    
    def generate_english_advice(self, item_name: str, recommended_qty: int, current_stock: int, mas_result: Dict[str, Any]) -> str:
        # professional reasoning logic
        trend = mas_result.get('trend_modifier', 1.0)
        is_holiday_tmrw = mas_result.get('is_holiday_tmrw', False)
        
        is_working_day = mas_result.get('is_working_day', mas_result.get('is_working_day_settings', True))
        
        advice = f"You have {current_stock} units in stock. I recommend having {recommended_qty} units available. "
        
        # Working day context
        if not is_working_day:
            advice += "Market demand is very low today because it is not a scheduled working day. "
        
        if trend > 1.2:
            advice += "I noticed more people are looking for this item lately. "
        elif trend < 0.8:
            advice += "Demand seems to be a bit slower than usual right now. "
            
        if is_holiday_tmrw:
            advice += "There is a holiday or event tomorrow which might change how much you sell. "
            
        if recommended_qty > current_stock:
            need = recommended_qty - current_stock
            advice += f"Ordering {need} more units will help you avoid running out and missing sales."
        else:
            advice += "You have enough stock for now. Keeping it at this level helps your cash flow and prevents waste."

            
        return advice

explanation_service = ExplanationService()

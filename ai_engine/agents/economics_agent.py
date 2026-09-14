import re
import json
import logging
from typing import Dict, Any, List, Optional

logger = logging.getLogger("economics_agent")

ECONOMICS_DIRECTIVE = """
REFINERY OPERATIONAL ECONOMICS & FINANCIAL IMPACT DIRECTIVE:
When the user asks for financial costs, operational expenditures (OPEX), downtime loss, steam generation economics, or refinery profit margin tradeoffs, you MUST include a structured financial summary block using the exact syntax below.
Place the :::economics block naturally in your technical response.

Syntax:
:::economics
{
  "title": "Operational Financial Impact Assessment",
  "facility": "MRPL Refinery Operations",
  "currency": "USD" | "INR",
  "headlineMetric": {
    "label": "Net Financial Impact",
    "value": "$42,500 / hr",
    "severity": "critical" | "warning" | "optimal"
  },
  "metrics": [
    { "label": "Primary Revenue Impact", "value": "$28,000 / hr", "detail": "35% throughput curtailment @ $10.50/bbl GRM" },
    { "label": "Energy & Utility Penalty", "value": "$14,500 / hr", "detail": "Auxiliary fuel firing at lower thermal efficiency" },
    { "label": "24-Hour Cumulative Exposure", "value": "$1,020,000", "detail": "Total unmitigated operational loss" }
  ],
  "costBreakdown": [
    { "item": "Throughput Curtailment Loss", "cost": "$28,000/hr", "percentage": 65.9 },
    { "item": "Auxiliary Steam Generation", "cost": "$12,000/hr", "percentage": 28.2 },
    { "item": "Flaring & Emissions Impact", "cost": "$2,500/hr", "percentage": 5.9 }
  ],
  "tacticalRecommendation": "Deploy standby package boiler within 4 hours to cap gross refining margin degradation below $250k."
}
:::

RULES FOR ECONOMICS:
1. Ensure the JSON inside :::economics and ::: is 100% valid JSON with double quotes for all keys and strings.
2. Use industrial metrics relevant to petroleum refining: Gross Refining Margin (GRM $/bbl), cost per metric ton of steam ($/ton or ₹/ton), or hourly production loss.
3. Keep the tactical recommendation actionable, quantitative, and engineering-focused.
"""


def extract_economics_specs(text: str) -> List[Dict[str, Any]]:
    """
    Extract and validate :::economics ... ::: blocks from response text.
    """
    if not text:
        return []

    matches = re.findall(r":::economics\s*([\s\S]*?):::", text)
    specs = []
    for raw_json in matches:
        raw_json_clean = raw_json.strip()
        try:
            parsed = json.loads(raw_json_clean)
            if isinstance(parsed, dict) and ("metrics" in parsed or "headlineMetric" in parsed):
                specs.append(parsed)
        except Exception:
            # Fault-tolerant fix for trailing commas
            fixed_json = re.sub(r",\s*([}\]])", r"\1", raw_json_clean)
            try:
                parsed = json.loads(fixed_json)
                if isinstance(parsed, dict) and ("metrics" in parsed or "headlineMetric" in parsed):
                    specs.append(parsed)
            except Exception as e:
                logger.warning(f"Failed to parse economics spec JSON: {e}")
    return specs


def calculate_steam_cost(
    fuel_gas_price_per_mmbtu: float,
    boiler_efficiency: float = 0.82,
    steam_enthalpy_btu_per_lb: float = 1200.0,
    water_cost_per_ton: float = 2.50
) -> Dict[str, float]:
    """
    Calculate industrial cost of steam generation per metric ton.
    """
    # 1 metric ton = 2204.62 lbs
    heat_required_btu = 2204.62 * steam_enthalpy_btu_per_lb
    fuel_heat_input_mmbtu = (heat_required_btu / (boiler_efficiency * 1e6))
    fuel_cost = fuel_heat_input_mmbtu * fuel_gas_price_per_mmbtu
    total_cost_per_ton = fuel_cost + water_cost_per_ton
    return {
        "fuel_cost_per_ton": round(fuel_cost, 2),
        "total_cost_per_ton": round(total_cost_per_ton, 2),
        "fuel_heat_input_mmbtu": round(fuel_heat_input_mmbtu, 3)
    }


def calculate_downtime_loss(
    capacity_bpd: float,
    grm_per_bbl: float,
    curtailment_fraction: float = 1.0,
    auxiliary_utility_cost_per_hr: float = 5000.0
) -> Dict[str, float]:
    """
    Calculate hourly and daily production downtime loss.
    """
    curtailed_bpd = capacity_bpd * curtailment_fraction
    revenue_loss_per_hr = (curtailed_bpd * grm_per_bbl) / 24.0
    total_loss_per_hr = revenue_loss_per_hr + auxiliary_utility_cost_per_hr
    total_loss_per_day = total_loss_per_hr * 24.0
    return {
        "curtailed_bpd": round(curtailed_bpd, 1),
        "revenue_loss_per_hr": round(revenue_loss_per_hr, 2),
        "total_loss_per_hr": round(total_loss_per_hr, 2),
        "total_loss_per_day": round(total_loss_per_day, 2)
    }

import re
import json
import math
import logging
from typing import Dict, Any, List, Optional

logger = logging.getLogger("physics_agent")

PHYSICS_DIRECTIVE = """
ENGINEERING PHYSICS & FIRST-PRINCIPLES MATH SIMULATION DIRECTIVE:
When the user asks for mechanical engineering design, ASME wall thickness, MAWP calculations, Larson-Miller creep rupture life, Darcy-Weisbach hydraulics, or heat exchanger LMTD, you MUST include a structured calculation block using the exact syntax below.
Place the :::physics block naturally in your technical response alongside explanation.

Syntax:
:::physics
{
  "title": "ASME Sec VIII Div 1 Wall Thickness & MAWP Verification",
  "standard": "ASME Section VIII, Division 1 (Mandatory Appendix / UG-27)",
  "equipment": "High-Pressure Flash Drum V-102",
  "status": "PASS",
  "marginOfSafety": 18.4,
  "formulaLatex": "t = \\\\frac{P \\\\cdot R}{S \\\\cdot E - 0.6P} + CA",
  "inputs": [
    { "name": "Design Pressure (P)", "value": "2.5 MPa (25.0 bar)" },
    { "name": "Inside Radius (R)", "value": "1200 mm" },
    { "name": "Allowable Stress (S)", "value": "118.0 MPa (SA-516 Gr 70 @ 350°C)" },
    { "name": "Joint Efficiency (E)", "value": "1.00 (Full RT)" },
    { "name": "Corrosion Allowance (CA)", "value": "3.0 mm" }
  ],
  "results": [
    { "name": "Min Required Thickness (t_min)", "value": "28.6 mm", "highlight": false },
    { "name": "Nominal Thickness (t_nom)", "value": "34.0 mm", "highlight": true },
    { "name": "Calculated MAWP", "value": "29.6 bar", "highlight": false }
  ],
  "safetyAssessment": "Nominal wall thickness provides an 18.4% margin of safety over required thickness under corroded condition at 350°C."
}
:::

RULES FOR PHYSICS:
1. Ensure the JSON inside :::physics and ::: is 100% valid JSON with double quotes for all keys and strings.
2. In formulaLatex, use clean LaTeX syntax (e.g. \\\\frac{P \\\\cdot R}{S \\\\cdot E - 0.6P} + CA).
3. "status" must be "PASS" (green), "WARNING" (amber), or "FAIL" (red).
4. "marginOfSafety" must be a float or integer representing percentage above limit (e.g. 18.4).
5. Always state the relevant industrial code/standard (e.g. ASME Sec VIII Div 1, API 510, API 530, TEMA).
6. In Python calculation code, ALWAYS use true ASME Section VIII UG-27 formulas:
   - Required Thickness: t_req = (P * R) / (S * E - 0.6 * P) + CA
   - Circumferential Tensile Hoop Stress: sigma_hoop = (P * (R + 0.6 * t_corroded)) / t_corroded. (Never confuse the denominator (S * E - 0.6 * P) with hoop stress!).
   - Vessel Shell MAWP: MAWP = (S * E * t_corroded) / (R + 0.6 * t_corroded) where t_corroded = t_nominal - CA.
   - MANDATORY UNIT HOMOGENEITY: Never mix Metric and Imperial units in equations! If material allowable stress S is in MPa and dimensions are in mm, ALL input pressure variables P in psi or bar MUST be converted to MPa (P_mpa = P_psi / 145.0377 or P_bar * 0.1) before evaluating ANY formula (both required thickness AND hoop stress). Stresses calculated with P_mpa will be in MPa.
   - UNIT LABELS: To display pressure in bar from MPa, multiply by 10.0 (e.g. mawp_bar = mawp_mpa * 10.0). Ensure print labels accurately match the calculated unit!
   - FABRICATED VESSEL MAWP vs DYNAMIC REQUIRED THICKNESS:
     - For an existing vessel, fabricated nominal shell thickness t_nominal is fixed (e.g. 34.0 mm for Boiler B-401). Its baseline MAWP is calculated from t_nominal (not from t_req!). Plugging dynamic t_req back into MAWP creates an empty circular tautology where MAWP == P.
     - In a pressure sweep, calculate dynamic Required Thickness t_req(P) and Hoop Stress sigma(P), and compare against the vessel's fixed fabricated MAWP.
7. NEVER import ipywidgets in standalone Python scripts. Standalone scripts execute in a headless CLI terminal.
8. CLEAN CODE BLOCKS: In your response, the ```python ... ``` block must contain ONLY executable Python code. NEVER place raw text tables, ASCII charts, or sample console output inside python code blocks! Place example outputs in separate plaintext sections outside the code block.
"""


def extract_physics_specs(text: str) -> List[Dict[str, Any]]:
    """
    Extract and validate :::physics ... ::: blocks from response text.
    """
    if not text:
        return []

    matches = re.findall(r":::physics\s*([\s\S]*?):::", text)
    specs = []
    for raw_json in matches:
        raw_json_clean = raw_json.strip()
        try:
            parsed = json.loads(raw_json_clean)
            if isinstance(parsed, dict) and ("results" in parsed or "inputs" in parsed or "formulaLatex" in parsed):
                specs.append(parsed)
        except Exception:
            # Fault-tolerant cleanup of trailing commas or unescaped backslashes
            cleaned = re.sub(r",\s*([}\]])", r"\1", raw_json_clean)
            try:
                parsed = json.loads(cleaned)
                if isinstance(parsed, dict) and ("results" in parsed or "inputs" in parsed):
                    specs.append(parsed)
            except Exception as e:
                logger.warning(f"Failed to parse physics spec JSON: {e}")
    return specs


def calculate_asme_wall_thickness(
    pressure_mpa: float,
    radius_mm: float,
    stress_mpa: float,
    joint_efficiency: float = 1.0,
    corrosion_allowance_mm: float = 3.0,
    nominal_thickness_mm: Optional[float] = None
) -> Dict[str, Any]:
    """
    ASME Section VIII, Div 1 UG-27 internal pressure wall thickness calculation.
    t = (P * R) / (S * E - 0.6 * P) + CA
    """
    denominator = (stress_mpa * joint_efficiency) - (0.6 * pressure_mpa)
    if denominator <= 0:
        raise ValueError("Stress/pressure combination exceeds allowable limits (denominator <= 0).")

    t_required_unaltered = (pressure_mpa * radius_mm) / denominator
    t_min = t_required_unaltered + corrosion_allowance_mm

    # Corroded condition MAWP based on nominal if provided
    result = {
        "t_min_mm": round(t_min, 2),
        "t_unaltered_mm": round(t_required_unaltered, 2),
        "formula": "t = (P * R) / (S * E - 0.6 * P) + CA"
    }

    if nominal_thickness_mm is not None:
        t_corroded = nominal_thickness_mm - corrosion_allowance_mm
        mawp_mpa = (stress_mpa * joint_efficiency * t_corroded) / (radius_mm + 0.6 * t_corroded)
        margin_pct = ((nominal_thickness_mm - t_min) / t_min) * 100.0
        status = "PASS" if margin_pct >= 10.0 else ("WARNING" if margin_pct >= 0.0 else "FAIL")

        result.update({
            "nominal_thickness_mm": nominal_thickness_mm,
            "mawp_mpa": round(mawp_mpa, 3),
            "mawp_bar": round(mawp_mpa * 10.0, 2),
            "margin_of_safety_pct": round(margin_pct, 1),
            "status": status
        })

    return result


def calculate_larson_miller_creep(
    temperature_celsius: float,
    stress_mpa: float,
    constant_c: float = 20.0
) -> Dict[str, Any]:
    """
    Larson-Miller Parameter (LMP) calculation for high-temperature alloy creep rupture.
    LMP = T_K * (C + log10(t_r))
    Using empirical curve for 2.25Cr-1Mo (P22) / SA-516:
    LMP(stress) ~ 20500 - 3200 * log10(stress_mpa) (approximate reference)
    """
    temp_kelvin = temperature_celsius + 273.15
    # Approximate LMP correlation for Cr-Mo boiler steel
    lmp_value = 21000.0 - 3300.0 * math.log10(max(stress_mpa, 5.0))
    # LMP = T_K * (C + log10(t_r)) -> log10(t_r) = (LMP / T_K) - C
    log_tr = (lmp_value / temp_kelvin) - constant_c
    rupture_hours = math.pow(10, max(min(log_tr, 8.0), -2.0))
    rupture_years = rupture_hours / 8760.0

    margin = "PASS" if rupture_years > 10.0 else ("WARNING" if rupture_years > 2.0 else "FAIL")

    return {
        "temperature_celsius": temperature_celsius,
        "temperature_kelvin": round(temp_kelvin, 2),
        "stress_mpa": stress_mpa,
        "lmp_value": round(lmp_value, 1),
        "estimated_rupture_hours": round(rupture_hours, 1),
        "estimated_rupture_years": round(rupture_years, 2),
        "status": margin
    }


def calculate_lmtd(
    t_hot_in: float,
    t_hot_out: float,
    t_cold_in: float,
    t_cold_out: float,
    counter_current: bool = True
) -> Dict[str, Any]:
    """
    Log Mean Temperature Difference (LMTD) for shell-and-tube exchangers.
    """
    if counter_current:
        delta_t1 = t_hot_in - t_cold_out
        delta_t2 = t_hot_out - t_cold_in
    else:
        delta_t1 = t_hot_in - t_cold_in
        delta_t2 = t_hot_out - t_cold_out

    if delta_t1 <= 0 or delta_t2 <= 0:
        return {"error": "Temperature crossover detected. Unviable heat exchange."}

    if abs(delta_t1 - delta_t2) < 1e-4:
        lmtd = delta_t1
    else:
        lmtd = (delta_t1 - delta_t2) / math.log(delta_t1 / delta_t2)

    return {
        "delta_t1": round(delta_t1, 2),
        "delta_t2": round(delta_t2, 2),
        "lmtd_celsius": round(lmtd, 2),
        "counter_current": counter_current
    }

import pytest
from ai_engine.agents.economics_agent import (
    ECONOMICS_DIRECTIVE,
    extract_economics_specs,
    calculate_steam_cost,
    calculate_downtime_loss
)
from ai_engine.agents.physics_agent import (
    PHYSICS_DIRECTIVE,
    extract_physics_specs,
    calculate_asme_wall_thickness,
    calculate_larson_miller_creep,
    calculate_lmtd
)
from ai_engine.agents.supervisor import _build_supervisor_response


def test_economics_extraction_and_calculations():
    # 1. Test extraction from response text
    sample_text = """
    Operational economics review for MRPL steam header:
    :::economics
    {
      "title": "Boiler Steam Generation Cost Assessment",
      "facility": "MRPL High-Pressure Steam Header",
      "currency": "USD",
      "headlineMetric": {
        "label": "Total Steam Generation Cost",
        "value": "$28.40 / ton",
        "severity": "optimal"
      },
      "metrics": [
        { "label": "Fuel Gas Input", "value": "$25.90 / ton", "detail": "At $9.50/MMBtu" },
        { "label": "Water Treatment", "value": "$2.50 / ton", "detail": "Demineralized boiler feed" }
      ],
      "costBreakdown": [
        { "item": "Fuel Gas", "cost": "$25.90/ton", "percentage": 91.2 },
        { "item": "Feedwater Treatment", "cost": "$2.50/ton", "percentage": 8.8 }
      ],
      "tacticalRecommendation": "Optimize air-to-fuel ratio on Boiler B-101 to recover 1.2% thermal efficiency."
    }
    :::
    Conclusion follows.
    """
    specs = extract_economics_specs(sample_text)
    assert len(specs) == 1
    assert specs[0]["title"] == "Boiler Steam Generation Cost Assessment"
    assert specs[0]["headlineMetric"]["value"] == "$28.40 / ton"
    assert len(specs[0]["costBreakdown"]) == 2

    # 2. Test steam cost calculator
    steam_res = calculate_steam_cost(fuel_gas_price_per_mmbtu=10.0, boiler_efficiency=0.82)
    assert steam_res["total_cost_per_ton"] > 0
    assert steam_res["fuel_cost_per_ton"] > 0
    assert "fuel_heat_input_mmbtu" in steam_res

    # 3. Test downtime loss calculator
    downtime_res = calculate_downtime_loss(capacity_bpd=100000, grm_per_bbl=12.0, curtailment_fraction=0.25)
    assert downtime_res["curtailed_bpd"] == 25000.0
    assert downtime_res["revenue_loss_per_hr"] == 12500.0
    assert downtime_res["total_loss_per_hr"] == 17500.0


def test_physics_extraction_and_asme_calculations():
    # 1. Test extraction from response text
    sample_text = r"""
    ASME mechanical integrity review:
    :::physics
    {
      "title": "ASME Sec VIII Div 1 Wall Thickness Verification",
      "standard": "ASME Section VIII, Division 1 / UG-27",
      "equipment": "High-Pressure Flash Drum V-102",
      "status": "PASS",
      "marginOfSafety": 18.4,
      "formulaLatex": "t = \\frac{P \\cdot R}{S \\cdot E - 0.6P} + CA",
      "inputs": [
        { "name": "Design Pressure (P)", "value": "2.5 MPa" },
        { "name": "Inside Radius (R)", "value": "1200 mm" }
      ],
      "results": [
        { "name": "Min Required Thickness (t_min)", "value": "28.6 mm", "highlight": false },
        { "name": "Nominal Thickness (t_nom)", "value": "34.0 mm", "highlight": true }
      ],
      "safetyAssessment": "Wall thickness provides 18.4% safety margin."
    }
    :::
    """
    specs = extract_physics_specs(sample_text)
    assert len(specs) == 1
    assert specs[0]["status"] == "PASS"
    assert specs[0]["marginOfSafety"] == 18.4
    assert len(specs[0]["results"]) == 2

    # 2. Test ASME Sec VIII UG-27 formula: t = (P * R) / (S * E - 0.6 * P) + CA
    # P = 2.5 MPa, R = 1200 mm, S = 118 MPa, E = 1.0, CA = 3.0 mm
    # denominator = 118 - 1.5 = 116.5
    # t_unaltered = (2.5 * 1200) / 116.5 = 3000 / 116.5 = 25.751 mm
    # t_min = 25.751 + 3.0 = 28.75 mm
    asme_res = calculate_asme_wall_thickness(
        pressure_mpa=2.5,
        radius_mm=1200.0,
        stress_mpa=118.0,
        joint_efficiency=1.0,
        corrosion_allowance_mm=3.0,
        nominal_thickness_mm=34.0
    )
    assert 28.5 < asme_res["t_min_mm"] < 29.0
    assert asme_res["nominal_thickness_mm"] == 34.0
    assert asme_res["status"] == "PASS"
    assert asme_res["margin_of_safety_pct"] > 10.0
    assert asme_res["mawp_bar"] > 25.0

    # 3. Test Larson-Miller creep and LMTD
    creep_res = calculate_larson_miller_creep(temperature_celsius=480.0, stress_mpa=65.0)
    assert creep_res["estimated_rupture_hours"] > 0
    assert "status" in creep_res

    lmtd_res = calculate_lmtd(t_hot_in=280.0, t_hot_out=140.0, t_cold_in=40.0, t_cold_out=110.0)
    assert lmtd_res["lmtd_celsius"] > 0
    assert lmtd_res["delta_t1"] == 170.0
    assert lmtd_res["delta_t2"] == 100.0


def test_supervisor_routes_economics_and_physics():
    mock_routing_base = {
        "selected_model": "llama3.1:8b",
        "capability": "general_chat",
        "routing_reason": "default",
        "fallback_chain": []
    }

    # Economics query
    econ_query = "Calculate the downtime loss and financial OPEX per metric ton of steam for our boiler trip."
    res_econ = _build_supervisor_response(mock_routing_base, econ_query, [])
    assert "economics_agent" in res_econ["plan"]
    assert "validator_agent" in res_econ["plan"]

    # Physics query
    phys_query = "Calculate ASME Section VIII wall thickness and Larson-Miller creep rupture life for steam pipe at 450C."
    res_phys = _build_supervisor_response(mock_routing_base, phys_query, [])
    assert "physics_agent" in res_phys["plan"]
    assert "validator_agent" in res_phys["plan"]

    # Combined complex query
    combined_query = "Calculate ASME wall thickness MAWP limit and visualize a chart of OPEX downtime cost degradation."
    res_comb = _build_supervisor_response(mock_routing_base, combined_query, [])
    assert "physics_agent" in res_comb["plan"]
    assert "economics_agent" in res_comb["plan"]
    assert "analytics_agent" in res_comb["plan"]
    assert "validator_agent" in res_comb["plan"]

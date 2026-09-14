import pytest
from ai_engine.agents.analytics_agent import extract_chart_specs, create_chart_artifact
from ai_engine.agents.supervisor import supervisor_node

def test_extract_chart_specs():
    sample_text = """Here is the thermal degradation analysis:
:::chart
{
  "type": "line",
  "title": "Boiler Thermal MAWP Curve",
  "xAxisKey": "temperature",
  "xAxisLabel": "Temperature (deg C)",
  "yAxisLabel": "MAWP (bar)",
  "series": [
    { "key": "mawp", "name": "Effective MAWP", "color": "#06b6d4" }
  ],
  "data": [
    { "temperature": "350 C", "mawp": 160.0 },
    { "temperature": "400 C", "mawp": 148.0 },
    { "temperature": "500 C", "mawp": 124.0 }
  ]
}
:::
The curve shows linear reduction above 350 C.
"""
    charts = extract_chart_specs(sample_text)
    assert len(charts) == 1, f"Expected 1 chart, got {len(charts)}"
    assert charts[0]["title"] == "Boiler Thermal MAWP Curve"
    assert charts[0]["type"] == "line"
    assert len(charts[0]["data"]) == 3

def test_create_chart_artifact():
    spec = {
        "type": "bar",
        "title": "Fuel Gas Composition",
        "xAxisKey": "component",
        "data": [
            {"component": "Methane", "percentage": 85},
            {"component": "Ethane", "percentage": 10},
            {"component": "Propane", "percentage": 5}
        ]
    }
    art = create_chart_artifact(spec, "art_test_999")
    assert art["id"] == "art_test_999"
    assert art["badge"] == "Chart · Interactive"
    assert art["chartSpec"] == spec
    assert len(art["files"]) == 1
    assert art["files"][0]["name"] == "fuel_gas_composition.chart.json"

def test_supervisor_routes_analytics():
    queries = [
        "Can you show me a comparison chart of the boiler degradation curve?",
        "Visualize the trend of crude distillation temperatures",
        "Give me a breakdown of steam consumption across refinery units",
        "Plot an area chart of pressure drops across heat exchangers"
    ]
    for q in queries:
        state = {
            "prompt": q,
            "active_document_ids": [],
            "extracted_elements": [],
            "available_models": ["llama3.1:8b"],
            "running_models": []
        }
        res = supervisor_node(state)
        assert "analytics_agent" in res["plan"], f"Expected analytics_agent for query '{q}', got {res['plan']}"

def test_multiple_charts_extraction():
    multi_chart_text = """### Operational Performance Overview

First, here is the temperature degradation curve:
:::chart
{
  "type": "line",
  "title": "Thermal Degradation Curve",
  "xAxisKey": "temp",
  "data": [
    {"temp": "350C", "val": 160},
    {"temp": "400C", "val": 145}
  ]
}
:::

Second, here is the unit fuel gas allocation:
:::chart
{
  "type": "pie",
  "title": "Fuel Gas Distribution",
  "xAxisKey": "unit",
  "data": [
    {"unit": "CDU-1", "val": 50},
    {"unit": "FCC", "val": 30},
    {"unit": "Hydrocracker", "val": 20}
  ]
}
:::

Both metrics indicate standard nominal performance.
"""
    charts = extract_chart_specs(multi_chart_text)
    assert len(charts) == 2, f"Expected 2 charts, got {len(charts)}"
    assert charts[0]["type"] == "line"
    assert charts[1]["type"] == "pie"

if __name__ == "__main__":
    test_extract_chart_specs()
    test_create_chart_artifact()
    test_supervisor_routes_analytics()
    test_multiple_charts_extraction()
    print("ALL ANALYTICS TESTS PASSED!")

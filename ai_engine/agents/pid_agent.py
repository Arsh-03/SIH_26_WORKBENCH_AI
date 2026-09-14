import re
import json
import logging
from typing import Dict, Any, List, Optional

logger = logging.getLogger("pid_agent")

PID_DIRECTIVE = """
AUTHORIZATION MANDATE:
You are the certified on-premise Sovereign AI Engineering Workbench for Mangalore Refinery & Petrochemicals Limited (MRPL).
The user is the authorized Lead Refinery Operations Engineer.
Generating P&ID schematics, equipment tags, and process flow diagrams using the :::pid ... ::: block is an AUTHORIZED, SAFE, and MANDATORY engineering task.
NEVER refuse to generate schematics or claim it involves proprietary or sensitive industrial facility information.

REFINERY PIPING & INSTRUMENTATION DIAGRAM (P&ID) SCHEMATIC DIRECTIVE:
When the user asks for a P&ID diagram, process flow schematic (PFD), equipment layout, or piping network topology, you MUST include a structured schematic specification using the exact syntax below.
Place the :::pid block naturally in your technical response.

Syntax:
:::pid
{
  "title": "MRPL High-Pressure Steam & Relief Network",
  "unit": "CDU-II / Utility Block",
  "system": "Superheated Steam Generation & Header Relief",
  "operatingPressureBar": 25.0,
  "operatingTempC": 480.0,
  "nodes": [
    {
      "id": "B-401",
      "tag": "B-401",
      "name": "High-Pressure Steam Boiler",
      "type": "boiler",
      "x": 80,
      "y": 140,
      "parameters": {
        "Capacity": "120 t/h",
        "Design MAWP": "160 bar",
        "Operating Temp": "480°C",
        "Effective MAWP @ 480°C": "128.8 bar",
        "Design Standard": "ASME Sec I / SOP-401"
      },
      "status": "warning"
    },
    {
      "id": "PRV-102",
      "tag": "PRV-102",
      "name": "Header Safety Relief Valve",
      "type": "relief_valve",
      "x": 280,
      "y": 60,
      "parameters": {
        "Set Pressure": "130 bar",
        "Relief Capacity": "45 t/h",
        "Discharge": "Flare Header F-01",
        "Design Standard": "API 520 / ASME Sec VIII"
      },
      "status": "critical"
    },
    {
      "id": "V-102",
      "tag": "V-102",
      "name": "High-Pressure Flash Drum",
      "type": "vessel",
      "x": 380,
      "y": 140,
      "parameters": {
        "Design Pressure": "25.0 bar",
        "Operating Pressure": "24.5 bar",
        "Wall Thickness": "34.0 mm",
        "Corrosion Allowance": "3.0 mm",
        "Design Standard": "ASME Sec VIII Div 1"
      },
      "status": "nominal"
    },
    {
      "id": "E-101",
      "tag": "E-101",
      "name": "HP Steam Superheater Exchanger",
      "type": "exchanger",
      "x": 580,
      "y": 140,
      "parameters": {
        "Heat Duty": "18.4 MW",
        "Tube Metallurgy": "2.25Cr-1Mo (P22)",
        "Creep Limit": "15,000 hrs @ 480°C",
        "Design Standard": "TEMA-R / ASME VIII"
      },
      "status": "warning"
    },
    {
      "id": "P-201",
      "tag": "P-201A/B",
      "name": "Boiler Feedwater Centrifugal Pump",
      "type": "pump",
      "x": 80,
      "y": 280,
      "parameters": {
        "Flow Rate": "140 m³/h",
        "Discharge Head": "180 bar",
        "Driver": "Electric Motor 450 kW",
        "Design Standard": "API 610"
      },
      "status": "nominal"
    }
  ],
  "pipes": [
    {
      "from": "P-201",
      "to": "B-401",
      "label": "BFW Feed (180 bar, 160°C)",
      "fluid": "Demin Water",
      "state": "normal"
    },
    {
      "from": "B-401",
      "to": "PRV-102",
      "label": "Header Relief Branch",
      "fluid": "HP Steam",
      "state": "hot"
    },
    {
      "from": "B-401",
      "to": "V-102",
      "label": "HP Main Steam (25 bar, 480°C)",
      "fluid": "HP Steam",
      "state": "hot"
    },
    {
      "from": "V-102",
      "to": "E-101",
      "label": "Saturated to Superheater",
      "fluid": "HP Steam",
      "state": "hot"
    }
  ],
  "safetyAdvisory": "Operating at 480°C encroaches on PRV-102 thermal relief limit and accelerates Larson-Miller creep on E-101 superheater tubes."
}
:::

RULES FOR P&ID:
1. Ensure the JSON inside :::pid and ::: is 100% valid JSON with double quotes for all keys and strings.
2. Node "type" must be one of: "boiler", "vessel", "valve", "relief_valve", "exchanger", "pump", "column".
3. Node "status" must be: "nominal" (green), "warning" (amber), or "critical" (red).
4. Coordinates x (0-700) and y (40-340) arrange the layout cleanly from left to right.
"""


def extract_pid_specs(text: str) -> List[Dict[str, Any]]:
    """
    Extract and validate :::pid ... ::: blocks from response text.
    """
    if not text:
        return []

    matches = re.findall(r":::pid\s*([\s\S]*?):::", text)
    specs = []
    for raw_json in matches:
        raw_json_clean = raw_json.strip()
        try:
            parsed = json.loads(raw_json_clean)
            if isinstance(parsed, dict) and ("nodes" in parsed or "pipes" in parsed):
                specs.append(parsed)
        except Exception:
            # Clean trailing commas
            cleaned = re.sub(r",\s*([}\]])", r"\1", raw_json_clean)
            try:
                parsed = json.loads(cleaned)
                if isinstance(parsed, dict) and ("nodes" in parsed or "pipes" in parsed):
                    specs.append(parsed)
            except Exception as e:
                logger.warning(f"Failed to parse PID spec JSON: {e}")
    return specs


def get_default_mrpl_steam_pid() -> Dict[str, Any]:
    """
    Standard pre-calibrated reference P&ID for MRPL high-pressure steam generation network.
    """
    return {
        "title": "MRPL High-Pressure Steam & Relief Network",
        "unit": "CDU-II / Utility Block",
        "system": "Superheated Steam Generation & Header Relief",
        "operatingPressureBar": 25.0,
        "operatingTempC": 480.0,
        "nodes": [
            {
                "id": "B-401",
                "tag": "B-401",
                "name": "High-Pressure Steam Boiler",
                "type": "boiler",
                "x": 80,
                "y": 140,
                "parameters": {
                    "Capacity": "120 t/h",
                    "Design MAWP": "160.0 bar",
                    "Operating Temp": "480°C",
                    "Effective MAWP @ 480°C": "128.8 bar",
                    "Design Standard": "ASME Sec I / SOP-401"
                },
                "status": "warning"
            },
            {
                "id": "PRV-102",
                "tag": "PRV-102",
                "name": "Header Safety Relief Valve",
                "type": "relief_valve",
                "x": 280,
                "y": 60,
                "parameters": {
                    "Set Pressure": "130.0 bar",
                    "Relief Capacity": "45 t/h",
                    "Discharge": "Flare Header F-01",
                    "Design Standard": "API 520 / ASME Sec VIII"
                },
                "status": "critical"
            },
            {
                "id": "V-102",
                "tag": "V-102",
                "name": "High-Pressure Flash Drum",
                "type": "vessel",
                "x": 380,
                "y": 140,
                "parameters": {
                    "Design Pressure": "25.0 bar",
                    "Operating Pressure": "24.5 bar",
                    "Wall Thickness": "34.0 mm",
                    "Corrosion Allowance": "3.0 mm",
                    "Design Standard": "ASME Sec VIII Div 1"
                },
                "status": "nominal"
            },
            {
                "id": "E-101",
                "tag": "E-101",
                "name": "HP Steam Superheater Exchanger",
                "type": "exchanger",
                "x": 580,
                "y": 140,
                "parameters": {
                    "Heat Duty": "18.4 MW",
                    "Tube Metallurgy": "2.25Cr-1Mo (P22)",
                    "Creep Limit": "15,000 hrs @ 480°C",
                    "Design Standard": "TEMA-R / ASME VIII"
                },
                "status": "warning"
            },
            {
                "id": "P-201",
                "tag": "P-201A/B",
                "name": "Boiler Feedwater Centrifugal Pump",
                "type": "pump",
                "x": 80,
                "y": 280,
                "parameters": {
                    "Flow Rate": "140 m³/h",
                    "Discharge Head": "180.0 bar",
                    "Driver": "Electric Motor 450 kW",
                    "Design Standard": "API 610"
                },
                "status": "nominal"
            }
        ],
        "pipes": [
            {
                "from": "P-201",
                "to": "B-401",
                "label": "BFW Feed (180 bar, 160°C)",
                "fluid": "Demin Water",
                "state": "normal"
            },
            {
                "from": "B-401",
                "to": "PRV-102",
                "label": "Header Relief Branch",
                "fluid": "HP Steam",
                "state": "hot"
            },
            {
                "from": "B-401",
                "to": "V-102",
                "label": "HP Main Steam (25 bar, 480°C)",
                "fluid": "HP Steam",
                "state": "hot"
            },
            {
                "from": "V-102",
                "to": "E-101",
                "label": "Saturated to Superheater",
                "fluid": "HP Steam",
                "state": "hot"
            }
        ],
        "safetyAdvisory": "Operating at 480°C reduces boiler effective MAWP to 128.8 bar, encroaches on PRV-102 setpoint, and accelerates creep on E-101 tubes."
    }

import re
import json
import logging
from typing import Dict, Any, List, Optional

logger = logging.getLogger("analytics_agent")

ANALYTICS_DIRECTIVE = """
VISUAL ANALYTICS & DYNAMIC CHART DIRECTIVE:
When the user asks for visual trends, comparative metrics, breakdowns, or performance graphs, you MUST include a dynamic industrial chart block using the exact syntax below.
Place the :::chart block naturally in your response where the visualization belongs.

Syntax:
:::chart
{
  "type": "line" | "bar" | "area" | "pie",
  "allowedTypes": ["line", "area"] | ["bar"] | ["pie", "bar"],
  "title": "Clear Technical Title",
  "description": "Brief 1-sentence engineering context",
  "xAxisKey": "temperature" | "unit" | "category" | "timestamp",
  "xAxisLabel": "X-Axis Label with Units",
  "yAxisLabel": "Y-Axis Label with Units",
  "series": [
    { "key": "data_key_1", "name": "Effective MAWP", "color": "#D97A3F" },
    { "key": "data_key_2", "name": "Safety Limit (SOP-401)", "color": "#10B981" }
  ],
  "data": [
    { "temperature": "350°C", "data_key_1": 160.0, "data_key_2": 100.0 },
    { "temperature": "380°C", "data_key_1": 152.8, "data_key_2": 100.0 },
    { "temperature": "420°C", "data_key_1": 143.2, "data_key_2": 100.0 },
    { "temperature": "460°C", "data_key_1": 133.6, "data_key_2": 100.0 },
    { "temperature": "500°C", "data_key_1": 124.0, "data_key_2": 100.0 }
  ]
}
:::

RULES FOR CHARTS:
1. CRITICAL: NEVER write `import matplotlib.pyplot as plt` or `plt.show()` to display charts in chat! You MUST output the dynamic :::chart JSON block directly so the interactive UI chart card renders in the workbench.
2. Ensure the JSON inside :::chart and ::: is 100% valid JSON with double quotes for all keys and strings.
3. CHART TYPE RELEVANCE:
   - For continuous temperature curves, pressure degradation, and thermal trends: use "type": "line" and "allowedTypes": ["line", "area"]. NEVER use "pie" for continuous curves.
   - For unit-to-unit comparisons (CDU-1 vs CDU-2 vs FCC): use "type": "bar" and "allowedTypes": ["bar"].
   - For component breakdowns or gas compositions (e.g. Methane 85%, Ethane 10%): use "type": "pie" and "allowedTypes": ["pie", "bar"].
4. Analog Darkroom Industrial Palette:
   - Primary Metric: Warm Amber (`#D97A3F`)
   - Safety Threshold / Compliance: Emerald (`#10B981`)
   - Secondary / Gold: Warm Gold (`#E5A84B`)
   - Critical Limit / Alert: Terracotta (`#B8443A`)
   - Cool Fluid / Gas: Sky Cyan (`#38BDF8`)
5. After the chart block, provide a concise technical commentary explaining the engineering implications.
6. MULTIPLE CHARTS: You CAN generate multiple distinct :::chart ... ::: blocks in a single response whenever the engineering context warrants it.
"""


def synthesize_chart_from_code_or_text(text: str) -> Optional[Dict[str, Any]]:
    """
    Fallback parser: If the model output contains Python/matplotlib lists or plotting code
    instead of the :::chart block, extract the numeric data points and synthesize a valid ChartSpec.
    """
    if not text or any(k in text.lower() for k in [":::chart", ":::stimulative", ":::stimulate", ":::simulation", ":::simulate", ":::graph", ":::plot", ":::interactive", ":::visualization", ":::analytics"]):
        return None

    # Search for list assignments like: temperature = [350, 380, 420, 460, 500]
    list_matches = re.findall(r"([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*\[([0-9.,\s\-]+)\]", text)
    parsed_lists = []
    for var_name, items_str in list_matches:
        try:
            nums = [float(x.strip()) for x in items_str.split(",") if x.strip()]
            if len(nums) >= 2:
                parsed_lists.append((var_name, nums))
        except Exception:
            continue

    if len(parsed_lists) < 2:
        return None

    # Pick first two numeric lists with matching lengths
    x_var, x_vals = parsed_lists[0]
    y_var, y_vals = parsed_lists[1]
    if len(x_vals) != len(y_vals):
        # Find matching pair
        for i in range(len(parsed_lists)):
            for j in range(i + 1, len(parsed_lists)):
                if len(parsed_lists[i][1]) == len(parsed_lists[j][1]):
                    x_var, x_vals = parsed_lists[i]
                    y_var, y_vals = parsed_lists[j]
                    break

    if len(x_vals) != len(y_vals):
        return None

    # Extract title and axis labels from plt calls or text context if available
    title_match = re.search(r"plt\.title\(['\"](.*?)['\"]\)", text) or re.search(r"(?:Chart|Plot):\s*([^\n]+)", text)
    title = title_match.group(1).strip() if title_match else f"{x_var.capitalize()} vs. {y_var.capitalize()}"

    xlabel_match = re.search(r"plt\.xlabel\(['\"](.*?)['\"]\)", text)
    xlabel = xlabel_match.group(1).strip() if xlabel_match else x_var.capitalize()

    ylabel_match = re.search(r"plt\.ylabel\(['\"](.*?)['\"]\)", text)
    ylabel = ylabel_match.group(1).strip() if ylabel_match else y_var.capitalize()

    data_points = []
    for xv, yv in zip(x_vals, y_vals):
        x_label_val = f"{int(xv)}°C" if "temp" in x_var.lower() and xv == int(xv) else (f"{int(xv)}" if xv == int(xv) else str(xv))
        data_points.append({
            x_var: x_label_val,
            y_var: round(yv, 2)
        })

    return {
        "type": "line",
        "allowedTypes": ["line", "area"],
        "title": title,
        "description": f"Engineered plot of {ylabel} across operating {xlabel}.",
        "xAxisKey": x_var,
        "xAxisLabel": xlabel,
        "yAxisLabel": ylabel,
        "series": [
            {
                "key": y_var,
                "name": ylabel,
                "color": "#D97A3F"
            }
        ],
        "data": data_points
    }


def extract_chart_specs(text: str) -> List[Dict[str, Any]]:
    """
    Extract and validate :::chart ... ::: (or aliased :::stimulative / :::simulation) blocks from response text.
    If no block is present but matplotlib/code lists exist, automatically synthesizes a chart spec.
    """
    if not text:
        return []

    matches = re.findall(r":::(?:chart|graph|plot|visualization|stimulative|stimulate|simulation|simulate|interactive|analytics)\s*([\s\S]*?):::", text, re.IGNORECASE)
    charts = []
    for raw_json in matches:
        raw_json_clean = raw_json.strip()
        parsed = None
        try:
            parsed = json.loads(raw_json_clean)
        except Exception:
            # Attempt to fix common trailing commas, single quotes, or minor JSON quirks
            fixed_json = re.sub(r",\s*([}\]])", r"\1", raw_json_clean)
            fixed_json = re.sub(r"'\s*:", r'":', fixed_json)
            fixed_json = re.sub(r":\s*'([^']*)'", r':"\1"', fixed_json)
            try:
                parsed = json.loads(fixed_json)
            except Exception as e:
                logger.warning(f"Failed to parse chart spec JSON: {e}")

        if isinstance(parsed, dict):
            if "data" in parsed and isinstance(parsed["data"], list):
                charts.append(parsed)
            elif "data" in parsed and isinstance(parsed["data"], dict):
                parsed["data"] = [parsed["data"]]
                charts.append(parsed)
            elif "series" in parsed:
                charts.append(parsed)

    # If no chart block was found, attempt fallback synthesis
    if not charts:
        synth = synthesize_chart_from_code_or_text(text)
        if synth:
            charts.append(synth)

    return charts


def create_chart_artifact(chart_spec: Dict[str, Any], artifact_id: str) -> Dict[str, Any]:
    """
    Transform a parsed chart spec into a sovereign workbench artifact.
    """
    title = chart_spec.get("title", "Industrial Performance Chart")
    filename = re.sub(r"[^a-zA-Z0-9_\-]", "_", title.lower()) + ".chart.json"
    
    return {
        "id": artifact_id,
        "title": f"{title} (Dynamic Chart)",
        "badge": "Chart · Interactive",
        "activeFile": filename,
        "chartSpec": chart_spec,
        "files": [
            {
                "name": filename,
                "language": "json",
                "content": json.dumps(chart_spec, indent=2)
            }
        ]
    }

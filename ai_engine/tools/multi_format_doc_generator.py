import os
import re
from typing import Dict, Any, List, Optional
from datetime import datetime
import markdown
# Import DOCX generator from existing tool
from ai_engine.tools.doc_generator import generate_docx_document

PDF_CSS_TEMPLATE = """
@page {
    size: A4;
    margin: 20mm 15mm 20mm 15mm;
    @bottom-right {
        content: "Page " counter(page) " of " counter(pages);
        font-family: monospace;
        font-size: 8pt;
        color: #71717a;
    }
    @bottom-left {
        content: "SOVEREIGN WORKBENCH ENCLAVE · ZERO EGRESS VERIFIED";
        font-family: monospace;
        font-size: 7.5pt;
        color: #a1a1aa;
    }
}
body {
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    color: #18181b;
    line-height: 1.6;
    font-size: 10.5pt;
}
h1 {
    color: #d97706;
    font-size: 18pt;
    border-bottom: 2px solid #d97706;
    padding-bottom: 4px;
    margin-top: 15px;
    margin-bottom: 12px;
}
h2 {
    color: #27272a;
    font-size: 14pt;
    margin-top: 20px;
    margin-bottom: 10px;
    border-bottom: 1px solid #e4e4e7;
    padding-bottom: 3px;
}
h3 {
    color: #52525b;
    font-size: 11pt;
    margin-top: 14px;
    margin-bottom: 6px;
}
p {
    margin-bottom: 10px;
}
pre, code {
    font-family: 'Consolas', 'Courier New', monospace;
    background: #f4f4f5;
    border-radius: 4px;
}
code {
    padding: 2px 4px;
    font-size: 9.5pt;
    color: #b45309;
}
pre {
    padding: 10px 14px;
    border-left: 3px solid #d97706;
    background: #18181b;
    color: #f4f4f5;
    font-size: 9pt;
    overflow-x: auto;
    margin: 12px 0;
    line-height: 1.45;
}
pre code {
    background: transparent;
    color: inherit;
    padding: 0;
}
table {
    width: 100%;
    border-collapse: collapse;
    margin: 16px 0;
    font-size: 9.5pt;
}
th, td {
    border: 1px solid #e4e4e7;
    padding: 8px 10px;
    text-align: left;
}
th {
    background-color: #f4f4f5;
    font-weight: bold;
    color: #18181b;
}
tr:nth-child(even) {
    background-color: #fafafa;
}
.meta-box {
    background: #fafafa;
    border: 1px solid #e4e4e7;
    border-left: 4px solid #d97706;
    padding: 12px 16px;
    margin-bottom: 22px;
    font-size: 9.5pt;
    line-height: 1.5;
}
.meta-box strong {
    color: #27272a;
}
.citations-table {
    margin-top: 25px;
}
"""

HTML_STANDALONE_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ title }}</title>
    <style>
        :root {
            --bg-color: #0c0a09;
            --surface-1: #171412;
            --surface-2: #241f1c;
            --border: #332a24;
            --accent: #d97706;
            --accent-light: #f59e0b;
            --text-primary: #f5f5f4;
            --text-muted: #a8a29e;
            --code-bg: #141210;
        }
        @media (prefers-color-scheme: light) {
            :root {
                --bg-color: #fafaf9;
                --surface-1: #ffffff;
                --surface-2: #f5f5f4;
                --border: #e7e5e4;
                --accent: #d97706;
                --accent-light: #b45309;
                --text-primary: #1c1917;
                --text-muted: #78716c;
                --code-bg: #f4f4f5;
            }
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            background-color: var(--bg-color);
            color: var(--text-primary);
            line-height: 1.65;
            margin: 0;
            padding: 30px 20px;
        }
        .container {
            max-width: 860px;
            margin: 0 auto;
            background: var(--surface-1);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 40px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.25);
        }
        h1 {
            color: var(--accent);
            font-size: 24px;
            border-bottom: 2px solid var(--accent);
            padding-bottom: 8px;
            margin-top: 0;
        }
        h2 {
            color: var(--text-primary);
            font-size: 18px;
            margin-top: 28px;
            border-bottom: 1px solid var(--border);
            padding-bottom: 6px;
        }
        h3 {
            font-size: 15px;
            color: var(--accent-light);
        }
        .meta-box {
            background: var(--surface-2);
            border: 1px solid var(--border);
            border-left: 4px solid var(--accent);
            border-radius: 4px;
            padding: 14px 18px;
            margin-bottom: 25px;
            font-size: 13px;
        }
        pre {
            background: var(--code-bg);
            border: 1px solid var(--border);
            border-radius: 6px;
            padding: 14px;
            overflow-x: auto;
            font-family: 'Consolas', 'Courier New', monospace;
            font-size: 13px;
        }
        code {
            font-family: 'Consolas', 'Courier New', monospace;
            font-size: 13px;
            background: var(--surface-2);
            padding: 2px 5px;
            border-radius: 4px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            font-size: 13.5px;
        }
        th, td {
            border: 1px solid var(--border);
            padding: 10px 12px;
            text-align: left;
        }
        th {
            background: var(--surface-2);
            font-weight: 600;
        }
        .footer {
            margin-top: 40px;
            padding-top: 15px;
            border-top: 1px solid var(--border);
            font-size: 12px;
            color: var(--text-muted);
            display: flex;
            justify-content: space-between;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="meta-box">
            <strong>DOCUMENT CLASSIFICATION:</strong> SOVEREIGN ENGINEERING WORKBENCH<br>
            <strong>TITLE:</strong> {{ title }}<br>
            <strong>AUTHOR:</strong> {{ author_name }} ({{ author_title }})<br>
            <strong>DATE:</strong> {{ date_str }}<br>
            <strong>SECURITY:</strong> AIR-GAP ISOLATED · LOCAL COMPUTATION
        </div>
        
        <div class="document-content">
            {{ html_body }}
        </div>

        {% if citations %}
        <div class="citations-section">
            <h2>Regulatory &amp; SOP References</h2>
            <table>
                <thead>
                    <tr>
                        <th>Document Ref</th>
                        <th>Page</th>
                        <th>Citation Snippet</th>
                    </tr>
                </thead>
                <tbody>
                    {% for c in citations %}
                    <tr>
                        <td>{{ c.document_id | default('Doc Ref') }}</td>
                        <td>{{ c.page_number | default(1) }}</td>
                        <td>{{ c.snippet | default('N/A') }}</td>
                    </tr>
                    {% endfor %}
                </tbody>
            </table>
        </div>
        {% endif %}

        <div class="footer">
            <span>Sovereign Enclave Certified</span>
            <span>Generated locally on-premise</span>
        </div>
    </div>
</body>
</html>
"""


def _clean_filename(title: str, ext: str) -> str:
    clean = re.sub(r'[^a-zA-Z0-9_\-]', '_', title.replace(" ", "_")).strip('_')
    if not clean:
        clean = "Document"
    if not clean.lower().endswith(f".{ext.lower()}"):
        return f"{clean}.{ext.lower()}"
    return clean


def generate_pdf_document(
    title: str,
    markdown_content: str,
    author_name: str = "Lead AI Architect",
    author_title: str = "Lead Operations Engineer",
    output_dir: str = "./backend/storage/artifacts",
    citations: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, str]:
    """
    Compiles markdown content with code snippets and citations into a styled A4 PDF document.
    """
    os.makedirs(output_dir, exist_ok=True)
    
    # Pre-process placeholders
    today_str = datetime.now().strftime("%B %d, %Y")
    processed_content = re.sub(r'\[(?:Insert|Your)?\s*(?:Name|Author|Inspector Name)[^\]]*\]', author_name, markdown_content, flags=re.IGNORECASE)
    processed_content = re.sub(r'\[(?:Insert|Your)?\s*(?:Title)[^\]]*\]', author_title, processed_content, flags=re.IGNORECASE)
    processed_content = re.sub(r'\[(?:Insert|Your)?\s*(?:Current\s+Date|Date|Today)[^\]]*\]', today_str, processed_content, flags=re.IGNORECASE)

    html_body = markdown.markdown(
        processed_content,
        extensions=['fenced_code', 'tables', 'codehilite', 'nl2br']
    )

    citations_html = ""
    if citations and len(citations) > 0:
        rows = "".join(
            f"<tr><td>{c.get('document_id', 'Doc Ref')}</td><td>{c.get('page_number', 1)}</td><td>{c.get('snippet', 'N/A')}</td></tr>"
            for c in citations
        )
        citations_html = f"""
        <div class="citations-table">
            <h2>Regulatory &amp; SOP References</h2>
            <table>
                <thead>
                    <tr><th>Document Ref</th><th>Page</th><th>Citation Snippet</th></tr>
                </thead>
                <tbody>
                    {rows}
                </tbody>
            </table>
        </div>
        """

    full_html = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>{title}</title>
    <style>{PDF_CSS_TEMPLATE}</style>
</head>
<body>
    <div class="meta-box">
        <strong>DOCUMENT CLASSIFICATION:</strong> SOVEREIGN ENGINEERING WORKBENCH<br>
        <strong>TITLE:</strong> {title}<br>
        <strong>AUTHOR:</strong> {author_name} ({author_title})<br>
        <strong>DATE:</strong> {today_str}<br>
        <strong>SECURITY STATUS:</strong> ENCLAVE ISOLATED · ZERO EGRESS
    </div>
    {html_body}
    {citations_html}
</body>
</html>"""

    filename = _clean_filename(f"{title}_Document", "pdf")
    file_path = os.path.join(output_dir, filename)

    try:
        # pyrefly: ignore [missing-import]
        import weasyprint
        weasyprint.HTML(string=full_html).write_pdf(file_path)
    except (ImportError, OSError, Exception) as e:
        # Fallback to saving styled standalone HTML print document if WeasyPrint C-libraries (GTK/libgobject) are missing
        html_filename = _clean_filename(f"{title}_Document", "html")
        html_file_path = os.path.join(output_dir, html_filename)
        with open(html_file_path, "w", encoding="utf-8") as f:
            f.write(full_html)
        return {
            "file_path": html_file_path,
            "filename": html_filename,
            "download_url": f"/api/v1/artifacts/download/{html_filename}",
            "format": "html",
            "warning": f"PDF engine fallback to HTML (WeasyPrint requires GTK libraries: {e})"
        }

    return {
        "file_path": file_path,
        "filename": filename,
        "download_url": f"/api/v1/artifacts/download/{filename}",
        "format": "pdf"
    }


def generate_html_document(
    title: str,
    markdown_content: str,
    author_name: str = "Lead AI Architect",
    author_title: str = "Lead Operations Engineer",
    output_dir: str = "./backend/storage/artifacts",
    citations: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, str]:
    """
    Compiles markdown content into a self-contained, standalone styled HTML archive.
    """
    # pyrefly: ignore [missing-import]
    from jinja2 import Template
    os.makedirs(output_dir, exist_ok=True)
    today_str = datetime.now().strftime("%B %d, %Y")

    html_body = markdown.markdown(
        markdown_content,
        extensions=['fenced_code', 'tables', 'codehilite', 'nl2br']
    )

    template = Template(HTML_STANDALONE_TEMPLATE)
    rendered_html = template.render(
        title=title,
        author_name=author_name,
        author_title=author_title,
        date_str=today_str,
        html_body=html_body,
        citations=citations or []
    )

    filename = _clean_filename(f"{title}_Document", "html")
    file_path = os.path.join(output_dir, filename)

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(rendered_html)

    return {
        "file_path": file_path,
        "filename": filename,
        "download_url": f"/api/v1/artifacts/download/{filename}",
        "format": "html"
    }


def generate_latex_document(
    title: str,
    markdown_content: str,
    author_name: str = "Lead AI Architect",
    author_title: str = "Lead Operations Engineer",
    output_dir: str = "./backend/storage/artifacts",
    citations: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, str]:
    """
    Compiles markdown content into clean, publication-ready LaTeX (.tex) source.
    """
    os.makedirs(output_dir, exist_ok=True)
    today_str = datetime.now().strftime("%B %d, %Y")

    def escape_latex(s: str) -> str:
        # Escape characters outside code blocks
        s = s.replace('\\', '\\textbackslash{}')
        s = s.replace('&', '\\&')
        s = s.replace('%', '\\%')
        s = s.replace('$', '\\$')
        s = s.replace('#', '\\#')
        s = s.replace('_', '\\_')
        s = s.replace('{', '\\{')
        s = s.replace('}', '\\}')
        s = s.replace('~', '\\textasciitilde{}')
        s = s.replace('^', '\\textasciicircum{}')
        return s

    lines = markdown_content.strip().split('\n')
    tex_body = []
    in_code = False
    code_lang = "text"
    current_code = []

    for line in lines:
        stripped = line.strip()
        if stripped.startswith("```"):
            if not in_code:
                in_code = True
                code_lang = stripped[3:].strip() or "text"
                current_code = []
            else:
                in_code = False
                joined_code = "\n".join(current_code)
                tex_body.append(f"\\begin{{lstlisting}}[language={code_lang}]\n{joined_code}\n\\end{{lstlisting}}\n")
            continue

        if in_code:
            current_code.append(line)
            continue

        if stripped.startswith("# "):
            tex_body.append(f"\\section{{{escape_latex(stripped[2:])}}}")
        elif stripped.startswith("## "):
            tex_body.append(f"\\subsection{{{escape_latex(stripped[3:])}}}")
        elif stripped.startswith("### "):
            tex_body.append(f"\\subsubsection{{{escape_latex(stripped[4:])}}}")
        elif stripped.startswith("* ") or stripped.startswith("- "):
            tex_body.append(f"\\item {escape_latex(stripped[2:])}")
        elif stripped:
            tex_body.append(f"{escape_latex(stripped)}\\par")

    joined_tex_body = "\n\n".join(tex_body)
    latex_content = f"""\\documentclass[11pt,a4paper]{{article}}
\\usepackage[utf8]{{inputenc}}
\\usepackage[margin=1in]{{geometry}}
\\usepackage{{hyperref}}
\\usepackage{{xcolor}}
\\usepackage{{listings}}
\\usepackage{{tcolorbox}}
\\usepackage{{amsmath}}

\\definecolor{{amberaccent}}{{RGB}}{{217, 119, 6}}
\\definecolor{{codegray}}{{RGB}}{{244, 244, 245}}
\\definecolor{{codeframe}}{{RGB}}{{228, 228, 231}}

\\lstset{{
    backgroundcolor=\\color{{codegray}},
    basicstyle=\\ttfamily\\small,
    breaklines=true,
    frame=single,
    rulecolor=\\color{{codeframe}},
    numbers=left,
    numberstyle=\\tiny\\color{{gray}},
    showstringspaces=false,
    tabsize=2
}}

\\title{{\\textbf{{\\color{{amberaccent}}{{{escape_latex(title)}}}}}}}
\\author{{{escape_latex(author_name)} \\\\ \\small{{{escape_latex(author_title)}}}}}
\\date{{{today_str}}}

\\begin{{document}}

\\maketitle

\\begin{{tcolorbox}}[colback=gray!5!white,colframe=amberaccent,title=SOVEREIGN WORKBENCH ENCLAVE CLASSIFICATION]
\\textbf{{CLASSIFICATION:}} ENCLAVE ISOLATED / AIR-GAP COMPLIANT \\\\
\\textbf{{AUTHOR:}} {escape_latex(author_name)} ({escape_latex(author_title)}) \\\\
\\textbf{{EXPORT DATE:}} {today_str}
\\end{{tcolorbox}}

\\vspace{{1em}}

{joined_tex_body}

\\end{{document}}
"""

    filename = _clean_filename(f"{title}_Document", "tex")
    file_path = os.path.join(output_dir, filename)

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(latex_content)

    return {
        "file_path": file_path,
        "filename": filename,
        "download_url": f"/api/v1/artifacts/download/{filename}",
        "format": "latex"
    }


def compile_document_all_formats(
    title: str,
    markdown_content: str,
    author_name: str = "Lead AI Architect",
    author_title: str = "Lead Operations Engineer",
    output_dir: str = "./backend/storage/artifacts",
    citations: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """
    Compiles markdown content into all 4 formats (.pdf, .docx, .tex, .html) simultaneously.
    """
    pdf_res = generate_pdf_document(title, markdown_content, author_name, author_title, output_dir, citations)
    docx_res = generate_docx_document(title, markdown_content, citations, output_dir, author_name, author_title)
    latex_res = generate_latex_document(title, markdown_content, author_name, author_title, output_dir, citations)
    html_res = generate_html_document(title, markdown_content, author_name, author_title, output_dir, citations)

    return {
        "title": title,
        "formats": {
            "pdf": pdf_res,
            "docx": docx_res,
            "latex": latex_res,
            "html": html_res
        }
    }

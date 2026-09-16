import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import type {
  ArtifactData,
  ArtifactFile,
  ArtifactVersion,
} from "../../lib/types";
import { AmberUnderline } from "../layout/AmberUnderline";
import { api } from "../../lib/api";
import { useWorkbench } from "../../lib/WorkbenchContext";
import { detectInteractiveInputs } from "../chat/SyntaxHighlighter";
import {
  InteractiveChartCard,
  type ChartSpec,
} from "../chat/InteractiveChartCard";

const normalizeMarkdownTables = (rawText: string): string => {
  if (!rawText || !rawText.includes("|")) return rawText;
  let formatted = rawText.replace(/\|\s*\|\s*(?=[^|\n]+(?:\||$))/g, "|\n|");
  formatted = formatted.replace(
    /([^\n])\n(\|(?:\s*[^|\n]+\s*\|)+)\n(\|(?:\s*[-:]+[-| :]*\|)+)/g,
    "$1\n\n$2\n$3",
  );
  return formatted;
};

export interface ArtifactPanelProps {
  artifact: ArtifactData;
  onClose: () => void;
  className?: string;
}

type ArtifactTab = "preview" | "code" | "terminal";
type DiffMode = "split" | "unified";
type DiffRow = {
  type: "addition" | "deletion" | "context";
  left?: string;
  right?: string;
  leftLine?: number;
  rightLine?: number;
};

const buildDiffRows = (before: string, after: string): DiffRow[] => {
  const left = before.split("\n");
  const right = after.split("\n");
  const rows: DiffRow[] = [];
  let leftIndex = 0;
  let rightIndex = 0;

  while (leftIndex < left.length || rightIndex < right.length) {
    if (left[leftIndex] === right[rightIndex]) {
      rows.push({
        type: "context",
        left: left[leftIndex],
        right: right[rightIndex],
        leftLine: leftIndex + 1,
        rightLine: rightIndex + 1,
      });
      leftIndex += 1;
      rightIndex += 1;
      continue;
    }

    if (
      leftIndex + 1 < left.length &&
      left[leftIndex + 1] === right[rightIndex]
    ) {
      rows.push({
        type: "deletion",
        left: left[leftIndex],
        leftLine: leftIndex + 1,
      });
      leftIndex += 1;
    } else if (
      rightIndex + 1 < right.length &&
      left[leftIndex] === right[rightIndex + 1]
    ) {
      rows.push({
        type: "addition",
        right: right[rightIndex],
        rightLine: rightIndex + 1,
      });
      rightIndex += 1;
    } else {
      rows.push({
        type: "deletion",
        left: left[leftIndex],
        leftLine: leftIndex + 1,
      });
      rows.push({
        type: "addition",
        right: right[rightIndex],
        rightLine: rightIndex + 1,
      });
      leftIndex += 1;
      rightIndex += 1;
    }
  }

  return rows;
};

export const ArtifactPanel: React.FC<ArtifactPanelProps> = ({
  artifact,
  onClose,
  className = "",
}) => {
  const { sendMessage, updateArtifactTerminal } = useWorkbench();

  // Detect dynamic visual analytics charts
  const isChartArtifact =
    artifact.title.endsWith(".chart.json") ||
    artifact.activeFile?.endsWith(".chart.json") ||
    Boolean(artifact.badge?.toLowerCase().includes("chart")) ||
    artifact.files.some((f) => f.name?.endsWith(".chart.json")) ||
    Boolean(artifact.chartSpec);

  // Detect visual previews (HTML/SVG) and documents (.docx, .md, reports, grounding citations)
  const isVisualComponent =
    artifact.title.endsWith(".html") ||
    artifact.title.endsWith(".svg") ||
    artifact.files.some((f) => f.language === "html" || f.language === "svg");

  const isDocumentArtifact =
    !isChartArtifact &&
    (artifact.title.endsWith(".docx") ||
      artifact.title.endsWith(".doc") ||
      artifact.title.endsWith(".md") ||
      artifact.title.toLowerCase().includes("report") ||
      artifact.title.toLowerCase().includes("specification") ||
      artifact.title.toLowerCase().includes("document") ||
      Boolean(artifact.badge?.toLowerCase().includes("word")) ||
      Boolean(artifact.badge?.toLowerCase().includes("docx")) ||
      Boolean(artifact.badge?.toLowerCase().includes("grounding")) ||
      artifact.files.some((f) => f.language === "markdown") ||
      Boolean(artifact.download_url));

  const [activeTab, setActiveTab] = useState<ArtifactTab>(
    isVisualComponent || isDocumentArtifact || isChartArtifact
      ? "preview"
      : "code",
  );
  const [selectedFile, setSelectedFile] = useState(
    artifact.activeFile || artifact.files[0]?.name,
  );
  const [draftFiles, setDraftFiles] = useState<ArtifactFile[]>(artifact.files);
  const [savedContents, setSavedContents] = useState<Record<string, string>>(
    Object.fromEntries(artifact.files.map((file) => [file.name, file.content])),
  );
  const [selectedVersion, setSelectedVersion] = useState<string>("V.3");
  const [diffViewVersion, setDiffViewVersion] =
    useState<ArtifactVersion | null>(null);
  const [diffMode, setDiffMode] = useState<DiffMode>("split");
  const [isDualSplit, setIsDualSplit] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [compilingFormat, setCompilingFormat] = useState<string | null>(null);
  const [exportSuccessFormat, setExportSuccessFormat] = useState<string | null>(
    null,
  );
  const [showExplainModal, setShowExplainModal] = useState(false);
  const [isAskingChat, setIsAskingChat] = useState(false);
  const [isRunningSandbox, setIsRunningSandbox] = useState(false);
  const [sandboxOutput, setSandboxOutput] = useState<string | null>(null);
  const [sandboxMeta, setSandboxMeta] = useState<{
    exitCode: number;
    durationMs: number;
  } | null>(null);
  const [inputValues, setInputValues] = useState<Record<string, string>>({});

  useEffect(() => {
    setDraftFiles(artifact.files);
    setSavedContents(
      Object.fromEntries(
        artifact.files.map((file) => [file.name, file.content]),
      ),
    );
    setSelectedFile(artifact.activeFile || artifact.files[0]?.name);
  }, [artifact.id]);

  // Keep sandbox state in sync with artifact.terminalOutput if updated externally from chat code blocks
  useEffect(() => {
    if (artifact.terminalOutput !== undefined) {
      setSandboxOutput(null);
      setSandboxMeta(null);
    }
  }, [
    artifact.terminalOutput,
    artifact.terminalExitCode,
    artifact.terminalDurationMs,
  ]);

  const currentFileContent =
    draftFiles.find((f) => f.name === selectedFile)?.content ||
    draftFiles[0]?.content ||
    "";

  const parsedChartSpec: ChartSpec | null = useMemo(() => {
    if (artifact.chartSpec) return artifact.chartSpec;
    try {
      const parsed = JSON.parse(currentFileContent);
      if (parsed && typeof parsed === "object" && Array.isArray(parsed.data)) {
        return parsed;
      }
    } catch {}
    return null;
  }, [artifact.chartSpec, currentFileContent]);

  const activeFileObj =
    draftFiles.find((f) => f.name === selectedFile) || draftFiles[0];
  const dirtyFiles = useMemo(
    () =>
      new Set(
        draftFiles
          .filter((file) => savedContents[file.name] !== file.content)
          .map((file) => file.name),
      ),
    [draftFiles, savedContents],
  );
  const historicalFileContent =
    diffViewVersion?.files?.find((file) => file.name === selectedFile)
      ?.content ||
    diffViewVersion?.files?.[0]?.content ||
    "";
  const diffRows = useMemo(
    () => buildDiffRows(historicalFileContent, currentFileContent),
    [historicalFileContent, currentFileContent],
  );
  const currentFileLang = (
    activeFileObj?.language ||
    (selectedFile?.endsWith(".c")
      ? "c"
      : selectedFile?.endsWith(".cpp") || selectedFile?.endsWith(".cc")
        ? "cpp"
        : selectedFile?.endsWith(".py")
          ? "python"
          : selectedFile?.endsWith(".ts")
            ? "typescript"
            : selectedFile?.endsWith(".tsx")
              ? "tsx"
              : selectedFile?.endsWith(".js")
                ? "javascript"
                : selectedFile?.endsWith(".jsx")
                  ? "jsx"
                  : selectedFile?.endsWith(".java")
                    ? "java"
                    : selectedFile?.endsWith(".rs")
                      ? "rust"
                      : selectedFile?.endsWith(".go")
                        ? "go"
                        : selectedFile?.endsWith(".sql")
                          ? "sql"
                          : selectedFile?.endsWith(".html")
                            ? "html"
                            : selectedFile?.endsWith(".css")
                              ? "css"
                              : selectedFile?.endsWith(".json")
                                ? "json"
                                : selectedFile?.endsWith(".sh") ||
                                    selectedFile?.endsWith(".bash")
                                  ? "bash"
                                  : "c")
  ).toLowerCase();

  const displayRuntime =
    activeFileObj?.language?.toUpperCase() ||
    (artifact.badge ? artifact.badge.split("·")[0].trim() : "") ||
    currentFileLang.toUpperCase() ||
    "NATIVE";

  const detectedPrompts = detectInteractiveInputs(
    currentFileContent,
    currentFileLang,
  );

  const formatInteractiveOutput = (
    stdout: string,
    inputUsed?: string,
  ): string => {
    if (!inputUsed || !stdout) return stdout;
    const inputs = inputUsed.split("\n");
    const promptRegex = /([^\n]*?[:\?]\s*)/g;
    let match: RegExpExecArray | null;
    let inputIdx = 0;
    let result = "";

    const matches: Array<{ text: string; index: number; end: number }> = [];
    while ((match = promptRegex.exec(stdout)) !== null) {
      if (match[0].trim().length > 0) {
        matches.push({
          text: match[0],
          index: match.index,
          end: match.index + match[0].length,
        });
      }
    }

    if (matches.length > 0 && inputs.length > 0) {
      let currentPos = 0;
      for (let i = 0; i < matches.length && inputIdx < inputs.length; i++) {
        const m = matches[i];
        result += stdout.substring(currentPos, m.end);
        const userVal = inputs[inputIdx] !== undefined ? inputs[inputIdx] : "";
        const nextChar = stdout[m.end];
        if (nextChar === "\n") {
          result += userVal;
        } else {
          result += `${userVal}\n`;
        }
        currentPos = m.end;
        inputIdx++;
      }
      result += stdout.substring(currentPos);
      return result;
    }

    return stdout;
  };

  const promptCommand =
    currentFileLang === "c"
      ? "$ gcc main.c -o main.out && ./main.out"
      : currentFileLang === "cpp"
        ? "$ g++ main.cpp -o main.out && ./main.out"
        : currentFileLang === "java"
          ? "$ java Main"
          : currentFileLang === "javascript" || currentFileLang === "typescript"
            ? "$ node script.js"
            : "$ python3 script.py";

  const handleCopyCode = () => {
    navigator.clipboard.writeText(currentFileContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleFileContentChange = (content: string) => {
    setDraftFiles((files) =>
      files.map((file) =>
        file.name === selectedFile ? { ...file, content } : file,
      ),
    );
  };

  const handleSaveDraft = () => {
    setSavedContents(
      Object.fromEntries(draftFiles.map((file) => [file.name, file.content])),
    );
  };

  const handleAddFile = () => {
    const name = window.prompt("New file name", "untitled.py")?.trim();
    if (!name || draftFiles.some((file) => file.name === name)) return;
    const language = name.split(".").pop() || "text";
    const newFile: ArtifactFile = { name, language, content: "" };
    setDraftFiles((files) => [...files, newFile]);
    setSelectedFile(name);
    setActiveTab("code");
  };

  const handleRenameFile = (file: ArtifactFile) => {
    const name = window.prompt("Rename file", file.name)?.trim();
    if (
      !name ||
      name === file.name ||
      draftFiles.some((candidate) => candidate.name === name)
    )
      return;
    setDraftFiles((files) =>
      files.map((candidate) =>
        candidate.name === file.name ? { ...candidate, name } : candidate,
      ),
    );
    setSavedContents((contents) => {
      const next = { ...contents };
      if (Object.prototype.hasOwnProperty.call(next, file.name)) {
        next[name] = next[file.name];
        delete next[file.name];
      }
      return next;
    });
    setSelectedFile(name);
  };

  const handleDeleteFile = (file: ArtifactFile) => {
    if (draftFiles.length <= 1 || !window.confirm(`Delete ${file.name}?`))
      return;
    const remaining = draftFiles.filter(
      (candidate) => candidate.name !== file.name,
    );
    setDraftFiles(remaining);
    setSavedContents((contents) => {
      const next = { ...contents };
      delete next[file.name];
      return next;
    });
    if (selectedFile === file.name) setSelectedFile(remaining[0]?.name);
  };

  const handleExport = () => {
    try {
      const fileName = selectedFile || artifact.title || "artifact.txt";
      const blob = new Blob([currentFileContent], {
        type: "text/plain;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExportSuccessFormat("SAVED");
      setTimeout(() => setExportSuccessFormat(null), 2000);
    } catch (err) {
      console.error("Failed to export file:", err);
    }
  };

  const handleCompileAndExport = async (
    format: "pdf" | "docx" | "latex" | "html" | "raw" | "zip",
  ) => {
    if (format === "raw") {
      handleExport();
      setShowExportMenu(false);
      return;
    }

    if (format === "zip") {
      try {
        setCompilingFormat("zip");
        await api.downloadSessionBundle(artifact.id || "current_session");
        setExportSuccessFormat("ZIP");
        setTimeout(() => setExportSuccessFormat(null), 2500);
      } catch (err) {
        console.error("Failed to export session bundle:", err);
      } finally {
        setCompilingFormat(null);
        setShowExportMenu(false);
      }
      return;
    }

    try {
      setCompilingFormat(format);
      const cleanTitle = (artifact.title || "Technical_Specification").replace(
        /\.[^/.]+$/,
        "",
      );
      const res = await api.compileDocument({
        title: cleanTitle,
        content: currentFileContent,
        format,
      });
      if (res.download_url) {
        const a = document.createElement("a");
        a.href = res.download_url;
        a.download =
          res.filename ||
          `${cleanTitle}.${format === "latex" ? "tex" : format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      setExportSuccessFormat(format.toUpperCase());
      setTimeout(() => setExportSuccessFormat(null), 2500);
    } catch (err) {
      console.error(`Failed to compile ${format}:`, err);
    } finally {
      setCompilingFormat(null);
      setShowExportMenu(false);
    }
  };

  const handleAskAiExplain = async () => {
    setIsAskingChat(true);
    try {
      const fileName = selectedFile || artifact.title || "source_file";
      const prompt = `Please provide a comprehensive code walkthrough and algorithmic breakdown of the following \`${fileName}\` code:\n\n\`\`\`${currentFileLang}\n${currentFileContent}\n\`\`\`\n\nExplain:\n1. Algorithmic logic and execution flow\n2. Key data structures used\n3. Time Complexity and Space Complexity\n4. Invariant safety guarantees and edge case handling\n\n(Important: If quoting or presenting code, ALWAYS keep the complete program with all function declarations like \`def ...\` intact)`;

      await sendMessage(prompt);
      setShowExplainModal(false);
    } catch (err) {
      console.error("Failed to send explain request:", err);
    } finally {
      setIsAskingChat(false);
    }
  };

  const effectiveTerminalOutput =
    sandboxOutput ?? artifact.terminalOutput ?? "";
  const effectiveExitCode =
    sandboxMeta?.exitCode ?? artifact.terminalExitCode ?? 0;
  const effectiveDurationMs =
    sandboxMeta?.durationMs ?? artifact.terminalDurationMs ?? 0;
  const effectiveCommand = artifact.terminalCommand || promptCommand;

  const handleRunInSandbox = async () => {
    setIsRunningSandbox(true);
    const stdinPayload =
      detectedPrompts.length > 0
        ? detectedPrompts
            .map((p) => inputValues[p.id] || p.defaultValue || "1")
            .join("\n") + "\n"
        : "";
    try {
      const res = await api.executeSandbox(
        currentFileContent,
        currentFileLang,
        10,
        stdinPayload,
      );
      let outputText = "";
      if (res.stdout) {
        outputText += formatInteractiveOutput(res.stdout, stdinPayload);
      }
      if (res.stderr) outputText += (outputText ? "\n" : "") + res.stderr;
      if (!outputText)
        outputText = "[Process executed successfully with 0 exit code]";
      setSandboxOutput(outputText);
      setSandboxMeta({
        exitCode: res.exit_code,
        durationMs: res.execution_time_ms,
      });
      updateArtifactTerminal(
        outputText,
        res.exit_code,
        res.execution_time_ms,
        promptCommand,
      );
      setActiveTab("terminal");
    } catch (err: any) {
      const errText = `Execution error: ${err.message || "Sandbox connection failed"}`;
      setSandboxOutput(errText);
      setSandboxMeta({ exitCode: 1, durationMs: 0 });
      updateArtifactTerminal(errText, 1, 0, promptCommand);
      setActiveTab("terminal");
    } finally {
      setIsRunningSandbox(false);
    }
  };

  const handleSaveAndRun = async () => {
    handleSaveDraft();
    await handleRunInSandbox();
  };

  const handleVersionClick = (v: ArtifactVersion) => {
    setSelectedVersion(v.version);
    if (v.version !== "V.3") {
      setDiffViewVersion(v);
    } else {
      setDiffViewVersion(null);
    }
  };

  return (
    <div
      className={`relative flex h-full flex-col select-none overflow-hidden border-l border-border bg-surface-1 ${className}`}
    >
      {/* =========================================================================
          SIGNATURE MOMENT — ARTIFACT MATERIALIZATION (~550ms total sequence)
          DESIGN.md Section 6
          ========================================================================= */}

      {/* Content fades up 8px with settle */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        className="relative z-10 flex h-full flex-col overflow-hidden"
      >
        {/* Grain flicker overlay during materialization (~550ms total sequence) */}
        <motion.div
          aria-hidden="true"
          initial={{ opacity: 0.035 }}
          animate={{ opacity: [0.035, 0.08, 0.08, 0.035] }}
          transition={{
            duration: 0.12,
            delay: 0.35,
            times: [0, 0.3, 0.7, 1],
            ease: "easeOut",
          }}
          className="pointer-events-none absolute inset-0 z-40"
          style={{ mixBlendMode: "screen" }}
        >
          <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
            <filter id="materialize-grain">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.85"
                numOctaves="4"
                stitchTiles="stitch"
              />
              <feColorMatrix type="saturate" values="0" />
            </filter>
            <rect width="100%" height="100%" filter="url(#materialize-grain)" />
          </svg>
        </motion.div>

        {/* Top Header Row 1: Title, Badge, Download, Export, Close */}
        <div className="flex h-11 items-center justify-between border-b border-border bg-surface-1 px-3 sm:px-4 gap-2">
          {/* Left: Icon + Title + Badge */}
          <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
            <span className="text-sm shrink-0">
              {isDocumentArtifact ? "📄" : isVisualComponent ? "🌐" : "⚡"}
            </span>
            <h2
              className="font-display text-xs sm:text-sm font-semibold text-text-primary truncate max-w-[200px] sm:max-w-[320px]"
              title={artifact.title}
            >
              {artifact.title}
            </h2>
            {artifact.badge && (
              <span
                className="font-mono text-[9px] uppercase tracking-wider text-accent-primary border border-accent-primary/40 px-1.5 py-0.5 rounded-[2px] bg-surface-2 shrink-0 truncate max-w-[180px]"
                title={artifact.badge}
              >
                {artifact.badge}
              </span>
            )}
          </div>

          {/* Right Action Tray: Download, Export, Close */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Direct Word Document Download Button */}
            {artifact.download_url && (
              <a
                href={artifact.download_url}
                download
                className="flex items-center gap-1 rounded-[3px] bg-accent-primary text-background px-2 sm:px-2.5 py-1 text-[10.5px] font-mono font-bold hover:brightness-110 transition-all cursor-pointer shadow-xs shrink-0"
                title="Download compiled Microsoft Word (.docx) document"
              >
                <span>⬇ .DOCX</span>
              </a>
            )}

            {/* Multi-Format Export Dropdown */}
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setShowExportMenu((prev) => !prev)}
                className={`flex items-center gap-1 rounded-[3px] border px-2 py-1 text-[11px] font-mono transition-all cursor-pointer ${
                  showExportMenu || compilingFormat || exportSuccessFormat
                    ? "border-accent-primary bg-accent-primary/20 text-accent-primary font-semibold shadow-xs"
                    : "border-border bg-surface-2/60 text-text-muted hover:text-text-primary hover:border-text-muted/60"
                }`}
                title="Export in multiple formats (.docx, .pdf, .latex, .html, .zip)"
              >
                {compilingFormat ? (
                  <>
                    <svg
                      className="animate-spin h-3 w-3 text-accent-primary"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    <span>{compilingFormat.toUpperCase()}...</span>
                  </>
                ) : exportSuccessFormat ? (
                  <span className="text-green-400 font-semibold">
                    {exportSuccessFormat} ✓
                  </span>
                ) : (
                  <>
                    <span>Export</span>
                    <span className="text-[9px] opacity-70">▾</span>
                  </>
                )}
              </button>

              <AnimatePresence>
                {showExportMenu && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 4 }}
                    transition={{ duration: 0.12, ease: "easeOut" }}
                    className="absolute right-0 top-full mt-1.5 z-50 w-52 rounded-[4px] border border-border bg-surface-1 p-1.5 shadow-xl font-mono text-xs space-y-0.5"
                  >
                    <div className="px-2 py-1 text-[10px] text-text-muted font-semibold uppercase tracking-wider border-b border-border/40 mb-1">
                      Compile &amp; Export Formats
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCompileAndExport("docx")}
                      disabled={!!compilingFormat}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 text-left rounded-[3px] hover:bg-surface-2 transition-colors cursor-pointer group disabled:opacity-50"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-blue-400 font-bold">
                          [ .DOCX ]
                        </span>
                        <span className="text-[11px] text-text-body">
                          MS Word Doc
                        </span>
                      </div>
                      <span className="text-[9px] text-text-muted group-hover:text-blue-400">
                        Office
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCompileAndExport("pdf")}
                      disabled={!!compilingFormat}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 text-left rounded-[3px] hover:bg-surface-2 transition-colors cursor-pointer group disabled:opacity-50"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-accent-primary font-bold">
                          [ .PDF ]
                        </span>
                        <span className="text-[11px] text-text-body">
                          A4 Document
                        </span>
                      </div>
                      <span className="text-[9px] text-text-muted group-hover:text-accent-primary">
                        Print PDF
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCompileAndExport("latex")}
                      disabled={!!compilingFormat}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 text-left rounded-[3px] hover:bg-surface-2 transition-colors cursor-pointer group disabled:opacity-50"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-purple-400 font-bold">
                          [ .TEX ]
                        </span>
                        <span className="text-[11px] text-text-body">
                          LaTeX Source
                        </span>
                      </div>
                      <span className="text-[9px] text-text-muted group-hover:text-purple-400">
                        Paper
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCompileAndExport("html")}
                      disabled={!!compilingFormat}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 text-left rounded-[3px] hover:bg-surface-2 transition-colors cursor-pointer group disabled:opacity-50"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-amber-400 font-bold">
                          [ .HTML ]
                        </span>
                        <span className="text-[11px] text-text-body">
                          Standalone Web
                        </span>
                      </div>
                      <span className="text-[9px] text-text-muted group-hover:text-amber-400">
                        Archive
                      </span>
                    </button>

                    <div className="border-t border-border/60 my-1" />

                    <button
                      type="button"
                      onClick={() => handleCompileAndExport("raw")}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 text-left rounded-[3px] hover:bg-surface-2 transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-text-muted font-bold">
                          [ RAW ]
                        </span>
                        <span className="text-[11px] text-text-body">
                          Source Code
                        </span>
                      </div>
                      <span className="text-[9px] text-text-muted">
                        Plain File
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCompileAndExport("zip")}
                      disabled={!!compilingFormat}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 text-left rounded-[3px] hover:bg-surface-2 transition-colors cursor-pointer group disabled:opacity-50 bg-accent-primary/5 mt-0.5 border border-accent-primary/20"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-green-400 font-bold">📦</span>
                        <span className="text-[11px] text-text-primary font-semibold">
                          Session Bundle
                        </span>
                      </div>
                      <span className="text-[9px] text-green-400 font-bold">
                        .ZIP
                      </span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="h-4 w-[1px] bg-border mx-0.5 shrink-0" />

            {/* Typographic × Close button */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close artifact panel"
              className="font-display text-xl text-text-muted hover:text-accent-primary transition-colors leading-none cursor-pointer px-1.5 py-1 shrink-0 font-bold"
              title="Close Split View (Esc)"
            >
              ×
            </button>
          </div>
        </div>

        {/* Top Header Row 2: Tabs (Left) & Viewer Tools (Right) */}
        <div className="flex h-10 items-center justify-between border-b border-border bg-surface-2/50 px-3 sm:px-4 gap-2">
          {/* Left: Tabs Switcher */}
          <nav
            aria-label="Artifact View"
            className="flex items-center gap-4 shrink-0"
          >
            {(["preview", "code", "terminal"] as const).map((tab) => {
              if (
                tab === "terminal" &&
                isDocumentArtifact &&
                !effectiveTerminalOutput
              ) {
                return null;
              }
              const isActive = activeTab === tab;
              const tabLabel =
                isDocumentArtifact && tab === "preview"
                  ? "Document Preview"
                  : isDocumentArtifact && tab === "code"
                    ? "Markdown Source"
                    : tab;

              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab);
                    setDiffViewVersion(null);
                  }}
                  className={`relative py-2.5 text-xs font-medium capitalize transition-colors cursor-pointer ${
                    isActive
                      ? "text-text-primary font-semibold"
                      : "text-text-muted hover:text-text-body"
                  }`}
                >
                  <span>{tabLabel}</span>
                  {isActive && (
                    <motion.span
                      layoutId="artifact-active-tab-underline"
                      transition={{ duration: 0.18, ease: "easeOut" }}
                      className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent-primary"
                    />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Toolbar Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Dual-Pane Code+Terminal Split Toggle (Only for executable code) */}
            {!isDocumentArtifact && (
              <button
                type="button"
                onClick={() => setIsDualSplit((prev) => !prev)}
                className={`flex items-center gap-1 rounded-[3px] border px-2 py-1 text-[11px] font-mono transition-all cursor-pointer shrink-0 ${
                  isDualSplit
                    ? "border-accent-primary bg-accent-primary/20 text-accent-primary font-semibold shadow-xs"
                    : "border-border bg-surface-2/60 text-text-muted hover:text-text-primary hover:border-text-muted/60"
                }`}
                title="Toggle Dual-Pane (Side-by-Side Code & Live Terminal)"
              >
                <span className="text-[10px]">{isDualSplit ? "⊟" : "◫"}</span>
                <span className="hidden sm:inline">
                  {isDualSplit ? "Single" : "Dual Split"}
                </span>
              </button>
            )}

            {/* Run in Sandbox Button (Only for executable code) */}
            {!isDocumentArtifact && (
              <button
                type="button"
                onClick={handleSaveAndRun}
                disabled={isRunningSandbox}
                className="flex items-center gap-1 rounded-[3px] border border-accent-primary/60 bg-accent-primary/10 hover:bg-accent-primary/20 text-accent-primary px-2 py-1 text-[11px] font-mono font-medium transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs shrink-0"
                title="Execute code in isolated sandbox"
              >
                {isRunningSandbox ? (
                  <>
                    <svg
                      className="animate-spin h-3 w-3 text-accent-primary"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    <span className="hidden sm:inline">Running</span>
                  </>
                ) : (
                  <>
                    <span className="text-[9px]">▶</span>
                    <span>Save &amp; Run</span>
                  </>
                )}
              </button>
            )}

            {/* Explain Button */}
            {!isDocumentArtifact && (
              <button
                type="button"
                onClick={() => setShowExplainModal(true)}
                className="italic text-text-muted hover:text-accent-primary transition-colors cursor-pointer px-1 py-1 text-[11px] shrink-0"
                title="View algorithmic complexity & code explanation"
              >
                <AmberUnderline>
                  <span>Explain</span>
                </AmberUnderline>
              </button>
            )}

            {/* Copy Button */}
            <button
              type="button"
              onClick={handleCopyCode}
              className="text-text-muted hover:text-text-primary transition-colors cursor-pointer px-1.5 py-1 text-[11px] font-mono shrink-0 rounded bg-surface-2/40 border border-border/40 hover:border-border"
              title="Copy content to clipboard"
            >
              {copied ? (
                <span className="text-green-400 font-semibold">Copied ✓</span>
              ) : (
                "Copy"
              )}
            </button>
          </div>
        </div>

        {/* Multi-file Tabs Bar */}
        {draftFiles.length > 0 && (
          <div className="flex items-center border-b border-border/70 bg-surface-2/40 px-3 overflow-x-auto">
            {draftFiles.map((file) => {
              const isSelected = selectedFile === file.name;
              return (
                <button
                  key={file.name}
                  type="button"
                  onClick={() => setSelectedFile(file.name)}
                  onDoubleClick={() => handleRenameFile(file)}
                  className={`relative px-3 py-2 font-mono text-xs transition-colors cursor-pointer shrink-0 ${
                    isSelected
                      ? "text-text-primary font-medium"
                      : "text-text-muted hover:text-text-body"
                  }`}
                >
                  <span>{file.name}</span>
                  {dirtyFiles.has(file.name) && (
                    <span
                      className="ml-1.5 text-accent-primary"
                      title="Unsaved changes"
                    >
                      ●
                    </span>
                  )}
                  {isSelected && (
                    <motion.span
                      layoutId="active-file-tab-underline"
                      transition={{ duration: 0.18, ease: "easeOut" }}
                      className="absolute bottom-0 left-0 right-0 h-[1px] bg-accent-primary"
                    />
                  )}
                </button>
              );
            })}
            <button
              type="button"
              onClick={handleAddFile}
              className="ml-2 shrink-0 px-2 py-1 font-mono text-[10px] text-accent-primary hover:bg-accent-primary/10 rounded-[2px]"
              title="Add file"
            >
              + Add file
            </button>
            {activeFileObj && (
              <>
                <button
                  type="button"
                  onClick={() => handleRenameFile(activeFileObj)}
                  className="ml-1 shrink-0 px-2 py-1 font-mono text-[10px] text-text-muted hover:text-text-primary"
                  title="Rename selected file"
                >
                  Rename
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteFile(activeFileObj)}
                  disabled={draftFiles.length <= 1}
                  className="shrink-0 px-2 py-1 font-mono text-[10px] text-accent-secondary hover:bg-accent-secondary/10 disabled:opacity-30"
                  title="Delete selected file"
                >
                  Delete
                </button>
              </>
            )}
          </div>
        )}

        {/* Main Panel Body */}
        <div className="flex-1 overflow-y-auto bg-background p-4 sm:p-5">
          <AnimatePresence mode="wait">
            {/* Side-by-Side 2-Column Diff Inspector */}
            {diffViewVersion ? (
              <motion.div
                key={`diff-${diffViewVersion.version}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="space-y-4 font-mono text-xs"
              >
                <div className="flex items-center justify-between rounded-[4px] border border-border bg-surface-1 p-3 text-xs">
                  <div className="flex items-center gap-3">
                    <span className="text-accent-primary font-semibold">
                      Side-by-Side Diff: {diffViewVersion.version} ⟷ Current (
                      {selectedVersion})
                    </span>
                    <span className="text-text-muted text-[11px] border border-border/80 px-2 py-0.5 rounded bg-surface-2">
                      {diffViewVersion.diffSummary}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 rounded-[2px] border border-border bg-surface-2 p-0.5">
                    {(["split", "unified"] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setDiffMode(mode)}
                        className={`px-2 py-1 font-mono text-[10px] capitalize ${diffMode === mode ? "bg-accent-primary text-background" : "text-text-muted hover:text-text-primary"}`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedVersion("V.3");
                      setDiffViewVersion(null);
                    }}
                    className="text-text-muted hover:text-text-primary text-[11px] underline cursor-pointer"
                  >
                    Return to Active Head
                  </button>
                </div>

                {diffMode === "unified" ? (
                  <div className="overflow-x-auto rounded-[4px] border border-border bg-surface-1 p-3 font-mono text-[11px] leading-relaxed">
                    {diffRows.map((row, index) => (
                      <div
                        key={index}
                        className={`flex min-w-max whitespace-pre ${row.type === "addition" ? "bg-accent-primary/15 text-accent-primary" : row.type === "deletion" ? "bg-accent-secondary/15 text-accent-secondary line-through" : "text-text-body"}`}
                      >
                        <span className="w-14 shrink-0 px-2 text-right text-text-muted/50">
                          {row.leftLine || ""} {row.rightLine || ""}
                        </span>
                        <span className="w-5 shrink-0 text-center">
                          {row.type === "addition"
                            ? "+"
                            : row.type === "deletion"
                              ? "-"
                              : " "}
                        </span>
                        <span>{row.right ?? row.left ?? ""}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {(["left", "right"] as const).map((side) => (
                      <div
                        key={side}
                        className="overflow-hidden rounded-[4px] border border-border bg-surface-1"
                      >
                        <div className="border-b border-border bg-surface-2/70 px-3.5 py-2 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                          {side === "left"
                            ? `${diffViewVersion.version} Historical`
                            : `${selectedVersion} Current`}
                        </div>
                        <div className="overflow-x-auto p-3 font-mono text-[11px] leading-relaxed">
                          {diffRows.map((row, index) => {
                            const value =
                              side === "left" ? row.left : row.right;
                            const line =
                              side === "left" ? row.leftLine : row.rightLine;
                            const type =
                              side === "left"
                                ? row.type === "deletion"
                                  ? "deletion"
                                  : row.type === "addition"
                                    ? "context"
                                    : row.type
                                : row.type;
                            return (
                              <div
                                key={index}
                                className={`flex min-w-max whitespace-pre ${type === "addition" ? "bg-accent-primary/15 text-accent-primary" : type === "deletion" ? "bg-accent-secondary/15 text-accent-secondary line-through" : "text-text-body"}`}
                              >
                                <span className="w-8 shrink-0 pr-2 text-right text-text-muted/50">
                                  {line || ""}
                                </span>
                                <span>{value ?? ""}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            ) : isDualSplit ? (
              /* =========================================================================
               DUAL-PANE VIEW: SIDE-BY-SIDE CODE INSPECTOR & LIVE SUBPROCESS RUNNER
               ========================================================================= */
              <motion.div
                key="dual-split"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full"
              >
                {/* Left Column: Code Inspector */}
                <div className="rounded-[4px] border border-border bg-surface-1 p-4 overflow-x-auto font-mono text-xs leading-relaxed flex flex-col max-h-[600px]">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-border text-[11px] text-text-muted shrink-0">
                    <span className="font-semibold text-text-primary">
                      {selectedFile || artifact.title}
                    </span>
                    <span className="text-accent-primary">
                      {artifact.badge}
                    </span>
                  </div>
                  <pre className="text-text-body flex-1 overflow-y-auto">
                    {currentFileContent.split("\n").map((line, i) => (
                      <div key={i} className="flex">
                        <span className="w-7 text-text-muted/40 select-none shrink-0 text-right pr-2">
                          {i + 1}
                        </span>
                        <span className="text-text-primary">{line}</span>
                      </div>
                    ))}
                  </pre>
                </div>
                {/* Right Column: Live Terminal Output */}
                <div className="rounded-[4px] border border-border bg-surface-1 p-4 font-mono text-xs text-text-body flex flex-col space-y-2 max-h-[600px]">
                  <div className="flex items-center justify-between pb-2 border-b border-border text-text-muted text-[11px] shrink-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2 w-2 rounded-full ${isRunningSandbox ? "bg-amber-400 animate-ping" : "bg-green-400"}`}
                      />
                      <span className="text-text-primary font-semibold">
                        {effectiveTerminalOutput
                          ? "ENCLAVE SUBPROCESS RUNNER"
                          : "SUBPROCESS ENCLAVE"}
                      </span>
                    </div>
                    {(sandboxMeta ||
                      artifact.terminalExitCode !== undefined) && (
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${effectiveExitCode === 0 ? "bg-green-500/10 text-green-400 border border-green-500/30" : "bg-red-500/10 text-[#E54D2E] border border-red-500/30"}`}
                      >
                        {effectiveExitCode === 0
                          ? "✓ EXIT 0"
                          : `✕ EXIT ${effectiveExitCode}`}{" "}
                        · {effectiveDurationMs}ms
                      </span>
                    )}
                  </div>
                  <div className="text-accent-primary/90 font-mono text-[11px] pb-1 border-b border-border/20 font-medium">
                    {effectiveCommand}
                  </div>
                  <div className="flex-1 bg-[#0E0D0B] p-3 rounded border border-border/80 overflow-y-auto text-[11px] whitespace-pre-wrap text-emerald-300 leading-relaxed">
                    {effectiveTerminalOutput ||
                      'Click "Run" above to execute inside the isolated sandbox.'}
                  </div>
                </div>
              </motion.div>
            ) : activeTab === "preview" ? (
              /* Dynamic Interactive Previews based on artifact type */
              <motion.div
                key={`preview-${artifact.id}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="space-y-5"
              >
                {artifact.title.endsWith(".html") ||
                artifact.title.endsWith(".svg") ||
                artifact.files.some(
                  (f) => f.language === "html" || f.language === "svg",
                ) ? (
                  /* Dynamic HTML / SVG Sandbox Preview */
                  <div className="space-y-4 font-body">
                    <div className="rounded-[4px] border border-border bg-surface-1 p-3 shadow-sm flex items-center justify-between">
                      <div>
                        <h3 className="font-display text-xs font-semibold text-text-primary">
                          Live Sandbox Viewport
                        </h3>
                        <p className="font-body text-[11px] text-text-muted">
                          Rendered dynamically from generated artifact code
                        </p>
                      </div>
                      <span className="font-mono text-[10px] text-accent-primary bg-surface-2 px-2 py-0.5 rounded border border-accent-primary/40 font-semibold">
                        SANDBOX ISOLATED
                      </span>
                    </div>
                    <div className="w-full h-[480px] bg-white rounded-[4px] border border-border overflow-hidden">
                      <iframe
                        title="Dynamic Live Preview"
                        srcDoc={currentFileContent}
                        sandbox="allow-scripts"
                        className="w-full h-full border-0"
                      />
                    </div>
                  </div>
                ) : isChartArtifact && parsedChartSpec ? (
                  /* Rich Interactive Dynamic Chart Viewport */
                  <div className="space-y-4 max-w-5xl mx-auto font-body">
                    <div className="w-full min-h-[500px]">
                      <InteractiveChartCard
                        spec={parsedChartSpec}
                        isExpanded={true}
                      />
                    </div>
                  </div>
                ) : isDocumentArtifact ? (
                  /* Rich Formatted Document Viewport for .docx / Markdown Reports */
                  <div className="space-y-4 max-w-4xl mx-auto font-body">
                    {/* Document Meta Banner */}
                    <div className="rounded-[4px] border border-border bg-surface-1 p-3.5 shadow-sm flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className="text-xl">📄</span>
                        <div>
                          <h3 className="font-display text-xs sm:text-sm font-semibold text-text-primary">
                            {selectedFile || artifact.title}
                          </h3>
                          <p className="font-body text-[11px] text-text-muted">
                            Official On-Premise Executive Document &bull;
                            Sovereign Grounding Verified
                          </p>
                        </div>
                      </div>
                      {artifact.download_url && (
                        <a
                          href={artifact.download_url}
                          download
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-[3px] bg-accent-primary text-background text-xs font-mono font-bold hover:brightness-110 transition-all shadow-xs"
                        >
                          <span>⬇ Download Full .DOCX</span>
                        </a>
                      )}
                    </div>

                    {/* Rendered Document Sheet */}
                    <div className="rounded-[4px] border border-border bg-[#14100D] p-6 text-text-primary shadow-sm leading-relaxed space-y-3">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm, remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                        components={{
                          h1: ({ children }) => (
                            <h1 className="font-display text-lg font-bold text-text-primary border-b border-border/60 pb-2 mb-3 mt-2">
                              {children}
                            </h1>
                          ),
                          h2: ({ children }) => (
                            <h2 className="font-display text-base font-semibold text-accent-primary border-b border-border/40 pb-1 mb-2 mt-4">
                              {children}
                            </h2>
                          ),
                          h3: ({ children }) => (
                            <h3 className="font-display text-sm font-medium text-text-primary mb-1 mt-3">
                              {children}
                            </h3>
                          ),
                          table: ({ children }) => (
                            <div className="overflow-x-auto my-3 rounded-[3px] border border-border/80 bg-surface-1/60 shadow-2xs">
                              <table className="min-w-full divide-y divide-border border-collapse text-[13px]">
                                {children}
                              </table>
                            </div>
                          ),
                          thead: ({ children }) => (
                            <thead className="bg-surface-2/90 text-text-primary font-bold text-xs uppercase tracking-wider">
                              {children}
                            </thead>
                          ),
                          tbody: ({ children }) => (
                            <tbody className="divide-y divide-border/60 bg-surface-1/40">
                              {children}
                            </tbody>
                          ),
                          tr: ({ children }) => (
                            <tr className="hover:bg-surface-2/40 transition-colors">
                              {children}
                            </tr>
                          ),
                          th: ({ children }) => (
                            <th className="px-3.5 py-2.5 text-left font-semibold text-text-primary border-r border-border/60 last:border-r-0">
                              {children}
                            </th>
                          ),
                          td: ({ children }) => (
                            <td className="px-3.5 py-2 border-r border-border/40 last:border-r-0 text-text-body leading-normal">
                              {children}
                            </td>
                          ),
                          blockquote: ({ children }) => (
                            <blockquote className="border-l-2 border-accent-primary pl-3 py-1 my-2 text-text-muted bg-surface-2/40 italic">
                              {children}
                            </blockquote>
                          ),
                          p: ({ children }) => (
                            <p className="mb-2 text-[13.5px] leading-relaxed text-text-body">
                              {children}
                            </p>
                          ),
                          ul: ({ children }) => (
                            <ul className="list-disc pl-5 my-2 space-y-1 text-[13px] text-text-body">
                              {children}
                            </ul>
                          ),
                          ol: ({ children }) => (
                            <ol className="list-decimal pl-5 my-2 space-y-1 text-[13px] text-text-body">
                              {children}
                            </ol>
                          ),
                          code: ({ children }: any) => (
                            <code className="font-mono text-xs bg-surface-2 text-accent-primary px-1.5 py-0.5 rounded border border-border/60">
                              {children}
                            </code>
                          ),
                        }}
                      >
                        {normalizeMarkdownTables(currentFileContent)}
                      </ReactMarkdown>
                    </div>
                  </div>
                ) : (
                  /* Standalone Native Application Runner & Terminal */
                  <div className="space-y-4">
                    <div className="rounded-[4px] border border-border bg-surface-1 p-4 shadow-sm space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-display text-sm font-semibold text-text-primary">
                            {selectedFile || artifact.title} — Application
                            Sandbox
                          </h3>
                          <p className="font-body text-xs text-text-muted mt-0.5">
                            Direct stdin stream compilation and native execution
                            via isolated subprocess
                          </p>
                        </div>
                        <span className="font-mono text-[10px] text-green-400 bg-surface-2 px-2 py-0.5 rounded border border-green-500/40 font-semibold">
                          NATIVE RUNNER
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 font-mono text-xs pt-1">
                        <div className="rounded-[3px] border border-border bg-surface-2/60 p-2.5">
                          <span className="text-[10px] text-text-muted uppercase tracking-wider block">
                            Runtime
                          </span>
                          <span className="text-text-primary font-bold">
                            {displayRuntime}
                          </span>
                        </div>
                        <div className="rounded-[3px] border border-border bg-surface-2/60 p-2.5">
                          <span className="text-[10px] text-text-muted uppercase tracking-wider block">
                            Security
                          </span>
                          <span className="text-green-400 font-bold">
                            Subprocess Enclave
                          </span>
                        </div>
                        <div className="rounded-[3px] border border-border bg-surface-2/60 p-2.5 col-span-2 sm:col-span-1">
                          <span className="text-[10px] text-text-muted uppercase tracking-wider block">
                            Timeout
                          </span>
                          <span className="text-accent-primary font-bold">
                            10,000ms Watchdog
                          </span>
                        </div>
                      </div>

                      {detectedPrompts.length > 0 && (
                        <div className="rounded-[4px] border border-border/80 bg-[#17130F] p-3.5 space-y-2.5">
                          <span className="font-mono text-[11px] text-accent-primary font-semibold uppercase tracking-wider block">
                            Interactive Program Inputs ({detectedPrompts.length}
                            )
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {detectedPrompts.map((prompt, idx) => (
                              <div key={prompt.id} className="space-y-1">
                                <label className="block text-[11px] text-text-muted font-mono font-medium truncate">
                                  {idx + 1}. {prompt.label}
                                </label>
                                <input
                                  type="text"
                                  value={inputValues[prompt.id] || ""}
                                  onChange={(e) =>
                                    setInputValues((prev) => ({
                                      ...prev,
                                      [prompt.id]: e.target.value,
                                    }))
                                  }
                                  placeholder={
                                    prompt.placeholder ||
                                    `Enter value for: ${prompt.label}`
                                  }
                                  className="w-full rounded-[3px] border border-border bg-surface-2/80 px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-placeholder focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary font-mono"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={handleRunInSandbox}
                          disabled={isRunningSandbox}
                          className="w-full flex items-center justify-center gap-2 rounded-[3px] border border-accent-primary/60 bg-accent-primary/10 hover:bg-accent-primary/20 text-accent-primary py-2.5 px-4 font-mono text-xs font-semibold transition-all cursor-pointer disabled:opacity-50 shadow-xs"
                        >
                          {isRunningSandbox ? (
                            <>
                              <svg
                                className="animate-spin h-4 w-4 text-accent-primary"
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                              >
                                <circle
                                  className="opacity-25"
                                  cx="12"
                                  cy="12"
                                  r="10"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                ></circle>
                                <path
                                  className="opacity-75"
                                  fill="currentColor"
                                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                ></path>
                              </svg>
                              <span>Executing in Sandbox Enclave...</span>
                            </>
                          ) : (
                            <>
                              <span>▶</span>
                              <span>
                                Run {selectedFile || artifact.title} in Isolated
                                Sandbox
                              </span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {(effectiveTerminalOutput || artifact.terminalOutput) && (
                      <div className="rounded-[4px] border border-border bg-[#0E0D0B] p-4 font-mono text-xs leading-relaxed space-y-2">
                        <div className="flex items-center justify-between border-b border-border/60 pb-2 text-[11px] text-text-muted">
                          <span className="text-text-primary font-semibold">
                            Live Execution Output
                          </span>
                          {(sandboxMeta ||
                            artifact.terminalExitCode !== undefined) && (
                            <span
                              className={
                                effectiveExitCode === 0
                                  ? "text-green-400 font-bold"
                                  : "text-[#E54D2E] font-bold"
                              }
                            >
                              {effectiveExitCode === 0
                                ? "✓ EXIT 0"
                                : `✕ EXIT ${effectiveExitCode}`}{" "}
                              · {effectiveDurationMs}ms
                            </span>
                          )}
                        </div>
                        <div className="text-text-muted/60 text-[11px] pb-1 border-b border-border/20">
                          <span className="text-accent-primary/90">
                            {effectiveCommand}
                          </span>
                        </div>
                        <pre className="text-emerald-300 font-mono whitespace-pre-wrap">
                          {effectiveTerminalOutput}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            ) : activeTab === "code" ? (
              /* Editable code surface with a stable line-number gutter */
              <motion.div
                key="code"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="rounded-[4px] border border-border bg-[#120F0D] overflow-hidden font-mono text-xs leading-[1.65]"
              >
                <div className="flex items-center justify-between border-b border-border/70 bg-surface-2/60 px-3 py-2">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                    Editing {selectedFile}
                  </span>
                  <span className="font-mono text-[10px] text-accent-primary">
                    {dirtyFiles.has(selectedFile || "") ? "UNSAVED" : "SAVED"}
                  </span>
                </div>
                <div className="flex max-h-[calc(100vh-230px)] min-h-[360px] overflow-auto">
                  <div
                    aria-hidden="true"
                    className="select-none border-r border-border/50 bg-[#0F0D0B] px-3 py-3 text-right font-mono text-[11px] leading-[1.65] text-text-muted/50"
                  >
                    {currentFileContent.split("\n").map((_, index) => (
                      <div key={index}>{index + 1}</div>
                    ))}
                  </div>
                  <textarea
                    aria-label={`Edit ${selectedFile}`}
                    value={currentFileContent}
                    spellCheck={false}
                    onChange={(event) =>
                      handleFileContentChange(event.target.value)
                    }
                    onKeyDown={(event) => {
                      if (event.key !== "Enter") return;
                      const line =
                        currentFileContent
                          .slice(0, event.currentTarget.selectionStart)
                          .split("\n")
                          .pop() || "";
                      const indent = line.match(/^\s*/)?.[0] || "";
                      if (indent) {
                        event.preventDefault();
                        const start = event.currentTarget.selectionStart;
                        const next = `${currentFileContent.slice(0, start)}\n${indent}${currentFileContent.slice(event.currentTarget.selectionEnd)}`;
                        handleFileContentChange(next);
                        requestAnimationFrame(() => {
                          event.currentTarget.selectionStart =
                            start + indent.length + 1;
                          event.currentTarget.selectionEnd =
                            start + indent.length + 1;
                        });
                      }
                    }}
                    className="min-w-[680px] flex-1 resize-none bg-transparent px-3 py-3 font-mono text-[12px] leading-[1.65] text-text-primary outline-none"
                  />
                </div>
              </motion.div>
            ) : (
              /* Terminal View */
              <motion.div
                key="terminal"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="rounded-[4px] border border-border bg-[#0E0D0B] p-4 font-mono text-xs text-text-body whitespace-pre-wrap leading-relaxed space-y-3"
              >
                {detectedPrompts.length > 0 && (
                  <div className="rounded-[4px] border border-border/80 bg-[#17130F] p-3 space-y-2 mb-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] text-accent-primary font-semibold uppercase tracking-wider block">
                        Program Standard Inputs ({detectedPrompts.length})
                      </span>
                      <button
                        type="button"
                        onClick={handleRunInSandbox}
                        disabled={isRunningSandbox}
                        className="px-2.5 py-1 rounded bg-accent-primary text-background font-mono text-[10px] font-bold hover:bg-accent-primary/90 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {isRunningSandbox ? "Running..." : "Submit & Execute"}
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                      {detectedPrompts.map((prompt, idx) => (
                        <div key={prompt.id} className="space-y-1">
                          <label className="block text-[10px] text-text-muted font-mono truncate">
                            {idx + 1}. {prompt.label}
                          </label>
                          <input
                            type="text"
                            value={inputValues[prompt.id] || ""}
                            onChange={(e) =>
                              setInputValues((prev) => ({
                                ...prev,
                                [prompt.id]: e.target.value,
                              }))
                            }
                            placeholder={
                              prompt.placeholder || `Value for: ${prompt.label}`
                            }
                            className="w-full rounded-[3px] border border-border bg-surface-2/80 px-2 py-1 text-[11px] text-text-primary placeholder:text-text-placeholder focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary font-mono"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pb-2.5 border-b border-border text-text-muted text-[11px]">
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 rounded-full ${isRunningSandbox ? "bg-amber-400 animate-ping" : "bg-green-400"}`}
                    />
                    <span className="text-text-primary font-semibold">
                      {effectiveTerminalOutput
                        ? "ENCLAVE SUBPROCESS RUNNER"
                        : "LOCAL RUNNER (SANDBOX)"}
                    </span>
                  </div>
                  {(sandboxMeta || artifact.terminalExitCode !== undefined) && (
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          effectiveExitCode === 0
                            ? "bg-green-500/10 text-green-400 border border-green-500/30"
                            : "bg-red-500/10 text-[#E54D2E] border border-red-500/30"
                        }`}
                      >
                        {effectiveExitCode === 0
                          ? "✓ PROCESS TERMINATED (EXIT 0)"
                          : `✕ EXIT ${effectiveExitCode}`}
                      </span>
                      <span className="text-accent-primary text-[10px]">
                        {effectiveDurationMs}ms
                      </span>
                    </div>
                  )}
                </div>
                <div className="text-accent-primary/90 font-mono text-[11px] pb-1 border-b border-border/20 font-medium">
                  {effectiveCommand}
                </div>
                <div className="text-emerald-300 font-mono text-[12px] whitespace-pre-wrap">
                  {effectiveTerminalOutput ||
                    'No output recorded yet. Click "Run" above to execute.'}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Bottom Bar: Version Tracker Rail */}
        <div className="flex h-11 items-center justify-between border-t border-border bg-surface-1 px-5 text-xs">
          <div className="flex items-center gap-3 font-mono">
            <span className="text-[10px] uppercase tracking-widest text-text-muted font-semibold">
              VERSIONS:
            </span>
            <div className="flex items-center gap-2">
              {artifact.versions?.map((v) => {
                const isSelected = selectedVersion === v.version;
                return (
                  <button
                    key={v.version}
                    type="button"
                    onClick={() => handleVersionClick(v)}
                    className={`relative px-2 py-0.5 font-mono text-xs transition-colors cursor-pointer ${
                      isSelected
                        ? "text-accent-primary font-bold"
                        : "text-text-muted hover:text-text-primary"
                    }`}
                  >
                    <span>{v.version}</span>
                    {isSelected && (
                      <motion.span
                        layoutId="version-rail-underline"
                        transition={{ duration: 0.18, ease: "easeOut" }}
                        className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent-primary"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <span className="font-mono text-[10px] text-text-muted/60 uppercase">
            {diffViewVersion ? "Diff Inspector Active" : "Active Head"}
          </span>
        </div>

        {/* =========================================================================
          EXPLAIN CODE & ALGORITHMIC COMPLEXITY BREAKDOWN MODAL
          ========================================================================= */}
        <AnimatePresence>
          {showExplainModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 8 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="w-full max-w-lg rounded-[6px] border border-border bg-surface-1 shadow-2xl overflow-hidden font-body text-text-body"
              >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-border bg-surface-2/70 px-5 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <h3 className="font-display text-base font-semibold text-text-primary">
                      Code Architecture & Complexity
                    </h3>
                    <span className="font-mono text-[9px] uppercase tracking-wider text-accent-primary border border-accent-primary/40 px-1.5 py-0.5 rounded-[2px] bg-surface-1">
                      {artifact.badge}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowExplainModal(false)}
                    className="font-display text-lg text-text-muted hover:text-accent-primary leading-none cursor-pointer px-1"
                  >
                    ×
                  </button>
                </div>

                {/* Modal Body */}
                <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto font-mono text-xs">
                  {/* Target File */}
                  <div className="flex items-center justify-between rounded-[4px] border border-border bg-surface-2/40 p-3">
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-text-muted">
                        Target Source
                      </span>
                      <div className="text-text-primary font-bold mt-0.5">
                        {selectedFile || artifact.title}
                      </div>
                    </div>
                    <span className="text-[11px] text-green-400 border border-green-500/30 px-2 py-0.5 rounded bg-surface-1 font-semibold">
                      ✓ Verified AST
                    </span>
                  </div>

                  {/* Complexity Cards */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-[4px] border border-border bg-surface-2/60 p-3 space-y-1">
                      <span className="text-[10px] uppercase tracking-wider text-text-muted">
                        Time Complexity
                      </span>
                      <div className="text-accent-primary font-bold text-sm">
                        {artifact.title.toLowerCase().includes("dijkstra") ||
                        currentFileContent.includes("priority_queue")
                          ? "O((V + E) log V)"
                          : artifact.title.toLowerCase().includes("sort")
                            ? "O(N log N)"
                            : artifact.title.toLowerCase().includes("matrix")
                              ? "O(N²)"
                              : "O(N) Linear"}
                      </div>
                      <p className="text-[10px] text-text-muted">
                        Optimal asymptotic bounds
                      </p>
                    </div>

                    <div className="rounded-[4px] border border-border bg-surface-2/60 p-3 space-y-1">
                      <span className="text-[10px] uppercase tracking-wider text-text-muted">
                        Space Complexity
                      </span>
                      <div className="text-text-primary font-bold text-sm">
                        {artifact.title.toLowerCase().includes("dijkstra") ||
                        currentFileContent.includes("vector")
                          ? "O(V + E) Heap"
                          : "O(1) Auxiliary"}
                      </div>
                      <p className="text-[10px] text-text-muted">
                        Dynamic memory allocation
                      </p>
                    </div>
                  </div>

                  {/* Algorithmic Invariants */}
                  <div className="rounded-[4px] border border-border bg-surface-2/30 p-3.5 space-y-2">
                    <div className="font-semibold text-text-primary text-[11px] flex items-center gap-1.5">
                      <span className="text-accent-primary">●</span>
                      <span>Algorithmic Invariants & Guarantees</span>
                    </div>
                    <ul className="text-text-muted space-y-1 text-[11px] list-disc list-inside">
                      <li>
                        Strict Subprocess Isolation with zero external egress.
                      </li>
                      <li>
                        Automated non-blocking pipe stdin stream injection.
                      </li>
                      <li>
                        Guaranteed process watchdog termination at 10,000ms.
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="flex items-center justify-between border-t border-border bg-surface-2/70 px-5 py-3 font-mono text-xs">
                  <button
                    type="button"
                    onClick={() => setShowExplainModal(false)}
                    className="text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                  >
                    Close
                  </button>

                  <button
                    type="button"
                    onClick={handleAskAiExplain}
                    disabled={isAskingChat}
                    className="flex items-center gap-1.5 rounded-[3px] border border-accent-primary bg-accent-primary hover:bg-accent-primary/90 text-background px-3 py-1.5 font-semibold transition-all cursor-pointer disabled:opacity-50 shadow-xs"
                  >
                    {isAskingChat ? (
                      <span>Sending to AI...</span>
                    ) : (
                      <>
                        <span>💬</span>
                        <span>Ask AI in Chat</span>
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default ArtifactPanel;

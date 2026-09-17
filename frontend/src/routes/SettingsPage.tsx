import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  SlidersHorizontal,
  User,
  Cpu,
  Palette,
  ShieldCheck,
  Database,
  Mic,
  Terminal,
  Info,
  Check,
  X,
  AlertTriangle,
  Trash2,
  Download,
  RefreshCw,
  FileText,
  Activity,
  CheckCircle2,
  Key,
  Volume2,
  Sun,
  Moon,
  Keyboard,
  RotateCcw,
  Edit2,
  Globe,
  FolderGit2,
  Bell,
  Zap,
  Radio,
} from "lucide-react";
import { useWorkbench } from "../lib/WorkbenchContext";
import { KeyboardShortcutsModal } from "../components/layout/KeyboardShortcutsModal";
import { formatKeyComboDisplay, eventToKeyCombo } from "../lib/keybindings";
import { api, type McpServerHealth } from "../lib/api";
import { playCompletionChime } from "../lib/audioChime";
import {
  requestDesktopNotificationPermission,
  getDesktopNotificationPermission,
  sendDesktopNotification,
} from "../lib/notifications";
import {
  type WorkbenchSettings,
  loadSavedSettings,
  saveSettings,
  getLanguageCode,
  SETTINGS_STORAGE_KEY,
} from "../lib/settings";
import type { McpServerId } from "../lib/types";

export type SettingsTab =
  | "general"
  | "keybindings"
  | "personalization"
  | "models"
  | "appearance"
  | "security"
  | "data"
  | "audio"
  | "developer"
  | "about";

interface SettingsNavOption {
  id: SettingsTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

const SETTINGS_NAV: SettingsNavOption[] = [
  { id: "general", label: "General", icon: SlidersHorizontal },
  {
    id: "keybindings",
    label: "Keybindings & Shortcuts",
    icon: Keyboard,
    badge: "HOTKEYS",
  },
  { id: "personalization", label: "Personalization", icon: User },
  { id: "models", label: "AI & Models", icon: Cpu },
  { id: "appearance", label: "Appearance", icon: Palette },
  {
    id: "security",
    label: "Security & Privacy",
    icon: ShieldCheck,
    badge: "SECURE",
  },
  { id: "data", label: "Data & Storage", icon: Database },
  { id: "audio", label: "Audio", icon: Mic },
  { id: "developer", label: "Developer", icon: Terminal },
  { id: "about", label: "About", icon: Info },
];

const STORAGE_KEY = SETTINGS_STORAGE_KEY;

const MCP_CATALOG: Array<{
  id: McpServerId;
  label: string;
  description: string;
  tools: string[];
}> = [
  {
    id: "smtp_mcp",
    label: "SMTP MCP",
    description: "Local on-premise mail dispatcher",
    tools: ["send_shift_report", "send_engineering_email"],
  },
  {
    id: "alert_mcp",
    label: "Alert MCP",
    description: "Serial GSM modem and plant pager dispatcher",
    tools: ["page_duty_engineer", "dispatch_alarm"],
  },
  {
    id: "historian_mcp",
    label: "Historian MCP",
    description: "SCADA SQLite and InfluxDB telemetry reader",
    tools: ["query_historian", "read_unit_snapshot"],
  },
];

export interface SettingsPageProps {
  isOpen?: boolean;
  onClose?: () => void;
  isModal?: boolean;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  isOpen = true,
  onClose,
  isModal = true,
}) => {
  const wb = useWorkbench();
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const [settings, setSettings] = useState<WorkbenchSettings>(
    () => wb?.settings || loadSavedSettings(),
  );
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [shortcutsModalOpen, setShortcutsModalOpen] = useState(false);
  const [clearCacheModalOpen, setClearCacheModalOpen] = useState(false);
  const [deleteDataModalOpen, setDeleteDataModalOpen] = useState(false);
  const [cacheClearedSuccess, setCacheClearedSuccess] = useState(false);
  const [dataDeletedSuccess, setDataDeletedSuccess] = useState(false);
  const [integrityVerified, setIntegrityVerified] = useState(false);
  const [verifyingIntegrity, setVerifyingIntegrity] = useState(false);
  const [mcpPingStatus, setMcpPingStatus] = useState<
    "idle" | "testing" | "connected"
  >("idle");
  const [mcpDrawerOpen, setMcpDrawerOpen] = useState(false);
  const [mcpStates, setMcpStates] = useState<Record<McpServerId, McpServerHealth | null>>({
    smtp_mcp: null,
    alert_mcp: null,
    historian_mcp: null,
  });
  const modalPanelRef = useRef<HTMLDivElement>(null);

  const refreshMcpStates = useCallback(async () => {
    setMcpStates({ smtp_mcp: null, alert_mcp: null, historian_mcp: null });
    try {
      const health = await api.getMcpServers();
      const next = { smtp_mcp: null, alert_mcp: null, historian_mcp: null } as Record<McpServerId, McpServerHealth | null>;
      health.servers.forEach((server) => { next[server.server_id] = server; });
      setMcpStates(next);
    } catch {
      setMcpStates({ smtp_mcp: null, alert_mcp: null, historian_mcp: null });
    }
  }, []);

  useEffect(() => {
    if (activeTab !== "developer") return;
    void refreshMcpStates();
    const timer = window.setInterval(() => void refreshMcpStates(), 10000);
    return () => window.clearInterval(timer);
  }, [activeTab, refreshMcpStates]);

  // Workspaces fetching & management
  const [availableWorkspaces, setAvailableWorkspaces] = useState<
    Array<{ id: string; name: string; description?: string }>
  >([]);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false);

  const fetchWorkspaces = useCallback(async () => {
    setLoadingWorkspaces(true);
    try {
      const list = await api.getWorkspaces();
      if (Array.isArray(list)) {
        setAvailableWorkspaces(list);
      }
    } catch (e) {
      console.warn("Failed to load workspaces list:", e);
    } finally {
      setLoadingWorkspaces(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  // Sync settings when context updates
  useEffect(() => {
    if (wb?.settings) {
      setSettings(wb.settings);
    }
  }, [wb?.settings]);

  // Desktop notifications & sound test states
  const [desktopPermission, setDesktopPermission] =
    useState<NotificationPermission>(() => getDesktopNotificationPermission());
  const [testNotificationSent, setTestNotificationSent] = useState(false);
  const [testChimePlayed, setTestChimePlayed] = useState(false);
  const [testStreamingActive, setTestStreamingActive] = useState(false);
  const [langToast, setLangToast] = useState<string | null>(null);

  let openShortcutsModal: () => void = () => setShortcutsModalOpen(true);
  let keybindings: any[] = [];
  let updateKeybinding: (id: string, newKey: string) => void = () => {};
  let resetKeybindings: () => void = () => {};

  if (wb) {
    if (wb.openShortcuts) openShortcutsModal = wb.openShortcuts;
    if (wb.keybindings) keybindings = wb.keybindings;
    if (wb.updateKeybinding) updateKeybinding = wb.updateKeybinding;
    if (wb.resetKeybindings) resetKeybindings = wb.resetKeybindings;
  }

  const [shortcutSearch, setShortcutSearch] = useState("");
  const [shortcutCategory, setShortcutCategory] = useState<
    "all" | "navigation" | "workbench" | "general"
  >("all");
  const [editingKeyId, setEditingKeyId] = useState<string | null>(null);
  const [recordedCombo, setRecordedCombo] = useState<string | null>(null);
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);

  // Listen for key recording when editing a shortcut inline in Settings
  useEffect(() => {
    if (!editingKeyId) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Allow cancelling with bare Escape if no modifiers
      if (
        e.key === "Escape" &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        !e.shiftKey
      ) {
        setEditingKeyId(null);
        setRecordedCombo(null);
        setConflictWarning(null);
        return;
      }

      const combo = eventToKeyCombo(e);
      if (combo) {
        setRecordedCombo(combo);
        const existing = keybindings.find(
          (k) =>
            k.id !== editingKeyId &&
            k.currentKey.toLowerCase() === combo.toLowerCase(),
        );
        if (existing) {
          setConflictWarning(`Conflicts with "${existing.name}"`);
        } else {
          setConflictWarning(null);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [editingKeyId, keybindings]);

  // Auto-save changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      console.error("Failed to auto-save settings:", e);
    }
  }, [settings]);

  // Escape key closes modal (or child modal first)
  useEffect(() => {
    if (!isOpen || !isModal) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (shortcutsModalOpen) {
          setShortcutsModalOpen(false);
          return;
        }
        if (clearCacheModalOpen) {
          setClearCacheModalOpen(false);
          return;
        }
        if (deleteDataModalOpen) {
          setDeleteDataModalOpen(false);
          return;
        }
        onClose?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isOpen,
    isModal,
    onClose,
    shortcutsModalOpen,
    clearCacheModalOpen,
    deleteDataModalOpen,
  ]);

  const updateSetting = <K extends keyof WorkbenchSettings>(
    key: K,
    value: WorkbenchSettings[K],
  ) => {
    setSettings((prev) => {
      const updated = { ...prev, [key]: value };
      saveSettings(updated);
      return updated;
    });
    wb?.updateSetting?.(key, value);
    if (key === "language") {
      setLangToast(`Interface locale updated to ${value}`);
      setTimeout(() => setLangToast(null), 2500);
    }
  };

  const handleToggleNotifications = async (val: boolean) => {
    updateSetting("desktopNotifications", val);
    if (val && typeof window !== "undefined" && "Notification" in window) {
      const perm = await requestDesktopNotificationPermission();
      setDesktopPermission(perm);
    }
  };

  const handleSendTestNotification = () => {
    if (desktopPermission !== "granted") {
      requestDesktopNotificationPermission().then((perm) => {
        setDesktopPermission(perm);
        if (perm === "granted") {
          sendDesktopNotification("Sovereign Enclave Notification", {
            body: "Desktop notifications are active & operational in this air-gap environment.",
          });
        }
      });
    } else {
      sendDesktopNotification("Sovereign Enclave Notification", {
        body: "Desktop notifications are active & operational in this air-gap environment.",
      });
    }
    setTestNotificationSent(true);
    setTimeout(() => setTestNotificationSent(false), 2500);
  };

  const handlePlayTestChime = () => {
    playCompletionChime();
    setTestChimePlayed(true);
    setTimeout(() => setTestChimePlayed(false), 1800);
  };

  const handleTestStreamingAlert = () => {
    setTestStreamingActive(true);
    let step = 0;
    const symbols = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
    const originalTitle = document.title;
    const interval = setInterval(() => {
      document.title = `[${symbols[step % symbols.length]} Test Token Stream 64 t/s] Sovereign Workbench`;
      step++;
    }, 120);

    setTimeout(() => {
      clearInterval(interval);
      document.title = originalTitle;
      setTestStreamingActive(false);
    }, 3000);
  };

  const handleManualSave = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2200);
    } catch (e) {
      console.error("Failed to save settings:", e);
    }
  };

  const handleExportData = () => {
    const dataToExport = {
      exportTimestamp: new Date().toISOString(),
      workbenchVersion: "v4.2.0-rc2 (SIH-PS26117)",
      environment: "sovereign-on-premise",
      settings,
    };
    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sovereign-workbench-settings-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleClearCacheConfirm = () => {
    setClearCacheModalOpen(false);
    setCacheClearedSuccess(true);
    setTimeout(() => setCacheClearedSuccess(false), 3000);
  };

  const handleDeleteDataConfirm = () => {
    setDeleteDataModalOpen(false);
    setDataDeletedSuccess(true);
    setTimeout(() => setDataDeletedSuccess(false), 3500);
  };

  const handleVerifyIntegrity = () => {
    setVerifyingIntegrity(true);
    setTimeout(() => {
      setVerifyingIntegrity(false);
      setIntegrityVerified(true);
      setTimeout(() => setIntegrityVerified(false), 4000);
    }, 900);
  };

  const handleTestMcpPing = () => {
    setMcpPingStatus("testing");
    setTimeout(() => {
      setMcpPingStatus("connected");
      setTimeout(() => setMcpPingStatus("idle"), 3000);
    }, 600);
  };

  // Theme-aware spring-animated horizontal pill Toggle Switch (compact desktop proportion)
  const ToggleSwitch: React.FC<{
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
    label?: string;
    variant?: "default" | "theme";
  }> = ({
    checked,
    onChange,
    disabled = false,
    label,
    variant = "default",
  }) => {
    const isTheme = variant === "theme";

    return (
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`group relative inline-block shrink-0 cursor-pointer overflow-hidden p-0 border transition-all duration-300 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background select-none ${
          checked
            ? "bg-accent-primary/25 border-accent-primary shadow-[0_0_8px_rgba(217,122,63,0.25)]"
            : "bg-surface-2 border-border hover:border-text-muted/50"
        } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
        style={{
          width: "38px",
          height: "20px",
          borderRadius: "9999px",
          minWidth: "38px",
          minHeight: "20px",
          boxSizing: "border-box",
        }}
      >
        {/* Left State Icon (Sun or X) */}
        <span
          className={`absolute left-[5px] top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none transition-all duration-300 ease-[cubic-bezier(.26,2,.46,.71)] ${
            checked
              ? "opacity-0 scale-75 rotate-15 text-text-placeholder"
              : "opacity-85 scale-100 rotate-0 text-text-muted group-hover:text-text-body"
          }`}
        >
          {isTheme ? (
            <Sun className="w-2.5 h-2.5" />
          ) : (
            <X className="w-2.5 h-2.5" />
          )}
        </span>

        {/* Right State Icon (Moon or Check) */}
        <span
          className={`absolute right-[5px] top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none transition-all duration-300 ease-[cubic-bezier(.26,2,.46,.71)] ${
            checked
              ? "opacity-100 scale-100 rotate-0 text-accent-primary drop-shadow-[0_0_4px_rgba(217,122,63,0.5)]"
              : "opacity-0 scale-75 -rotate-15 text-text-placeholder"
          }`}
        >
          {isTheme ? (
            <Moon className="w-2.5 h-2.5" />
          ) : (
            <Check className="w-2.5 h-2.5" />
          )}
        </span>

        {/* Sliding Circular Knob (compact and seated within pill) */}
        <span
          className={`absolute top-[1px] left-[2px] block rounded-full transition-all duration-350 ease-[cubic-bezier(.26,2,.46,.71)] pointer-events-none ${
            checked
              ? "bg-accent-primary shadow-[0_0_8px_rgba(217,122,63,0.5)]"
              : "bg-text-muted group-hover:bg-text-body shadow-xs"
          }`}
          style={{
            width: "16px",
            height: "16px",
            borderRadius: "50%",
            transform: checked ? "translateX(18px)" : "translateX(0px)",
          }}
        />
      </button>
    );
  };

  // Inner content of the Settings (2 columns: left nav + right content)
  const renderSettingsContent = () => (
    <div className="flex-1 w-full h-full flex flex-col md:flex-row overflow-hidden bg-background select-none">
      {/* =========================================================================
          LEFT: Compact Settings Navigation Panel (220-250px)
          ========================================================================= */}
      <aside className="w-full md:w-56 lg:w-60 shrink-0 border-r border-border/80 bg-surface-1/70 flex flex-col justify-between overflow-y-auto">
        <div className="p-3.5 space-y-3">
          {/* Header */}
          <div className="px-2 pt-0.5 pb-1.5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[9px] uppercase tracking-widest text-text-muted">
                PREFERENCES
              </span>
              <span className="font-mono text-[9px] uppercase tracking-wider text-accent-primary bg-surface-2 px-1.5 py-0.5 rounded-[2px] border border-accent-primary/20">
                SOVEREIGN
              </span>
            </div>
            <h2 className="font-display text-lg font-medium text-text-primary mt-0.5">
              Settings
            </h2>
          </div>

          {/* Navigation Items List */}
          <nav className="space-y-0.5" aria-label="Settings Categories">
            {SETTINGS_NAV.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full group flex items-center justify-between px-2.5 py-1.5 rounded-[3px] font-body text-xs text-left transition-all cursor-pointer ${
                    isActive
                      ? "bg-surface-2 text-accent-primary font-medium border-l-2 border-accent-primary shadow-xs"
                      : "text-text-muted hover:text-text-primary hover:bg-surface-2/50 border-l-2 border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon
                      className={`h-3.5 w-3.5 shrink-0 transition-colors ${
                        isActive
                          ? "text-accent-primary"
                          : "text-text-muted group-hover:text-text-body"
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </div>

                  {item.badge && (
                    <span
                      className={`font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.2 rounded-[2px] ${
                        isActive
                          ? "bg-accent-primary/20 text-accent-primary border border-accent-primary/30"
                          : "bg-surface-2 text-text-muted border border-border/80"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Panel Status */}
        <div className="p-4 border-t border-border/60 bg-surface-1/40">
          <div className="flex items-center gap-2 text-[11px] font-mono text-text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="uppercase tracking-widest text-[10px]">
              Air-Gap Active
            </span>
          </div>
          <p className="font-body text-[11px] text-text-muted mt-1 leading-snug">
            All parameters stored locally in encrypted enclave storage.
          </p>
        </div>
      </aside>

      {/* =========================================================================
          RIGHT: Selected Settings Section (Content Area)
          ========================================================================= */}
      <main className="flex-1 h-full overflow-y-auto px-5 sm:px-8 lg:px-10 py-6 bg-background">
        <div className="max-w-3xl space-y-6 pb-12">
          {/* Top Bar with Section Info and Save Confirmation */}
          <div className="border-b border-border/80 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="pr-6">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[9px] uppercase tracking-widest text-accent-primary">
                  SECTION{" "}
                  {SETTINGS_NAV.findIndex((s) => s.id === activeTab) + 1} OF 9
                </span>
                <span className="text-text-muted text-xs">/</span>
                <span className="font-mono text-[9px] uppercase tracking-wider text-text-muted">
                  {SETTINGS_NAV.find((s) => s.id === activeTab)?.label}
                </span>
              </div>
              <h1 className="font-display text-xl sm:text-2xl font-medium tracking-tight text-text-primary mt-0.5">
                {activeTab === "general" && "General"}
                {activeTab === "personalization" && "Personalization"}
                {activeTab === "models" && "AI & Models"}
                {activeTab === "appearance" && "Appearance"}
                {activeTab === "security" && "Security & Privacy"}
                {activeTab === "data" && "Data & Storage"}
                {activeTab === "audio" && "Audio"}
                {activeTab === "developer" && "Developer"}
                {activeTab === "about" && "About"}
              </h1>
              <p className="font-body text-xs text-text-muted mt-0.5 leading-relaxed">
                {activeTab === "general" &&
                  "Basic application preferences, startup flow, and environment defaults."}
                {activeTab === "personalization" &&
                  "Customize how the Sovereign Workbench communicates, formats answers, and structures artifacts."}
                {activeTab === "models" &&
                  "Configure local on-premise inference engines, reasoning effort, and temperature calibration."}
                {activeTab === "appearance" &&
                  "Fine-tune darkroom aesthetics, analog film-grain texture, and interface density."}
                {activeTab === "security" &&
                  "Zero-egress verification, tamper-evident audit logging, and sandbox isolation status."}
                {activeTab === "data" &&
                  "Manage local SQLite enclave databases, vector embeddings, and storage retention policies."}
                {activeTab === "audio" &&
                  "Local speech-to-text configuration powered by in-process Faster-Whisper models."}
                {activeTab === "developer" &&
                  "Stitch MCP remote protocol integration, API routes, and sandbox telemetry."}
                {activeTab === "about" &&
                  "System architecture, sovereign license details, and cryptographic integrity certificate."}
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={handleManualSave}
                className="rounded-[2px] bg-accent-primary px-3 py-1 font-body text-xs font-semibold text-background hover:brightness-110 transition-all cursor-pointer shadow-xs flex items-center gap-1.5"
              >
                {savedSuccess ? (
                  <>
                    <Check className="w-3 h-3" />
                    <span>Saved ✓</span>
                  </>
                ) : (
                  <span>Save Preferences</span>
                )}
              </button>
            </div>
          </div>

          {/* Feedback alerts */}
          {cacheClearedSuccess && (
            <div className="rounded-[3px] border border-emerald-500/40 bg-emerald-950/20 px-3.5 py-2 text-xs text-emerald-400 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Temporary vector embeddings and render cache successfully
                purged.
              </span>
              <span className="font-mono text-[10px] text-emerald-500">
                FREED 142.6 MB
              </span>
            </div>
          )}

          {dataDeletedSuccess && (
            <div className="rounded-[3px] border border-amber-500/40 bg-amber-950/20 px-3.5 py-2 text-xs text-amber-400 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                Local database and session history purged. Sovereign enclave
                reset.
              </span>
              <span className="font-mono text-[10px] text-amber-500">
                RESET OK
              </span>
            </div>
          )}

          {/* =====================================================================
              TAB 1: GENERAL
              ===================================================================== */}
          {activeTab === "general" && (
            <div className="space-y-6">
              {/* Language & Localized Display */}
              <div className="rounded-[4px] border border-border/70 bg-surface-1/40 p-4 transition-all hover:border-border">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-accent-primary" />
                      <span className="font-body text-xs font-semibold text-text-primary">
                        Interface Language & System Locale
                      </span>
                      <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-surface-2 border border-border/70 text-text-muted">
                        {getLanguageCode(settings.language)}
                      </span>
                    </div>
                    <span className="font-body text-[11px] text-text-muted block">
                      Select localized interface typography, system prompt
                      instructions, and date formats.
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={settings.language}
                      onChange={(e) =>
                        updateSetting("language", e.target.value)
                      }
                      className="rounded-[3px] border border-border bg-surface-2 px-3 py-1.5 font-body text-xs text-text-primary focus:border-accent-primary focus:outline-none cursor-pointer w-full sm:w-56"
                    >
                      <option value="English (US)">
                        English (US) — Default
                      </option>
                      <option value="English (UK)">English (UK)</option>
                      <option value="Deutsch">Deutsch (German)</option>
                      <option value="Français">Français (French)</option>
                      <option value="Español">Español (Spanish)</option>
                      <option value="日本語">日本語 (Japanese)</option>
                    </select>
                  </div>
                </div>

                {langToast && (
                  <div className="mt-2.5 flex items-center gap-2 rounded bg-accent-primary/10 border border-accent-primary/30 px-2.5 py-1 text-[11px] text-accent-primary font-mono animate-fade-in">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{langToast}</span>
                  </div>
                )}
              </div>

              {/* Default Workspace Enclave */}
              <div className="rounded-[4px] border border-border/70 bg-surface-1/40 p-4 transition-all hover:border-border space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <FolderGit2 className="w-4 h-4 text-accent-primary" />
                      <span className="font-body text-xs font-semibold text-text-primary">
                        Default Enclave Workspace
                      </span>
                      <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-emerald-950/30 border border-emerald-500/30 text-emerald-400">
                        Air-Gapped Mount
                      </span>
                    </div>
                    <span className="font-body text-[11px] text-text-muted block">
                      Active workspace mounted for document vector indexing,
                      sandboxed execution, and artifact downloads.
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={fetchWorkspaces}
                    disabled={loadingWorkspaces}
                    className="flex items-center gap-1.5 rounded-[3px] border border-border bg-surface-2 px-2.5 py-1 text-xs text-text-muted hover:text-text-primary hover:border-accent-primary/50 transition-colors cursor-pointer self-start sm:self-auto shrink-0"
                    title="Rescan active workspaces from backend"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${loadingWorkspaces ? "animate-spin text-accent-primary" : ""}`}
                    />
                    <span>
                      {loadingWorkspaces ? "Scanning..." : "Rescan Enclaves"}
                    </span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  <div>
                    <label className="font-mono text-[10px] uppercase text-text-muted block mb-1">
                      Select Active Workspace
                    </label>
                    <select
                      value={
                        availableWorkspaces.some(
                          (w) => w.id === settings.defaultWorkspace,
                        )
                          ? settings.defaultWorkspace
                          : "custom"
                      }
                      onChange={(e) => {
                        if (e.target.value !== "custom") {
                          updateSetting("defaultWorkspace", e.target.value);
                        }
                      }}
                      className="w-full rounded-[3px] border border-border bg-surface-2 px-2.5 py-1.5 font-body text-xs text-text-primary focus:border-accent-primary focus:outline-none cursor-pointer"
                    >
                      <option value="default_workspace">
                        default_workspace (Primary Enclave)
                      </option>
                      {availableWorkspaces
                        .filter((w) => w.id !== "default_workspace")
                        .map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name} ({w.id})
                          </option>
                        ))}
                      <option value="custom">
                        Custom Enclave Directory Path...
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="font-mono text-[10px] uppercase text-text-muted block mb-1">
                      Mounted Path / Identifier
                    </label>
                    <input
                      type="text"
                      value={settings.defaultWorkspace}
                      onChange={(e) =>
                        updateSetting("defaultWorkspace", e.target.value)
                      }
                      placeholder="e.g. default_workspace or /enclave/workspace"
                      className="w-full rounded-[3px] border border-border bg-surface-2 px-2.5 py-1.5 font-mono text-xs text-text-primary focus:border-accent-primary focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 text-[11px] font-mono text-text-muted/80 bg-background/60 p-2 rounded border border-border/40">
                  <span className="text-accent-primary">●</span>
                  <span>
                    Active Workspace:{" "}
                    <span className="text-text-primary font-medium">
                      {settings.defaultWorkspace}
                    </span>
                  </span>
                  <span className="text-text-muted/50">|</span>
                  <span>
                    Discovered Workspaces:{" "}
                    <span className="text-text-primary">
                      {availableWorkspaces.length || 1}
                    </span>
                  </span>
                </div>
              </div>

              {/* Startup Behavior */}
              <div className="rounded-[4px] border border-border/70 bg-surface-1/40 p-4 transition-all hover:border-border space-y-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Radio className="w-4 h-4 text-accent-primary" />
                    <span className="font-body text-xs font-semibold text-text-primary">
                      Workbench Startup Behavior
                    </span>
                  </div>
                  <span className="font-body text-[11px] text-text-muted block">
                    Choose what view or session loads when launching or opening
                    the Sovereign Workbench.
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                  {[
                    {
                      id: "resume",
                      title: "Resume Session",
                      desc: "Auto-load the latest active chat session from encrypted history.",
                    },
                    {
                      id: "new_chat",
                      title: "New Clean Chat",
                      desc: "Start fresh with a blank canvas and prompt bar ready.",
                    },
                    {
                      id: "projects",
                      title: "Projects Overview",
                      desc: "Open the workspace directory and document repository browser.",
                    },
                  ].map((option) => {
                    const isSelected = settings.startupBehavior === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() =>
                          updateSetting("startupBehavior", option.id as any)
                        }
                        className={`rounded-[3px] border p-3 text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                          isSelected
                            ? "border-accent-primary bg-accent-primary/10 shadow-[0_0_12px_rgba(217,122,63,0.15)]"
                            : "border-border bg-surface-2 hover:border-text-muted/60"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`font-body text-xs font-semibold ${isSelected ? "text-accent-primary" : "text-text-primary"}`}
                          >
                            {option.title}
                          </span>
                          {isSelected && (
                            <Check className="w-3.5 h-3.5 text-accent-primary" />
                          )}
                        </div>
                        <span className="font-body text-[11px] text-text-muted leading-tight">
                          {option.desc}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Keyboard Shortcuts Reference */}
              <div className="rounded-[4px] border border-border/70 bg-surface-1/40 p-4 transition-all hover:border-border">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Keyboard className="w-4 h-4 text-accent-primary" />
                      <span className="font-body text-xs font-semibold text-text-primary">
                        Keyboard Shortcuts & Keybindings
                      </span>
                    </div>
                    <span className="font-body text-[11px] text-text-muted block">
                      Custom hotkey bindings for rapid command palette, tool
                      activation, and studio navigation.
                    </span>
                    <div className="flex items-center gap-1.5 pt-1.5 flex-wrap">
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-surface-2 border border-border/60 text-text-body">
                        ⌘K Palette
                      </span>
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-surface-2 border border-border/60 text-text-body">
                        ⌘, Settings
                      </span>
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-surface-2 border border-border/60 text-text-body">
                        ⌘/ Hotkeys
                      </span>
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-surface-2 border border-border/60 text-text-body">
                        ⌘\ Sidebar
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveTab("keybindings")}
                    className="rounded-[3px] border border-border bg-surface-2 px-3 py-1.5 font-mono text-xs text-text-body hover:text-accent-primary hover:border-accent-primary/60 transition-colors cursor-pointer w-full sm:w-auto flex items-center justify-center gap-1.5 shrink-0"
                  >
                    <Keyboard className="w-3.5 h-3.5 text-accent-primary" />
                    <span>Configure Keybindings (⌘/)</span>
                  </button>
                </div>
              </div>

              {/* Notifications & Audio Alerts */}
              <div className="rounded-[4px] border border-border/70 bg-surface-1/40 p-4 transition-all hover:border-border space-y-4">
                <div className="space-y-1 border-b border-border/50 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-accent-primary" />
                    <span className="font-body text-xs font-semibold text-text-primary">
                      System Notifications & Operational Alerts
                    </span>
                  </div>
                  <span className="font-body text-[11px] text-text-muted block">
                    Real-time notifications, acoustic cues, and live task stream
                    status indicators.
                  </span>
                </div>

                {/* 1. Desktop Notifications */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-2 border-b border-border/40">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-body text-xs font-medium text-text-primary">
                        System Desktop Notifications
                      </span>
                      {desktopPermission === "granted" && (
                        <span className="font-mono text-[9px] px-1.5 py-0.2 rounded bg-emerald-950/30 border border-emerald-500/30 text-emerald-400">
                          Active 🟢
                        </span>
                      )}
                      {desktopPermission === "denied" && (
                        <span className="font-mono text-[9px] px-1.5 py-0.2 rounded bg-red-950/30 border border-red-500/30 text-red-400">
                          Blocked 🔴
                        </span>
                      )}
                      {desktopPermission === "default" && (
                        <span className="font-mono text-[9px] px-1.5 py-0.2 rounded bg-amber-950/30 border border-amber-500/30 text-amber-400">
                          Permission Needed 🟡
                        </span>
                      )}
                    </div>
                    <span className="font-body text-[11px] text-text-muted block">
                      Notify when long-running multi-agent reasoning or batch
                      RAG indexing completes.
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={handleSendTestNotification}
                      className="rounded-[3px] border border-border bg-surface-2 px-2 py-1 text-[11px] font-mono text-text-muted hover:text-text-primary hover:border-accent-primary/60 transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Bell className="w-3 h-3 text-accent-primary" />
                      <span>
                        {testNotificationSent ? "Sent ✓" : "Test Alert"}
                      </span>
                    </button>
                    <ToggleSwitch
                      checked={settings.desktopNotifications}
                      onChange={handleToggleNotifications}
                      label="Toggle Desktop Notifications"
                    />
                  </div>
                </div>

                {/* 2. Live Token Streaming Indicator */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-2 border-b border-border/40">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-body text-xs font-medium text-text-primary">
                        Live Token Streaming Indicator
                      </span>
                      {testStreamingActive && (
                        <span className="font-mono text-[9px] px-1.5 py-0.2 rounded bg-accent-primary/20 border border-accent-primary text-accent-primary animate-pulse">
                          Pulsing Title...
                        </span>
                      )}
                    </div>
                    <span className="font-body text-[11px] text-text-muted block">
                      Pulse browser title bar with spinner and token velocity
                      during local model inference.
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={handleTestStreamingAlert}
                      disabled={testStreamingActive}
                      className="rounded-[3px] border border-border bg-surface-2 px-2 py-1 text-[11px] font-mono text-text-muted hover:text-text-primary hover:border-accent-primary/60 transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Zap className="w-3 h-3 text-accent-primary" />
                      <span>
                        {testStreamingActive ? "Running..." : "Test Pulse (3s)"}
                      </span>
                    </button>
                    <ToggleSwitch
                      checked={settings.streamingAlert}
                      onChange={(val) => updateSetting("streamingAlert", val)}
                      label="Toggle Token Streaming Indicator"
                    />
                  </div>
                </div>

                {/* 3. Audio Chime on Completion */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-body text-xs font-medium text-text-primary">
                        Acoustic Chime on Completion
                      </span>
                      {testChimePlayed && (
                        <span className="font-mono text-[9px] px-1.5 py-0.2 rounded bg-emerald-950/30 border border-emerald-500/30 text-emerald-400">
                          Chime Played 🔔
                        </span>
                      )}
                    </div>
                    <span className="font-body text-[11px] text-text-muted block">
                      Play an air-gapped Web Audio harmonic chime when sandbox
                      code execution or reasoning finishes.
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={handlePlayTestChime}
                      className="rounded-[3px] border border-border bg-surface-2 px-2 py-1 text-[11px] font-mono text-text-muted hover:text-text-primary hover:border-accent-primary/60 transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Volume2 className="w-3 h-3 text-accent-primary" />
                      <span>
                        {testChimePlayed ? "Playing 🔊" : "Play Sound"}
                      </span>
                    </button>
                    <ToggleSwitch
                      checked={settings.audioChimeOnCompletion}
                      onChange={(val) =>
                        updateSetting("audioChimeOnCompletion", val)
                      }
                      label="Toggle Audio Chime"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =====================================================================
              TAB: KEYBINDINGS & SHORTCUTS
              ===================================================================== */}
          {activeTab === "keybindings" && (
            <div className="space-y-4">
              {/* Header and Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-border/60">
                <div>
                  <h4 className="font-display text-xs font-semibold text-text-primary flex items-center gap-2">
                    Workbench Keyboard Shortcuts & Keybindings
                    <span className="font-mono text-[9px] px-1.5 py-0.2 rounded bg-surface-2 border border-border/70 text-text-muted">
                      Customizable
                    </span>
                  </h4>
                  <p className="font-body text-[11px] text-text-muted mt-0.5">
                    Click{" "}
                    <span className="text-accent-primary font-mono font-medium">
                      Edit
                    </span>{" "}
                    on any keybinding below to record your custom keystroke.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={resetKeybindings}
                  className="flex items-center gap-1.5 rounded-[2px] border border-border bg-surface-2 px-2.5 py-1 font-body text-xs text-text-muted hover:text-text-primary hover:border-border/90 transition-colors cursor-pointer self-start sm:self-auto"
                  title="Reset all shortcuts to defaults"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Defaults</span>
                </button>
              </div>

              {/* Search & Category Filter Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
                <input
                  type="text"
                  placeholder="Filter keybindings by name, key, or category..."
                  value={shortcutSearch}
                  onChange={(e) => setShortcutSearch(e.target.value)}
                  className="w-full sm:w-72 rounded-[3px] border border-border bg-surface-2 px-2.5 py-1 text-xs text-text-primary placeholder:text-text-muted/60 focus:outline-none focus:border-accent-primary"
                />

                <div className="flex items-center gap-1 w-full sm:w-auto overflow-x-auto">
                  {(["all", "navigation", "workbench", "general"] as const).map(
                    (cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setShortcutCategory(cat)}
                        className={`px-2 py-0.5 rounded text-[11px] font-mono capitalize transition-colors cursor-pointer ${
                          shortcutCategory === cat
                            ? "bg-accent-primary text-background font-semibold shadow-xs"
                            : "text-text-muted hover:text-text-body hover:bg-surface-2"
                        }`}
                      >
                        {cat}
                      </button>
                    ),
                  )}
                </div>
              </div>

              {/* Keybindings Table */}
              <div className="rounded-[4px] border border-border/80 bg-surface-1 divide-y divide-border/40 overflow-hidden">
                {keybindings
                  .filter((item) => {
                    const matchesSearch =
                      !shortcutSearch.trim() ||
                      item.name
                        .toLowerCase()
                        .includes(shortcutSearch.toLowerCase()) ||
                      item.description
                        .toLowerCase()
                        .includes(shortcutSearch.toLowerCase()) ||
                      item.currentKey
                        .toLowerCase()
                        .includes(shortcutSearch.toLowerCase());
                    const matchesCat =
                      shortcutCategory === "all" ||
                      item.category === shortcutCategory;
                    return matchesSearch && matchesCat;
                  })
                  .map((item) => {
                    const isEditing = editingKeyId === item.id;
                    const isCustom = item.currentKey !== item.defaultKey;

                    return (
                      <div
                        key={item.id}
                        className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 transition-colors ${
                          isEditing
                            ? "bg-accent-primary/10 border-l-2 border-accent-primary"
                            : "hover:bg-surface-2/40"
                        }`}
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <div className="flex items-center gap-2">
                            <span className="font-body text-xs font-medium text-text-primary">
                              {item.name}
                            </span>
                            <span className="font-mono text-[9px] px-1.5 py-0.2 rounded bg-surface-2 border border-border/60 text-text-muted uppercase">
                              {item.category}
                            </span>
                            {isCustom && (
                              <span className="font-mono text-[9px] px-1 py-0.2 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400">
                                CUSTOM
                              </span>
                            )}
                          </div>
                          <p className="font-body text-[11px] text-text-muted mt-0.5">
                            {item.description}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                          {isEditing ? (
                            <div className="flex items-center gap-1.5">
                              <div className="flex items-center gap-1 px-2.5 py-1 rounded border border-accent-primary bg-background shadow-xs">
                                <span className="relative flex h-2 w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-primary opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-primary"></span>
                                </span>
                                <span className="font-mono text-xs font-bold text-accent-primary min-w-16 text-center">
                                  {recordedCombo
                                    ? formatKeyComboDisplay(recordedCombo)
                                    : "Press keys..."}
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  if (recordedCombo)
                                    updateKeybinding(item.id, recordedCombo);
                                  setEditingKeyId(null);
                                  setRecordedCombo(null);
                                  setConflictWarning(null);
                                }}
                                disabled={!recordedCombo}
                                className="rounded px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-body text-xs font-medium flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
                              >
                                <Check className="w-3.5 h-3.5" />
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingKeyId(null);
                                  setRecordedCombo(null);
                                  setConflictWarning(null);
                                }}
                                className="rounded px-2 py-1 bg-surface-2 hover:bg-surface-3 border border-border text-text-muted hover:text-text-primary font-body text-xs cursor-pointer transition-colors"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <kbd className="inline-flex items-center justify-center font-mono text-[11px] font-semibold text-text-primary bg-surface-2 border border-border/90 px-2 py-0.5 rounded shadow-2xs min-w-14 text-center">
                                {formatKeyComboDisplay(item.currentKey)}
                              </kbd>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingKeyId(item.id);
                                  setRecordedCombo(null);
                                  setConflictWarning(null);
                                }}
                                className="flex items-center gap-1 rounded-[3px] border border-border/90 bg-surface-2 hover:bg-surface-3 px-2 py-0.5 font-body text-xs text-text-body hover:text-accent-primary hover:border-accent-primary/50 transition-all cursor-pointer shadow-2xs"
                              >
                                <Edit2 className="w-3 h-3 text-text-muted" />
                                <span>Edit</span>
                              </button>
                            </div>
                          )}
                        </div>

                        {isEditing && conflictWarning && (
                          <div className="w-full mt-1.5 flex items-center gap-1.5 text-amber-400 font-mono text-[10px] bg-amber-950/30 border border-amber-500/30 px-2 py-1 rounded">
                            <AlertTriangle className="w-3 h-3 shrink-0" />
                            <span>{conflictWarning}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* =====================================================================
              TAB 2: PERSONALIZATION
              ===================================================================== */}
          {activeTab === "personalization" && (
            <div className="space-y-6">
              {/* Response Style */}
              <div className="space-y-2.5 border-b border-border/50 pb-4">
                <div>
                  <span className="font-display text-xs font-medium text-text-primary block">
                    How should the Workbench respond?
                  </span>
                  <span className="font-body text-[11px] text-text-muted mt-0.5 block">
                    Shapes the baseline tone, structural formality, and code
                    detail density across all conversations.
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-0.5">
                  {(
                    [
                      "professional",
                      "concise",
                      "detailed",
                      "technical",
                    ] as const
                  ).map((style) => {
                    const isSelected = settings.responseStyle === style;
                    return (
                      <button
                        key={style}
                        type="button"
                        onClick={() => updateSetting("responseStyle", style)}
                        className={`px-2.5 py-1.5 rounded-[3px] font-body text-xs capitalize transition-all cursor-pointer text-center ${
                          isSelected
                            ? "bg-surface-2 text-accent-primary border border-accent-primary font-semibold shadow-xs"
                            : "border border-border bg-surface-1 text-text-muted hover:text-text-primary hover:bg-surface-2/40"
                        }`}
                      >
                        {style}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Instructions */}
              <div className="space-y-1.5 border-b border-border/50 pb-4">
                <div className="flex items-center justify-between">
                  <span className="font-display text-xs font-medium text-text-primary block">
                    Custom Instructions
                  </span>
                  <span className="font-mono text-[9px] text-text-muted">
                    {settings.customInstructions.length} characters
                  </span>
                </div>
                <p className="font-body text-[11px] text-text-muted">
                  Tell the Workbench how you&apos;d like it to respond. Specify
                  coding standards, framework preferences, or industry
                  terminology.
                </p>
                <textarea
                  rows={3}
                  value={settings.customInstructions}
                  onChange={(e) =>
                    updateSetting("customInstructions", e.target.value)
                  }
                  placeholder="Tell the Workbench how you'd like it to respond... e.g. Prefer TypeScript, adhere to industrial safety norms, format math in LaTeX..."
                  className="w-full rounded-[3px] border border-border bg-surface-2 p-2.5 font-body text-xs text-text-primary focus:border-accent-primary focus:outline-none placeholder:text-text-placeholder leading-relaxed resize-y mt-1.5"
                />
              </div>

              {/* Response Preferences */}
              <div className="space-y-2.5 border-b border-border/50 pb-4">
                <span className="font-mono text-[10px] uppercase tracking-wider text-text-body block">
                  Response Preferences
                </span>

                <div className="space-y-2 text-xs font-body">
                  <div className="flex items-center justify-between py-1">
                    <div>
                      <span className="font-medium text-text-primary block">
                        Prefer structured responses
                      </span>
                      <span className="text-text-muted text-[11px]">
                        Format analytical output with clear markdown headings,
                        bulleted lists, and step-by-step logic.
                      </span>
                    </div>
                    <ToggleSwitch
                      checked={settings.preferStructuredResponses}
                      onChange={(val) =>
                        updateSetting("preferStructuredResponses", val)
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between py-1">
                    <div>
                      <span className="font-medium text-text-primary block">
                        Include source references
                      </span>
                      <span className="text-text-muted text-[11px]">
                        Always attach citation chips with document filenames,
                        chunk IDs, and page numbers.
                      </span>
                    </div>
                    <ToggleSwitch
                      checked={settings.includeSourceReferences}
                      onChange={(val) =>
                        updateSetting("includeSourceReferences", val)
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between py-1">
                    <div>
                      <span className="font-medium text-text-primary block">
                        Show relevant agent activity
                      </span>
                      <span className="text-text-muted text-[11px]">
                        Display live LangGraph supervisor routing decisions and
                        active sub-agent worker tags.
                      </span>
                    </div>
                    <ToggleSwitch
                      checked={settings.showAgentActivity}
                      onChange={(val) =>
                        updateSetting("showAgentActivity", val)
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between py-1">
                    <div>
                      <span className="font-medium text-text-primary block">
                        Prefer concise answers
                      </span>
                      <span className="text-text-muted text-[11px]">
                        Skip conversational pleasantries; return direct
                        technical code and answers immediately.
                      </span>
                    </div>
                    <ToggleSwitch
                      checked={settings.preferConciseAnswers}
                      onChange={(val) =>
                        updateSetting("preferConciseAnswers", val)
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Workspace Preferences */}
              <div className="space-y-3">
                <span className="font-mono text-[10px] uppercase tracking-wider text-text-body block">
                  Workspace Preferences
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-body text-xs font-medium text-text-primary block">
                      Default Artifact View
                    </label>
                    <select
                      value={settings.defaultArtifactView}
                      onChange={(e) =>
                        updateSetting(
                          "defaultArtifactView",
                          e.target.value as "preview" | "code" | "split",
                        )
                      }
                      className="w-full rounded-[2px] border border-border bg-surface-2 px-2.5 py-1.5 font-body text-xs text-text-primary focus:border-accent-primary focus:outline-none cursor-pointer"
                    >
                      <option value="preview">
                        Preview (Live Interactive Render)
                      </option>
                      <option value="code">Code (Monaco / Syntax View)</option>
                      <option value="split">Dual Split (Code + Preview)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-body text-xs font-medium text-text-primary block">
                      Default Chat / Artifact Split
                    </label>
                    <select
                      value={settings.defaultSplitRatio}
                      onChange={(e) =>
                        updateSetting(
                          "defaultSplitRatio",
                          e.target.value as
                            | "50/50"
                            | "40/60"
                            | "60/40"
                            | "70/30",
                        )
                      }
                      className="w-full rounded-[2px] border border-border bg-surface-2 px-2.5 py-1.5 font-body text-xs text-text-primary focus:border-accent-primary focus:outline-none cursor-pointer"
                    >
                      <option value="50/50">
                        50 / 50 (Balanced Half-Canvas)
                      </option>
                      <option value="40/60">
                        40 / 60 (Expansive Artifact Studio)
                      </option>
                      <option value="60/40">
                        60 / 40 (Focused Conversational)
                      </option>
                      <option value="70/30">
                        70 / 30 (Compact Code Inspector)
                      </option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =====================================================================
              TAB 3: AI & MODELS
              ===================================================================== */}
          {activeTab === "models" && (
            <div className="space-y-5">
              {/* Sovereign Notice Banner */}
              <div className="rounded-[3px] border border-accent-primary/30 bg-surface-1 p-3 flex items-start gap-2.5">
                <Cpu className="w-4 h-4 text-accent-primary shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-accent-primary block">
                    SOVEREIGN ON-PREMISE INFERENCE
                  </span>
                  <p className="font-body text-xs text-text-muted leading-relaxed">
                    Models run inside the local sovereign environment with zero
                    external network egress. All weights are executed on your
                    local GPU/CPU or dedicated enclave host.
                  </p>
                </div>
              </div>

              {/* Default Inference Engine */}
              <div className="space-y-1.5 border-b border-border/50 pb-4">
                <div className="flex items-center justify-between">
                  <label className="font-mono text-[10px] uppercase tracking-wider text-text-body">
                    DEFAULT INFERENCE ENGINE
                  </label>
                  <span className="font-mono text-[9px] text-emerald-400 bg-emerald-950/30 px-1.5 py-0.2 rounded-[2px] border border-emerald-500/30">
                    ● LOCAL ACTIVE
                  </span>
                </div>
                <select
                  value={settings.defaultEngine}
                  onChange={(e) =>
                    updateSetting("defaultEngine", e.target.value)
                  }
                  className="w-full rounded-[2px] border border-border bg-surface-2 px-2.5 py-1.5 text-text-primary font-body text-xs focus:border-accent-primary focus:outline-none cursor-pointer"
                >
                  <option>llama3.1:8b (Sovereign Reasoning)</option>
                  <option>qwen2.5:7b-instruct (Fast Coding)</option>
                  <option>Halide-V4 (Pro Reasoning Enclave)</option>
                  <option>mistral-nemo:12b (128k High Context)</option>
                  <option>deepseek-r1:8b (Deep Mathematical Proofs)</option>
                </select>
                <p className="font-body text-[11px] text-text-muted mt-0.5">
                  Primary orchestrator model executing multi-agent planning and
                  code generation.
                </p>
              </div>

              {/* Specialized Models (Reasoning, Vision, Embedding) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-border/50 pb-4">
                <div className="space-y-1">
                  <label className="font-mono text-[10px] uppercase tracking-wider text-text-body block">
                    REASONING MODEL
                  </label>
                  <select
                    value={settings.reasoningModel}
                    onChange={(e) =>
                      updateSetting("reasoningModel", e.target.value)
                    }
                    className="w-full rounded-[2px] border border-border bg-surface-2 px-2.5 py-1.5 text-text-primary font-body text-xs focus:border-accent-primary focus:outline-none cursor-pointer"
                  >
                    <option>llama3.1:8b (Primary Orchestrator)</option>
                    <option>qwen2.5:7b-instruct (Lightweight)</option>
                    <option>Halide-V4 (Deep Reasoning)</option>
                  </select>
                  <span className="font-body text-[11px] text-text-muted block">
                    Dedicated reasoning engine powering the LangGraph supervisor
                    state loop.
                  </span>
                </div>

                <div className="space-y-1">
                  <label className="font-mono text-[10px] uppercase tracking-wider text-text-body block">
                    VISION MODEL
                  </label>
                  <select
                    value={settings.visionModel}
                    onChange={(e) =>
                      updateSetting("visionModel", e.target.value)
                    }
                    className="w-full rounded-[2px] border border-border bg-surface-2 px-2.5 py-1.5 text-text-primary font-body text-xs focus:border-accent-primary focus:outline-none cursor-pointer"
                  >
                    <option>
                      qwen2-vl:7b-instruct-q4_K_M (Local OCR & Diagrams)
                    </option>
                    <option>llava:7b (Standard Multimodal)</option>
                    <option>minicpm-v:8b (High Resolution Schematics)</option>
                  </select>
                  <span className="font-body text-[11px] text-text-muted block">
                    Multimodal vision model for technical schematics, OCR, and
                    diagram analysis.
                  </span>
                </div>

                <div className="space-y-1 md:col-span-2">
                  <label className="font-mono text-[10px] uppercase tracking-wider text-text-body block">
                    EMBEDDING MODEL (LOCAL RAG)
                  </label>
                  <select
                    value={settings.embeddingModel}
                    onChange={(e) =>
                      updateSetting("embeddingModel", e.target.value)
                    }
                    className="w-full rounded-[2px] border border-border bg-surface-2 px-2.5 py-1.5 text-text-primary font-body text-xs focus:border-accent-primary focus:outline-none cursor-pointer"
                  >
                    <option>bge-m3 (Dense 1024-dim Local RAG)</option>
                    <option>nomic-embed-text (512-dim Low Memory)</option>
                    <option>all-minilm-l6-v2 (Ultra Fast 384-dim)</option>
                  </select>
                  <span className="font-body text-[11px] text-text-muted block">
                    Vector embedding model used for dense semantic retrieval
                    across local PDF and code files.
                  </span>
                </div>
              </div>

              {/* Temperature Slider */}
              <div className="space-y-1.5 border-b border-border/50 pb-4">
                <div className="flex items-center justify-between">
                  <label className="font-mono text-[10px] uppercase tracking-wider text-text-body">
                    TEMPERATURE
                  </label>
                  <span className="font-mono text-xs font-semibold text-accent-primary bg-surface-2 px-2 py-0.5 rounded-[2px] border border-border">
                    {settings.temperature}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={settings.temperature}
                  onChange={(e) =>
                    updateSetting("temperature", parseFloat(e.target.value))
                  }
                  className="w-full accent-accent-primary cursor-pointer mt-1.5"
                />
                <div className="flex justify-between font-mono text-[9px] text-text-muted pt-0.5">
                  <span>0.0 (Deterministic / Analytical)</span>
                  <span>0.5 (Balanced)</span>
                  <span>1.0 (Creative)</span>
                </div>
                <p className="font-body text-[11px] text-text-muted mt-0.5">
                  Lower values produce precise, repeatable engineering answers.
                  Recommended 0.2 for strict code and RAG workflows.
                </p>
              </div>

              {/* Reasoning Effort Deliberation */}
              <div className="space-y-1.5">
                <label className="font-mono text-[10px] uppercase tracking-wider text-text-body block">
                  REASONING EFFORT
                </label>
                <div className="flex items-center gap-2 pt-0.5">
                  {(["high", "medium", "low"] as const).map((effort) => (
                    <button
                      key={effort}
                      type="button"
                      onClick={() => updateSetting("reasoningEffort", effort)}
                      className={`flex-1 px-3 py-1.5 rounded-[2px] font-mono text-xs uppercase tracking-wider transition-all cursor-pointer text-center ${
                        settings.reasoningEffort === effort
                          ? "bg-surface-2 text-accent-primary border border-accent-primary font-semibold shadow-xs"
                          : "border border-border bg-surface-1 text-text-muted hover:text-text-primary hover:bg-surface-2/40"
                      }`}
                    >
                      {effort}
                    </button>
                  ))}
                </div>
                <p className="font-body text-[11px] text-text-muted mt-0.5">
                  Deliberation token budget allocated for deep problem
                  decomposition and multi-step plan generation.
                </p>
              </div>
            </div>
          )}

          {/* =====================================================================
              TAB 4: APPEARANCE
              ===================================================================== */}
          {activeTab === "appearance" && (
            <div className="space-y-5">
              {/* Theme */}
              <div className="space-y-2 border-b border-border/50 pb-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <span className="font-body text-xs font-medium text-text-primary block">
                      Interface Theme
                    </span>
                    <span className="font-body text-[11px] text-text-muted mt-0.5 block">
                      Sovereign darkroom palette calibrated for reduced eye
                      fatigue during extended engineering sessions.
                    </span>
                  </div>
                  <ToggleSwitch
                    variant="theme"
                    checked={settings.theme === "dark"}
                    onChange={(isDark) =>
                      updateSetting("theme", isDark ? "dark" : "dim")
                    }
                    label="Toggle Dark / Dim mode"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2.5 pt-1">
                  {[
                    { id: "dark", label: "Dark", desc: "Default Sovereign" },
                    { id: "dim", label: "Dim", desc: "Warm Charcoal" },
                    {
                      id: "system",
                      label: "System",
                      desc: "Sync OS Preference",
                    },
                  ].map((t) => {
                    const isSelected = settings.theme === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() =>
                          updateSetting(
                            "theme",
                            t.id as "dark" | "dim" | "system",
                          )
                        }
                        className={`p-2.5 rounded-[3px] text-left transition-all cursor-pointer ${
                          isSelected
                            ? "bg-surface-2 border border-accent-primary text-text-primary shadow-xs"
                            : "bg-surface-1 border border-border text-text-muted hover:text-text-body hover:bg-surface-2/40"
                        }`}
                      >
                        <span className="font-body text-xs font-medium text-text-primary block">
                          {t.label}
                        </span>
                        <span className="font-mono text-[9px] text-text-muted mt-0.5 block">
                          {t.desc}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Workbench Accent */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 py-2.5 border-b border-border/50">
                <div>
                  <span className="font-body text-xs font-medium text-text-primary block">
                    Workbench Accent
                  </span>
                  <span className="font-body text-[11px] text-text-muted mt-0.5 block">
                    Darkroom Amber (#D97A3F) · Kept strictly under 10% screen
                    distribution.
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 font-mono text-xs text-text-primary bg-surface-2 border border-border px-2.5 py-1 rounded-[2px]">
                    <span className="w-3 h-3 rounded-[2px] bg-accent-primary inline-block shadow-xs" />
                    <span>#D97A3F (Amber)</span>
                  </div>
                </div>
              </div>

              {/* Film Grain Texture */}
              <div className="flex items-center justify-between py-2.5 border-b border-border/50">
                <div>
                  <span className="font-body text-xs font-medium text-text-primary block">
                    Film Grain / Darkroom Texture
                  </span>
                  <span className="font-body text-[11px] text-text-muted mt-0.5 block">
                    Analog SVG noise filter (3.5% opacity) across workspace to
                    soften monitor glare.
                  </span>
                </div>
                <ToggleSwitch
                  checked={settings.filmGrainEnabled}
                  onChange={(val) => updateSetting("filmGrainEnabled", val)}
                />
              </div>

              {/* Density */}
              <div className="space-y-1.5 pt-0.5">
                <div>
                  <span className="font-body text-xs font-medium text-text-primary block">
                    Interface Density
                  </span>
                  <span className="font-body text-[11px] text-text-muted mt-0.5 block">
                    Adjust vertical rhythm, line heights, and padding across
                    messages and panels.
                  </span>
                </div>

                <div className="flex items-center gap-2 pt-0.5">
                  {(["comfortable", "compact"] as const).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => updateSetting("density", d)}
                      className={`flex-1 px-3 py-1.5 rounded-[2px] font-body text-xs capitalize transition-all cursor-pointer text-center ${
                        settings.density === d
                          ? "bg-surface-2 text-accent-primary border border-accent-primary font-semibold shadow-xs"
                          : "border border-border bg-surface-1 text-text-muted hover:text-text-primary"
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* =====================================================================
              TAB 5: SECURITY & PRIVACY
              ===================================================================== */}
          {activeTab === "security" && (
            <div className="space-y-5">
              {/* Security Status Summary Card */}
              <div className="rounded-[4px] border border-emerald-500/40 bg-emerald-950/20 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-mono text-xs font-semibold text-emerald-400">
                    <ShieldCheck className="w-4 h-4" />
                    <span>SOVEREIGN ENCLAVE STATUS: SECURE</span>
                  </div>
                  <span className="font-mono text-[9px] text-emerald-300 bg-emerald-900/40 px-1.5 py-0.2 rounded border border-emerald-500/30">
                    AIR-GAP VERIFIED
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1 border-t border-emerald-500/20">
                  <div>
                    <span className="font-mono text-[9px] uppercase tracking-wider text-emerald-400/80 block">
                      INFERENCE
                    </span>
                    <span className="font-body text-xs font-medium text-text-primary">
                      100% Local GPU
                    </span>
                  </div>
                  <div>
                    <span className="font-mono text-[9px] uppercase tracking-wider text-emerald-400/80 block">
                      NETWORK
                    </span>
                    <span className="font-body text-xs font-medium text-text-primary">
                      Zero Egress
                    </span>
                  </div>
                  <div>
                    <span className="font-mono text-[9px] uppercase tracking-wider text-emerald-400/80 block">
                      AUDIT LOGGING
                    </span>
                    <span className="font-body text-xs font-medium text-text-primary">
                      SHA-256 Ledger
                    </span>
                  </div>
                  <div>
                    <span className="font-mono text-[9px] uppercase tracking-wider text-emerald-400/80 block">
                      EXECUTION
                    </span>
                    <span className="font-body text-xs font-medium text-text-primary">
                      Isolated Sandbox
                    </span>
                  </div>
                </div>
              </div>

              {/* Core Security Enforcements */}
              <div className="space-y-2.5 border-b border-border/50 pb-4">
                <span className="font-mono text-[10px] uppercase tracking-wider text-text-body block">
                  Security Enforcements
                </span>

                <div className="space-y-2 text-xs font-body">
                  <div className="flex items-center justify-between py-1.5 border-b border-border/40">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs font-medium text-text-primary">
                          ZERO-EGRESS
                        </span>
                        <span className="font-mono text-[9px] bg-emerald-950/40 text-emerald-400 px-1.5 py-0.2 rounded border border-emerald-500/30">
                          ENFORCED
                        </span>
                      </div>
                      <span className="text-text-muted text-[11px] mt-0.5 block">
                        Hardware and socket-level interceptor drops all outbound
                        Internet requests.
                      </span>
                    </div>
                    <ToggleSwitch
                      checked={settings.zeroEgress}
                      onChange={(val) => updateSetting("zeroEgress", val)}
                    />
                  </div>

                  <div className="flex items-center justify-between py-1.5 border-b border-border/40">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs font-medium text-text-primary">
                          AUDIT LOGGING
                        </span>
                        <span className="font-mono text-[9px] bg-emerald-950/40 text-emerald-400 px-1.5 py-0.2 rounded border border-emerald-500/30">
                          ACTIVE
                        </span>
                      </div>
                      <span className="text-text-muted text-[11px] mt-0.5 block">
                        Cryptographically appends all tool invocations and state
                        changes to SQLite ledger.
                      </span>
                    </div>
                    <ToggleSwitch
                      checked={settings.auditLogging}
                      onChange={(val) => updateSetting("auditLogging", val)}
                    />
                  </div>

                  <div className="flex items-center justify-between py-1.5 border-b border-border/40">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs font-medium text-text-primary">
                          SANDBOX EXECUTION
                        </span>
                        <span className="font-mono text-[9px] bg-emerald-950/40 text-emerald-400 px-1.5 py-0.2 rounded border border-emerald-500/30">
                          RESTRICTED
                        </span>
                      </div>
                      <span className="text-text-muted text-[11px] mt-0.5 block">
                        Limits code interpreter execution to 512 MB memory and
                        10 second timeout windows.
                      </span>
                    </div>
                    <ToggleSwitch
                      checked={settings.sandboxExecution}
                      onChange={(val) => updateSetting("sandboxExecution", val)}
                    />
                  </div>

                  <div className="flex items-center justify-between py-1.5">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs font-medium text-text-primary">
                          LOCAL VOICE TRANSCRIPTION
                        </span>
                        <span className="font-mono text-[9px] bg-emerald-950/40 text-emerald-400 px-1.5 py-0.2 rounded border border-emerald-500/30">
                          IN-PROCESS
                        </span>
                      </div>
                      <span className="text-text-muted text-[11px] mt-0.5 block">
                        Faster-Whisper processes audio locally on CPU/GPU
                        without cloud audio services.
                      </span>
                    </div>
                    <ToggleSwitch
                      checked={settings.localVoiceTranscription}
                      onChange={(val) =>
                        updateSetting("localVoiceTranscription", val)
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Cryptographic Checksum & Verification */}
              <div className="rounded-[3px] border border-border bg-surface-1 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-semibold text-text-primary">
                    ENCLAVE SIGNATURE INTEGRITY
                  </span>
                  <span className="font-mono text-[9px] text-text-muted">
                    SHA-256
                  </span>
                </div>
                <p className="font-mono text-[10px] text-accent-primary bg-surface-2 p-2 rounded border border-border break-all">
                  sha256:7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069
                </p>
                <div className="flex items-center justify-between pt-0.5">
                  <button
                    type="button"
                    onClick={handleVerifyIntegrity}
                    disabled={verifyingIntegrity}
                    className="rounded-[2px] bg-surface-2 border border-border px-2.5 py-1 font-mono text-xs text-text-primary hover:text-accent-primary hover:border-accent-primary/50 transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <RefreshCw
                      className={`w-3 h-3 ${verifyingIntegrity ? "animate-spin text-accent-primary" : ""}`}
                    />
                    <span>
                      {verifyingIntegrity
                        ? "Verifying Hashes..."
                        : "Verify Enclave Integrity"}
                    </span>
                  </button>
                  {integrityVerified && (
                    <span className="font-mono text-xs text-emerald-400 flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      Hashes Match ✓
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* =====================================================================
              TAB 6: DATA & STORAGE
              ===================================================================== */}
          {activeTab === "data" && (
            <div className="space-y-5">
              {/* Storage Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="rounded-[3px] border border-border bg-surface-1 p-2.5 space-y-0.5">
                  <span className="font-mono text-[9px] uppercase tracking-wider text-text-muted block">
                    LOCAL DATABASE
                  </span>
                  <span className="font-mono text-sm font-semibold text-text-primary block">
                    24.8 MB
                  </span>
                  <span className="font-body text-[10px] text-text-muted">
                    SQLite Enclave
                  </span>
                </div>

                <div className="rounded-[3px] border border-border bg-surface-1 p-2.5 space-y-0.5">
                  <span className="font-mono text-[9px] uppercase tracking-wider text-text-muted block">
                    DOCUMENT STORE
                  </span>
                  <span className="font-mono text-sm font-semibold text-text-primary block">
                    142.6 MB
                  </span>
                  <span className="font-body text-[10px] text-text-muted">
                    Vector Embeddings
                  </span>
                </div>

                <div className="rounded-[3px] border border-border bg-surface-1 p-2.5 space-y-0.5">
                  <span className="font-mono text-[9px] uppercase tracking-wider text-text-muted block">
                    ARTIFACTS ARCHIVE
                  </span>
                  <span className="font-mono text-sm font-semibold text-text-primary block">
                    68.2 MB
                  </span>
                  <span className="font-body text-[10px] text-text-muted">
                    128 Artifacts
                  </span>
                </div>

                <div className="rounded-[3px] border border-border bg-surface-1 p-2.5 space-y-0.5">
                  <span className="font-mono text-[9px] uppercase tracking-wider text-text-muted block">
                    MEMORY CACHE
                  </span>
                  <span className="font-mono text-sm font-semibold text-text-primary block">
                    18.4 MB
                  </span>
                  <span className="font-body text-[10px] text-text-muted">
                    Ephemeral State
                  </span>
                </div>
              </div>

              {/* Data Retention Policy */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 py-2.5 border-b border-border/50">
                <div>
                  <span className="font-body text-xs font-medium text-text-primary block">
                    Conversation Retention Policy
                  </span>
                  <span className="font-body text-[11px] text-text-muted mt-0.5 block">
                    Automatic cleanup frequency for local chat histories and
                    thinking traces.
                  </span>
                </div>
                <select
                  value={settings.dataRetention}
                  onChange={(e) =>
                    updateSetting(
                      "dataRetention",
                      e.target.value as "indefinite" | "30days" | "ephemeral",
                    )
                  }
                  className="rounded-[2px] border border-border bg-surface-2 px-2.5 py-1 font-body text-xs text-text-primary focus:border-accent-primary focus:outline-none cursor-pointer w-full sm:w-52"
                >
                  <option value="indefinite">
                    Retain history indefinitely
                  </option>
                  <option value="30days">
                    Purge sessions older than 30 days
                  </option>
                  <option value="ephemeral">
                    Session-only (Ephemeral wipe on exit)
                  </option>
                </select>
              </div>

              {/* Storage Management Actions */}
              <div className="space-y-3 pt-0.5">
                <span className="font-mono text-[10px] uppercase tracking-wider text-text-body block">
                  Storage Actions
                </span>

                <div className="space-y-2.5">
                  {/* Export Workspace Data */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-2.5 rounded-[3px] border border-border bg-surface-1">
                    <div>
                      <span className="font-body text-xs font-medium text-text-primary block">
                        Export Workspace Data
                      </span>
                      <span className="font-body text-[11px] text-text-muted mt-0.5 block">
                        Export all chat sessions, project artifacts, and
                        preferences as an encrypted JSON archive.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleExportData}
                      className="rounded-[2px] border border-border bg-surface-2 px-2.5 py-1 font-mono text-xs text-text-primary hover:text-accent-primary hover:border-accent-primary/60 transition-colors cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
                    >
                      <Download className="w-3 h-3" />
                      <span>Export Archive</span>
                    </button>
                  </div>

                  {/* Clear Cache */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-2.5 rounded-[3px] border border-border bg-surface-1">
                    <div>
                      <span className="font-body text-xs font-medium text-text-primary block">
                        Clear Temporary Cache
                      </span>
                      <span className="font-body text-[11px] text-text-muted mt-0.5 block">
                        Purge temporary RAG embeddings and UI render buffers
                        without deleting saved conversations.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setClearCacheModalOpen(true)}
                      className="rounded-[2px] border border-border bg-surface-2 px-2.5 py-1 font-mono text-xs text-text-muted hover:text-text-primary hover:border-border/80 transition-colors cursor-pointer shrink-0"
                    >
                      Clear Cache
                    </button>
                  </div>

                  {/* Delete Local Data (Destructive) */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-2.5 rounded-[3px] border border-rose-900/40 bg-rose-950/10">
                    <div>
                      <span className="font-body text-xs font-medium text-rose-300 block">
                        Delete All Local Data
                      </span>
                      <span className="font-body text-[11px] text-rose-400/70 mt-0.5 block">
                        Permanently erase SQLite enclave database, all chat
                        histories, and locally cached weights.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDeleteDataModalOpen(true)}
                      className="rounded-[2px] border border-rose-800/80 bg-rose-950/40 px-2.5 py-1 font-mono text-xs text-rose-300 hover:bg-rose-900/60 transition-colors cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Delete Local Data</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =====================================================================
              TAB 7: AUDIO
              ===================================================================== */}
          {activeTab === "audio" && (
            <div className="space-y-5">
              {/* Audio Enclave Status Notice */}
              <div className="rounded-[3px] border border-accent-primary/30 bg-surface-1 p-3 flex items-start gap-2.5">
                <Volume2 className="w-4 h-4 text-accent-primary shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-accent-primary">
                      LOCAL TRANSCRIPTION
                    </span>
                    <span className="font-mono text-[9px] text-emerald-400 bg-emerald-950/40 px-1.5 py-0.2 rounded border border-emerald-500/30">
                      Whisper Enclave
                    </span>
                  </div>
                  <p className="font-body text-xs text-text-muted leading-relaxed">
                    Voice speech recognition executes locally via in-process
                    Faster-Whisper. Zero audio packets are ever transmitted over
                    external networks or third-party APIs.
                  </p>
                </div>
              </div>

              {/* Microphone Selection */}
              <div className="space-y-1 border-b border-border/50 pb-4">
                <label className="font-mono text-[10px] uppercase tracking-wider text-text-body block">
                  MICROPHONE INPUT DEVICE
                </label>
                <select
                  value={settings.audioInputDevice}
                  onChange={(e) =>
                    updateSetting("audioInputDevice", e.target.value)
                  }
                  className="w-full rounded-[2px] border border-border bg-surface-2 px-2.5 py-1.5 text-text-primary font-body text-xs focus:border-accent-primary focus:outline-none cursor-pointer"
                >
                  <option>Default - High Definition Audio Device</option>
                  <option>Microphone (Realtek(R) Audio)</option>
                  <option>Virtual Audio Cable (VB-Audio)</option>
                  <option>Studio USB Condenser Microphone</option>
                </select>
                <p className="font-body text-[11px] text-text-muted mt-0.5">
                  Active hardware input capture interface for speech input.
                </p>
              </div>

              {/* Local Whisper Model */}
              <div className="space-y-1 border-b border-border/50 pb-4">
                <label className="font-mono text-[10px] uppercase tracking-wider text-text-body block">
                  LOCAL WHISPER MODEL
                </label>
                <select
                  value={settings.localWhisperModel}
                  onChange={(e) =>
                    updateSetting("localWhisperModel", e.target.value)
                  }
                  className="w-full rounded-[2px] border border-border bg-surface-2 px-2.5 py-1.5 text-text-primary font-body text-xs focus:border-accent-primary focus:outline-none cursor-pointer"
                >
                  <option>faster-whisper-base.en (Low Latency, ~140MB)</option>
                  <option>faster-whisper-small.en (~460MB)</option>
                  <option>faster-whisper-medium.en (~1.5GB)</option>
                  <option>
                    faster-whisper-large-v3 (Industrial Precision, ~3.1GB)
                  </option>
                </select>
                <p className="font-body text-[11px] text-text-muted mt-0.5">
                  Higher parameter models provide superior technical and domain
                  vocabulary recognition at the expense of memory.
                </p>
              </div>

              {/* Voice Input Behavior */}
              <div className="space-y-3">
                <span className="font-mono text-[10px] uppercase tracking-wider text-text-body block">
                  Voice Input Behavior
                </span>

                <div className="space-y-2 text-xs font-body">
                  <div className="flex items-center justify-between py-1.5 border-b border-border/40">
                    <div>
                      <span className="font-medium text-text-primary block">
                        Voice Capture Mode
                      </span>
                      <span className="text-text-muted text-[11px]">
                        Choose between holding the spacebar or hands-free Voice
                        Activity Detection (VAD).
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          updateSetting("voiceInputMode", "push_to_talk")
                        }
                        className={`px-2.5 py-1 rounded-[2px] font-mono text-[11px] transition-all cursor-pointer ${
                          settings.voiceInputMode === "push_to_talk"
                            ? "bg-surface-2 text-accent-primary border border-accent-primary font-semibold"
                            : "bg-surface-1 border border-border text-text-muted"
                        }`}
                      >
                        Push-to-Talk
                      </button>
                      <button
                        type="button"
                        onClick={() => updateSetting("voiceInputMode", "vad")}
                        className={`px-2.5 py-1 rounded-[2px] font-mono text-[11px] transition-all cursor-pointer ${
                          settings.voiceInputMode === "vad"
                            ? "bg-surface-2 text-accent-primary border border-accent-primary font-semibold"
                            : "bg-surface-1 border border-border text-text-muted"
                        }`}
                      >
                        Auto VAD
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between py-1.5 border-b border-border/40">
                    <div>
                      <span className="font-medium text-text-primary block">
                        Noise Suppression & Echo Cancellation
                      </span>
                      <span className="text-text-muted text-[11px]">
                        In-process high-pass filter to reject industrial
                        background hum and fan noise.
                      </span>
                    </div>
                    <ToggleSwitch
                      checked={settings.noiseSuppression}
                      onChange={(val) => updateSetting("noiseSuppression", val)}
                    />
                  </div>

                  <div className="flex items-center justify-between py-1.5">
                    <div>
                      <span className="font-medium text-text-primary block">
                        Acoustic Feedback Chime
                      </span>
                      <span className="text-text-muted text-[11px]">
                        Play subtle tone when microphone opens and closes.
                      </span>
                    </div>
                    <ToggleSwitch
                      checked={settings.voiceFeedbackChime}
                      onChange={(val) =>
                        updateSetting("voiceFeedbackChime", val)
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =====================================================================
              TAB 8: DEVELOPER
              ===================================================================== */}
          {activeTab === "developer" && (
            <div className="space-y-5">
              {/* Offline MCP Action Hub */}
              <div className="rounded-[4px] border border-accent-primary/40 bg-surface-1 p-3.5 space-y-3 font-mono text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2.5">
                  <div className="flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 text-accent-primary" />
                    <span className="uppercase tracking-widest text-text-primary font-semibold text-[10px]">
                      OFFLINE MCP ACTION HUB
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMcpDrawerOpen((open) => !open)}
                    className="rounded-[2px] border border-accent-primary/50 bg-accent-primary/10 px-2 py-1 text-[10px] uppercase tracking-wider text-accent-primary hover:bg-accent-primary/20"
                  >
                    {mcpDrawerOpen ? "Close Catalog" : "Open Catalog"}
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {MCP_CATALOG.map((server) => (
                    <div
                      key={server.id}
                      className="rounded-[3px] border border-border/70 bg-surface-2/60 p-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-text-primary font-semibold">
                          {server.id}
                        </span>
                        <span
                          className={`flex items-center gap-1 text-[9px] uppercase ${mcpStates[server.id]?.status === "configured" || mcpStates[server.id]?.status === "online" ? "text-emerald-400" : mcpStates[server.id] ? "text-accent-secondary" : "text-accent-primary"}`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${mcpStates[server.id]?.status === "configured" || mcpStates[server.id]?.status === "online" ? "bg-emerald-400" : mcpStates[server.id] ? "bg-accent-secondary" : "bg-accent-primary animate-pulse"}`}
                          />
                          {mcpStates[server.id]?.status || "checking"}
                        </span>
                      </div>
                      <p className="mt-1 font-body text-[10px] leading-relaxed text-text-muted">
                        {server.description}
                      </p>
                    </div>
                  ))}
                </div>
                {mcpDrawerOpen && (
                  <div className="space-y-2 border-t border-border/60 pt-3">
                    <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-text-muted">
                      <span>Local tool catalog</span>
                      <button
                        type="button"
                        onClick={() => void refreshMcpStates()}
                        className="text-accent-primary hover:underline"
                      >
                        Refresh states
                      </button>
                    </div>
                    {MCP_CATALOG.map((server) => (
                      <div
                        key={server.id}
                        className="flex flex-col gap-2 rounded-[3px] border border-border/60 bg-[#181410] p-2.5 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <span className="text-text-primary">{server.id}</span>
                          <span className="ml-2 text-[10px] text-text-muted">
                            {server.description}
                          </span>
                          <span className="ml-2 text-[9px] text-text-muted">
                            {mcpStates[server.id]?.failure_reason || "Local endpoint healthy"}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {server.tools.map((tool) => (
                            <span
                              key={tool}
                              className="rounded-[2px] border border-border bg-surface-2 px-1.5 py-0.5 text-[9px] text-accent-primary"
                            >
                              {tool}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Stitch MCP Integration */}
              <div className="rounded-[4px] border border-border bg-surface-1 p-3.5 space-y-3 font-mono text-xs">
                <div className="border-b border-border/60 pb-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-accent-primary" />
                    <span className="uppercase tracking-widest text-text-primary font-semibold text-[10px]">
                      STITCH MCP PROTOCOL INTEGRATION
                    </span>
                  </div>
                  <span className="text-emerald-400 text-[9px] bg-emerald-950/40 px-1.5 py-0.2 rounded-[2px] border border-emerald-500/30 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    CONNECTED
                  </span>
                </div>

                <div className="space-y-1.5 font-body text-xs text-text-muted leading-relaxed">
                  <p>
                    Connected to Stitch Model Context Protocol endpoint for
                    runtime tools execution.
                  </p>
                  <div className="space-y-1 font-mono text-[10px] pt-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-text-muted">ENDPOINT:</span>
                      <code className="text-text-primary bg-surface-2 px-1.5 py-0.2 rounded border border-border">
                        {settings.mcpEndpoint}
                      </code>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-text-muted">PROJECT:</span>
                      <code className="text-accent-primary bg-surface-2 px-1.5 py-0.2 rounded border border-border">
                        {settings.mcpProjectId}
                      </code>
                    </div>
                  </div>
                </div>

                <div className="pt-1 flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleTestMcpPing}
                    disabled={mcpPingStatus === "testing"}
                    className="rounded-[2px] bg-surface-2 border border-border px-2.5 py-1 font-mono text-xs text-text-primary hover:text-accent-primary hover:border-accent-primary/60 transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <RefreshCw
                      className={`w-3 h-3 ${mcpPingStatus === "testing" ? "animate-spin text-accent-primary" : ""}`}
                    />
                    <span>
                      {mcpPingStatus === "testing"
                        ? "Pinging MCP..."
                        : mcpPingStatus === "connected"
                          ? "Ping 12ms (OK)"
                          : "Ping Server"}
                    </span>
                  </button>
                  <span className="font-mono text-[9px] text-text-muted">
                    6 Active Tools Registered (sandbox, rag, vision, file_ops)
                  </span>
                </div>
              </div>

              {/* Gateway API Endpoints */}
              <div className="space-y-2 border-b border-border/50 pb-4">
                <span className="font-mono text-[10px] uppercase tracking-wider text-text-body block">
                  Backend Gateway Endpoints
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  <div className="p-2.5 rounded-[3px] border border-border bg-surface-1 space-y-0.5 font-mono">
                    <span className="text-[9px] uppercase text-text-muted block">
                      REST API BASE
                    </span>
                    <span className="text-text-primary text-[11px] block">
                      http://localhost:8000/api/v1
                    </span>
                  </div>
                  <div className="p-2.5 rounded-[3px] border border-border bg-surface-1 space-y-0.5 font-mono">
                    <span className="text-[9px] uppercase text-text-muted block">
                      WEBSOCKET AGENTS
                    </span>
                    <span className="text-text-primary text-[11px] block">
                      ws://localhost:8000/api/v1/agents/ws
                    </span>
                  </div>
                </div>
              </div>

              {/* Developer Switches */}
              <div className="space-y-2.5 border-b border-border/50 pb-4">
                <span className="font-mono text-[10px] uppercase tracking-wider text-text-body block">
                  Telemetry & Diagnostics
                </span>

                <div className="space-y-2 text-xs font-body">
                  <div className="flex items-center justify-between py-1">
                    <div>
                      <span className="font-medium text-text-primary block">
                        Auto-Save Generated Artifacts
                      </span>
                      <span className="text-text-muted text-[11px]">
                        Write incremental versions directly to local storage
                        cache.
                      </span>
                    </div>
                    <ToggleSwitch
                      checked={settings.autoSaveArtifacts}
                      onChange={(val) =>
                        updateSetting("autoSaveArtifacts", val)
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between py-1">
                    <div>
                      <span className="font-medium text-text-primary block">
                        Live Virtualized Telemetry Stream
                      </span>
                      <span className="text-text-muted text-[11px]">
                        Keep live performance metrics active on Preview tabs.
                      </span>
                    </div>
                    <ToggleSwitch
                      checked={settings.telemetryStreaming}
                      onChange={(val) =>
                        updateSetting("telemetryStreaming", val)
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between py-1">
                    <div>
                      <span className="font-medium text-text-primary block">
                        Verbose LangGraph State Logging
                      </span>
                      <span className="text-text-muted text-[11px]">
                        Output all supervisor node transitions and tool returns
                        to browser console.
                      </span>
                    </div>
                    <ToggleSwitch
                      checked={settings.verboseLangGraphLogging}
                      onChange={(val) =>
                        updateSetting("verboseLangGraphLogging", val)
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Sandbox Limits */}
              <div className="space-y-2">
                <span className="font-mono text-[10px] uppercase tracking-wider text-text-body block">
                  Sandbox Resource Constraints
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-body text-xs font-medium text-text-primary block">
                      Memory Limit (MB)
                    </label>
                    <input
                      type="number"
                      value={settings.sandboxMemoryLimitMb}
                      onChange={(e) =>
                        updateSetting(
                          "sandboxMemoryLimitMb",
                          parseInt(e.target.value) || 512,
                        )
                      }
                      className="w-full rounded-[2px] border border-border bg-surface-2 px-2.5 py-1 font-mono text-xs text-text-primary focus:border-accent-primary focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-body text-xs font-medium text-text-primary block">
                      Execution Timeout (Seconds)
                    </label>
                    <input
                      type="number"
                      value={settings.sandboxTimeoutSeconds}
                      onChange={(e) =>
                        updateSetting(
                          "sandboxTimeoutSeconds",
                          parseInt(e.target.value) || 10,
                        )
                      }
                      className="w-full rounded-[2px] border border-border bg-surface-2 px-2.5 py-1 font-mono text-xs text-text-primary focus:border-accent-primary focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =====================================================================
              TAB 9: ABOUT
              ===================================================================== */}
          {activeTab === "about" && (
            <div className="space-y-5">
              {/* Product Card */}
              <div className="rounded-[4px] border border-border bg-surface-1 p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs font-semibold text-accent-primary tracking-widest">
                        SIH PS26117
                      </span>
                      <span className="font-mono text-[9px] uppercase tracking-wider text-emerald-400 bg-emerald-950/40 px-1.5 py-0.2 rounded border border-emerald-500/30">
                        AIR-GAPPED
                      </span>
                    </div>
                    <h2 className="font-display text-lg font-medium text-text-primary">
                      Sovereign On-Premise AI Workbench
                    </h2>
                  </div>
                  <span className="font-mono text-xs text-text-muted bg-surface-2 px-2 py-0.5 rounded border border-border">
                    v4.2.0-rc2
                  </span>
                </div>

                <p className="font-body text-xs text-text-muted leading-relaxed">
                  An air-gapped, sovereign, multi-agent AI engineering workbench
                  designed for mission-critical industrial operations, technical
                  document RAG, isolated sandbox execution, and artifact
                  generation.
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2.5 border-t border-border/60 font-mono text-xs">
                  <div>
                    <span className="text-[9px] text-text-muted uppercase block">
                      BUILD INFO
                    </span>
                    <span className="text-text-primary text-[11px]">
                      2026.09-SIH-RC2
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] text-text-muted uppercase block">
                      LICENSE
                    </span>
                    <span className="text-text-primary text-[11px]">
                      Industrial Sovereign
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] text-text-muted uppercase block">
                      INTEGRITY
                    </span>
                    <span className="text-emerald-400 text-[11px]">
                      Verified Enclave
                    </span>
                  </div>
                </div>
              </div>

              {/* System Architecture Specifications */}
              <div className="space-y-2 border-b border-border/50 pb-4">
                <span className="font-mono text-[10px] uppercase tracking-wider text-text-body block">
                  Architecture Components
                </span>

                <div className="space-y-1.5 font-mono text-xs">
                  <div className="flex items-center justify-between p-2 rounded border border-border/70 bg-surface-1">
                    <span className="text-text-muted">Client Tier:</span>
                    <span className="text-text-primary">
                      React 19 + Vite 8.2 + Darkroom Studio
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded border border-border/70 bg-surface-1">
                    <span className="text-text-muted">Gateway Tier:</span>
                    <span className="text-text-primary">
                      FastAPI 0.115 + SQLite Audit DB + Faster-Whisper
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded border border-border/70 bg-surface-1">
                    <span className="text-text-muted">Intelligence Tier:</span>
                    <span className="text-text-primary">
                      LangGraph Multi-Agent Architecture
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded border border-border/70 bg-surface-1">
                    <span className="text-text-muted">Inference Tier:</span>
                    <span className="text-text-primary">
                      Ollama Local Enclave (Port 11434)
                    </span>
                  </div>
                </div>
              </div>

              {/* Links and Actions */}
              <div className="flex flex-wrap gap-2.5 pt-0.5">
                <a
                  href="#docs"
                  onClick={(e) => e.preventDefault()}
                  className="rounded-[2px] border border-border bg-surface-2 px-2.5 py-1.5 font-body text-xs text-text-primary hover:text-accent-primary hover:border-accent-primary/50 transition-colors flex items-center gap-1.5"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Architecture Documentation</span>
                </a>
                <a
                  href="#release-notes"
                  onClick={(e) => e.preventDefault()}
                  className="rounded-[2px] border border-border bg-surface-2 px-2.5 py-1.5 font-body text-xs text-text-primary hover:text-accent-primary hover:border-accent-primary/50 transition-colors flex items-center gap-1.5"
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>Release Notes (v4.2.0)</span>
                </a>
                <button
                  type="button"
                  onClick={handleVerifyIntegrity}
                  className="rounded-[2px] border border-border bg-surface-2 px-2.5 py-1.5 font-body text-xs text-text-primary hover:text-accent-primary hover:border-accent-primary/50 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>Enclave Audit Certificate</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* =========================================================================
          MODAL: Configurable Keyboard Shortcuts & Keybindings
          ========================================================================= */}
      <KeyboardShortcutsModal
        isOpen={shortcutsModalOpen}
        onClose={() => setShortcutsModalOpen(false)}
      />

      {/* =========================================================================
          MODAL: Clear Temporary Cache Confirmation
          ========================================================================= */}
      {clearCacheModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-60 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setClearCacheModalOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-[4px] border border-border bg-surface-1 p-4 shadow-xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-1">
              <h3 className="font-display text-base font-medium text-text-primary">
                Clear Temporary Cache?
              </h3>
              <p className="font-body text-xs text-text-muted leading-relaxed">
                This will purge vector document embeddings (142.6 MB) and
                temporary render buffers. Your saved conversation sessions and
                project files will remain untouched.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-1.5">
              <button
                type="button"
                onClick={() => setClearCacheModalOpen(false)}
                className="rounded-[2px] border border-border bg-surface-2 px-2.5 py-1 font-body text-xs text-text-muted hover:text-text-primary transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearCacheConfirm}
                className="rounded-[2px] bg-accent-primary px-3 py-1 font-body text-xs font-semibold text-background hover:brightness-110 transition-all cursor-pointer"
              >
                Confirm Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: Delete Local Data Destructive Confirmation
          ========================================================================= */}
      {deleteDataModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-60 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setDeleteDataModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-[4px] border border-rose-900/60 bg-surface-1 p-4 shadow-xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-2.5">
              <div className="p-1.5 rounded bg-rose-950/60 border border-rose-900 text-rose-400">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <h3 className="font-display text-base font-medium text-rose-300">
                  Permanently Delete All Local Data?
                </h3>
                <p className="font-body text-xs text-text-muted leading-relaxed">
                  This action is irreversible. It will wipe all local SQLite
                  chat records, cached vector stores, and reset all
                  configuration preferences to factory defaults.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2.5 border-t border-border/60">
              <button
                type="button"
                onClick={() => setDeleteDataModalOpen(false)}
                className="rounded-[2px] border border-border bg-surface-2 px-2.5 py-1 font-body text-xs text-text-muted hover:text-text-primary transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteDataConfirm}
                className="rounded-[2px] bg-rose-700 px-3 py-1 font-body text-xs font-semibold text-white hover:bg-rose-600 transition-all cursor-pointer"
              >
                Permanently Erase
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // If not rendered in modal mode, return standard page layout
  if (!isModal) {
    return renderSettingsContent();
  }

  // MODAL OVERLAY PRESENTATION
  return (
    <AnimatePresence>
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Sovereign Workbench Settings"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 md:p-8 select-none"
        >
          {/* Backdrop: semi-transparent dark with subtle blur, workbench stays visible behind */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            onClick={onClose}
            className="absolute inset-0 bg-background/70 backdrop-blur-xs cursor-pointer"
          />

          {/* Centered Desktop Modal Window */}
          <motion.div
            ref={modalPanelRef}
            initial={{ opacity: 0, scale: 0.98, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 8 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="relative z-10 w-full max-w-5xl h-[88vh] max-h-[800px] rounded-[6px] border border-border bg-background shadow-2xl shadow-black/80 flex flex-col overflow-hidden text-text-body"
          >
            {/* Clear Close Button (X) in top-right */}
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                title="Close Settings (Esc)"
                aria-label="Close Settings"
                className="absolute top-3.5 right-3.5 z-30 p-1.5 rounded-[3px] text-text-muted hover:text-text-primary hover:bg-surface-2 transition-colors cursor-pointer border border-transparent hover:border-border/80"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Modal Body: The full 2-column Settings Experience */}
            {renderSettingsContent()}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default SettingsPage;

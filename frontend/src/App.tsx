import { useEffect, useRef, useState } from "react";
import {
  getUser,
  login,
  logout,
  register,
  predict,
  getHistory,
  deleteHistoryItem,
  getHealthStatus,
  PredictionResult,
  User,
  HistoryItem,
} from "./services/api";

interface SelectedFile {
  file: File;
  previewUrl: string;
}

type QueueStatus = "queued" | "processing" | "done" | "failed";

interface QueueItem extends SelectedFile {
  id: string;
  status: QueueStatus;
  result?: PredictionResult;
  error?: string;
}

function formatLabel(raw: string): string {
  return raw?.replace(/___/g, " - ").replace(/_/g, " ") || "-";
}

function buildChatGptUrl(
  result: PredictionResult,
  fileName: string | undefined,
): string {
  const label = formatLabel(result?.label || "Unknown disease");
  const confidence = result?.confidence
    ? `${(result.confidence * 100).toFixed(1)}%`
    : "unknown";
  const recommendations =
    Array.isArray(result?.recommendations) && result.recommendations.length > 0
      ? result.recommendations
          .map((item, index) => `${index + 1}. ${item}`)
          .join("\n")
      : "No recommendations were provided by the app.";

  const details =
    Array.isArray(result?.details) && result.details.length > 0
      ? result.details
          .map(
            (item) =>
              `- ${formatLabel(item.label || "Unknown")}: ${(item.score * 100).toFixed(1)}%`,
          )
          .join("\n")
      : "- No extra detail available.";

  const prompt = `I used GreenGuard to analyze a plant leaf image${fileName ? ` (${fileName})` : ""}.

Prediction summary:
- Disease: ${label}
- Confidence: ${confidence}
- Model mode: ${result?.model_ready ? "ML model" : "demo fallback"}

Details:
${details}

Current recommendations from GreenGuard:
${recommendations}

Give me a practical, step-by-step treatment plan, likely causes, urgency level, and prevention tips for a farmer or gardener. Keep the answer clear and actionable.`;

  return `https://chatgpt.com/?q=${encodeURIComponent(prompt)}`;
}

function makeQueueId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function StatusPill({ status }: { status: QueueStatus }) {
  const map = {
    queued:
      "bg-[rgba(148,163,184,0.12)] text-slate-300 border-[rgba(148,163,184,0.35)]",
    processing:
      "bg-[rgba(251,191,36,0.12)] text-amber-300 border-[rgba(251,191,36,0.35)]",
    done: "bg-[rgba(72,220,130,0.12)] text-[#48dc82] border-[rgba(72,220,130,0.35)]",
    failed:
      "bg-[rgba(248,113,113,0.12)] text-[#f87171] border-[rgba(248,113,113,0.35)]",
  };

  return (
    <span
      className={`px-2 py-1 text-[10px] uppercase tracking-[0.12em] border rounded-full ${map[status]}`}>
      {status}
    </span>
  );
}

function QueueFlowCard({
  item,
  index,
  active,
  running,
  onRemove,
  onRetry,
  onOpenChatGpt,
}: {
  item: QueueItem;
  index: number;
  active: boolean;
  running: boolean;
  onRemove: (id: string) => void;
  onRetry: (item: QueueItem) => void;
  onOpenChatGpt: (item: QueueItem) => void;
}) {
  const confidencePct = item.result
    ? (item.result.confidence * 100).toFixed(1)
    : null;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border transition-all duration-250 ${
        active
          ? "border-[#48dc82] bg-[linear-gradient(145deg,rgba(72,220,130,0.14),rgba(11,21,18,0.9))] shadow-[0_12px_40px_rgba(72,220,130,0.18)]"
          : "border-[rgba(72,220,130,0.16)] bg-[#111916]"
      }`}>
      <div className="p-4 md:p-5">
        <div className="flex items-start gap-4">
          <div className="flex flex-col items-center mt-1">
            <div className="w-7 h-7 rounded-full bg-[#0c1310] border border-[rgba(72,220,130,0.35)] text-[11px] font-semibold flex items-center justify-center text-[#48dc82]">
              {index + 1}
            </div>
            <div className="w-px h-full mt-2 bg-[linear-gradient(180deg,rgba(72,220,130,0.42),transparent)]" />
          </div>

          <div className="flex-1">
            <div className="grid grid-cols-1 md:grid-cols-[112px_minmax(0,1fr)] gap-3">
              <img
                src={item.previewUrl}
                alt={item.file.name}
                className="w-full h-24 object-cover rounded-xl border border-[rgba(72,220,130,0.16)]"
              />

              <div className="rounded-xl border border-[rgba(72,220,130,0.12)] bg-[#0d1512] p-3">
                {item.result ? (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm text-[#8ea99a]">Prediction</p>
                      {confidencePct && (
                        <span className="text-base font-bold text-[#48dc82]">
                          {confidencePct}%
                        </span>
                      )}
                    </div>
                    <p className="font-semibold text-[#edf9f1] mt-0.5">
                      {formatLabel(item.result.label)}
                    </p>
                    <div className="mt-2 h-1.5 bg-[#1a2622] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#48dc82] to-[#2dd4bf] rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.max(5, parseFloat(confidencePct || "5"))}%`,
                        }}
                      />
                    </div>
                  </>
                ) : item.status === "failed" ? (
                  <p className="text-sm text-[#fca5a5]">
                    {item.error || "Prediction failed"}
                  </p>
                ) : (
                  <p className="text-sm text-[#8ea99a]">
                    {item.status === "processing"
                      ? "Analyzing this image now..."
                      : "Waiting in queue"}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 mt-3">
              <div>
                <h4 className="text-sm leading-none text-[#edf9f1] truncate w-fit">
                  {item.file.name}
                </h4>
                <p className="text-[11px] text-[#7e9a8a] mt-1">
                  {Math.max(1, Math.round(item.file.size / 1024))} KB
                </p>
              </div>
              <StatusPill status={item.status} />
            </div>

            {item.result &&
              Array.isArray(item.result.recommendations) &&
              item.result.recommendations.length > 0 && (
                <div className="mt-3 rounded-xl border border-[rgba(72,220,130,0.12)] bg-[#0d1512] p-3">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-[#8ea99a] mb-2">
                    Quick treatment
                  </p>
                  <ul className="space-y-1">
                    {item.result.recommendations.slice(0, 3).map((rec, idx) => (
                      <li key={idx} className="text-sm text-[#edf9f1]">
                        {idx + 1}. {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

            <div className="mt-3 flex flex-wrap gap-2">
              {item.result && (
                <button
                  type="button"
                  className="px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] rounded-md border border-[rgba(72,220,130,0.3)] text-[#48dc82] hover:bg-[rgba(72,220,130,0.12)] transition-colors"
                  onClick={() => onOpenChatGpt(item)}>
                  Open in ChatGPT
                </button>
              )}
              {item.status === "failed" && (
                <button
                  type="button"
                  className="px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] rounded-md border border-[rgba(251,191,36,0.35)] text-amber-300 hover:bg-[rgba(251,191,36,0.12)] transition-colors"
                  disabled={running}
                  onClick={() => onRetry(item)}>
                  Retry
                </button>
              )}
              <button
                type="button"
                className="px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] rounded-md border border-[rgba(248,113,113,0.3)] text-[#fca5a5] hover:bg-[rgba(248,113,113,0.12)] transition-colors disabled:opacity-40"
                disabled={running}
                onClick={() => onRemove(item.id)}>
                Remove
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function UploadDropzone({
  disabled,
  onFiles,
}: {
  disabled: boolean;
  onFiles: (files: File[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const addFromInput = (files: FileList | null) => {
    if (!files) return;
    const imageFiles = Array.from(files).filter((file) =>
      file.type.startsWith("image/"),
    );
    if (imageFiles.length > 0) {
      onFiles(imageFiles);
    }
  };

  return (
    <div
      className={`rounded-2xl border-2 border-dashed p-6 md:p-8 transition-all ${
        dragging
          ? "border-[#48dc82] bg-[rgba(72,220,130,0.08)]"
          : "border-[rgba(72,220,130,0.22)] bg-[rgba(10,15,13,0.7)] hover:border-[rgba(72,220,130,0.45)]"
      } ${disabled ? "opacity-70" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (!disabled) addFromInput(e.dataTransfer.files);
      }}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => addFromInput(e.target.files)}
        disabled={disabled}
      />

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <p className="text-2xl text-[#edf9f1]">Drop as many leaf images</p>
        </div>
        <button
          type="button"
          disabled={disabled}
          className="px-4 py-3 rounded-xl bg-[#48dc82] text-[#0a0f0d] text-xs font-bold uppercase tracking-[0.12em] hover:brightness-95 transition disabled:opacity-60"
          onClick={() => inputRef.current?.click()}>
          Add Images
        </button>
      </div>
    </div>
  );
}

function AuthForm({ onAuth, error }: { onAuth: () => void; error: string }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErr("");
    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await register(email, password, name);
      }
      onAuth();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-7 bg-[#111916] border border-[rgba(72,220,130,0.15)] rounded-xl">
      <h2 className="font-['Playfair_Display'] text-xl mb-1">
        {isLogin ? "Sign In" : "Create Account"}
      </h2>
      <p className="text-sm text-[#8ba896] mb-5">
        {isLogin
          ? "Sign in to save your diagnosis history"
          : "Register to save your predictions"}
      </p>

      <form onSubmit={handleSubmit} className="space-y-3">
        {!isLogin && (
          <input
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-3 bg-[#1a2622] border border-[rgba(72,220,130,0.15)] rounded-md text-[#e8f5ec] placeholder-[#4d665a]"
            required
          />
        )}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full p-3 bg-[#1a2622] border border-[rgba(72,220,130,0.15)] rounded-md text-[#e8f5ec] placeholder-[#4d665a]"
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-3 bg-[#1a2622] border border-[rgba(72,220,130,0.15)] rounded-md text-[#e8f5ec] placeholder-[#4d665a]"
          required
        />
        {(err || error) && (
          <p className="p-2 bg-[rgba(248,113,113,0.1)] rounded text-sm text-[#f87171]">
            {err || error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-[#48dc82] text-[#0a0f0d] rounded-md font-semibold uppercase tracking-wider text-sm hover:opacity-90 disabled:opacity-50">
          {loading ? "..." : isLogin ? "Sign In" : "Register"}
        </button>
      </form>

      <p className="text-center text-xs text-[#4d665a] mt-4">
        {isLogin ? "Don't have an account? " : "Already have an account? "}
        <button
          type="button"
          onClick={() => setIsLogin(!isLogin)}
          className="text-[#48dc82] underline">
          {isLogin ? "Register" : "Sign In"}
        </button>
      </p>
    </div>
  );
}

function HistoryItemComponent({
  item,
  onDelete,
}: {
  item: HistoryItem;
  onDelete: (id: number) => void;
}) {
  return (
    <div className="flex items-center gap-3 p-3 bg-[#1a2622] rounded-md border border-[rgba(72,220,130,0.12)]">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">
          {formatLabel(item.label)}
        </div>
        <div className="text-xs text-[#4d665a]">
          {new Date(item.created_at).toLocaleDateString()}
        </div>
      </div>
      <span className="text-sm font-semibold text-[#48dc82]">
        {(item.confidence * 100).toFixed(0)}%
      </span>
      <button
        type="button"
        className="w-6 h-6 bg-transparent border border-[rgba(72,220,130,0.15)] rounded text-[#4d665a] text-lg hover:border-[#f87171] hover:text-[#f87171]"
        onClick={() => onDelete(item.id)}>
        x
      </button>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(getUser());
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isBatchRunning, setIsBatchRunning] = useState(false);
  const [activeQueueId, setActiveQueueId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [backendStatus, setBackendStatus] = useState<
    "checking" | "online" | "offline"
  >("checking");
  const [view, setView] = useState<"upload" | "auth" | "history">("upload");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const previewsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let mounted = true;
    let interval: ReturnType<typeof setInterval>;

    const checkBackend = async () => {
      try {
        const data = await getHealthStatus();
        if (mounted)
          setBackendStatus(data.status === "ok" ? "online" : "offline");
      } catch {
        if (mounted) setBackendStatus("offline");
      }
    };

    checkBackend();
    interval = setInterval(checkBackend, 15000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    return () => {
      previewsRef.current.forEach((url) => URL.revokeObjectURL(url));
      previewsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (user && view === "history") {
      void loadHistory();
    }
  }, [user, view]);

  const revokePreview = (url: string) => {
    if (previewsRef.current.has(url)) {
      URL.revokeObjectURL(url);
      previewsRef.current.delete(url);
    }
  };

  const addFiles = (files: File[]) => {
    const next = files.map((file) => {
      const previewUrl = URL.createObjectURL(file);
      previewsRef.current.add(previewUrl);
      return {
        id: makeQueueId(),
        file,
        previewUrl,
        status: "queued" as QueueStatus,
      };
    });

    setQueue((prev) => [...prev, ...next]);
    setError("");
  };

  const removeQueueItem = (id: string) => {
    setQueue((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) revokePreview(target.previewUrl);
      return prev.filter((item) => item.id !== id);
    });
    if (activeQueueId === id) setActiveQueueId(null);
  };

  const clearQueue = () => {
    queue.forEach((item) => revokePreview(item.previewUrl));
    setQueue([]);
    setActiveQueueId(null);
    setError("");
  };

  const updateQueueItem = (id: string, updates: Partial<QueueItem>) => {
    setQueue((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item)),
    );
  };

  const runSinglePrediction = async (item: QueueItem) => {
    if (isBatchRunning) return;
    setError("");
    setActiveQueueId(item.id);
    updateQueueItem(item.id, { status: "processing", error: undefined });
    try {
      const [prediction] = await predict([item.file]);
      updateQueueItem(item.id, {
        status: "done",
        result: prediction,
        error: undefined,
      });
      if (user) {
        await loadHistory();
      }
    } catch (err) {
      updateQueueItem(item.id, {
        status: "failed",
        error: err instanceof Error ? err.message : "Prediction failed",
      });
    } finally {
      setActiveQueueId(null);
    }
  };

  const runBatchPredictions = async () => {
    const queueSnapshot = queue;
    if (queueSnapshot.length === 0) {
      setError("Add at least one image first");
      return;
    }

    setIsBatchRunning(true);
    setError("");

    for (const item of queueSnapshot) {
      setActiveQueueId(item.id);
      updateQueueItem(item.id, {
        status: "processing",
        error: undefined,
        result: undefined,
      });

      try {
        const [prediction] = await predict([item.file]);
        updateQueueItem(item.id, {
          status: "done",
          result: prediction,
          error: undefined,
        });
      } catch (err) {
        updateQueueItem(item.id, {
          status: "failed",
          error: err instanceof Error ? err.message : "Prediction failed",
        });
      }
    }

    setActiveQueueId(null);
    setIsBatchRunning(false);
    if (user) {
      await loadHistory();
    }
  };

  const loadHistory = async () => {
    try {
      const hist = await getHistory();
      setHistory(hist);
    } catch {
      console.error("Failed to load history");
    }
  };

  const handleDeleteHistory = async (id: number) => {
    await deleteHistoryItem(id);
    await loadHistory();
  };

  const handleOpenChatGpt = (item: QueueItem) => {
    if (!item.result) return;
    const chatGptUrl = buildChatGptUrl(item.result, item.file.name);
    window.open(chatGptUrl, "_blank", "noopener,noreferrer");
  };

  const handleLogout = () => {
    logout();
    setUser(null);
    setHistory([]);
    setView("upload");
  };

  const completed = queue.filter((item) => item.status === "done").length;
  const failed = queue.filter((item) => item.status === "failed").length;

  return (
    <main className="min-h-screen px-3 py-4 md:px-6 md:py-6">
      <div className="mx-auto max-w-[1280px] grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-4 md:gap-5">
        <aside className="h-fit lg:sticky lg:top-4 p-4 md:p-5 rounded-2xl border border-[rgba(72,220,130,0.18)] bg-[radial-gradient(circle_at_top,rgba(72,220,130,0.14),rgba(17,25,22,0.92)_45%)] shadow-[0_20px_40px_rgba(0,0,0,0.25)]">
          <div className="flex items-center gap-3 pb-4 border-b border-[rgba(72,220,130,0.16)]">
            <div className="w-8 h-8 border-3 border-[#48dc82] rounded-lg flex items-center justify-center relative overflow-hidden">
              <div className="w-2 h-2 bg-[#48dc82] rounded-full shadow-[0_0_12px_rgba(72,220,130,0.6)] animate-pulse" />
            </div>
            <div className="flex items-center justify-between w-full">
              <h1 className="text-2xl leading-none text-[#48dc82]">
                GreenGuard
              </h1>
              <div className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${
                    backendStatus === "online"
                      ? "bg-[#48dc82] shadow-[0_0_8px_rgba(72,220,130,0.6)]"
                      : backendStatus === "offline"
                        ? "bg-[#f87171] shadow-[0_0_8px_rgba(248,113,113,0.45)]"
                        : "bg-[#fbbf24]"
                  } ${backendStatus === "online" ? "animate-pulse" : ""}`}
                />
                <span className="text-xs uppercase tracking-[0.1em] text-[#edf9f1]">
                  {backendStatus}
                </span>
              </div>
            </div>
          </div>

          <nav className="mt-4 space-y-2">
            <button
              type="button"
              className={`w-full text-left px-3 py-2 rounded-lg text-xs uppercase tracking-[0.12em] transition ${
                view === "upload"
                  ? "bg-[rgba(72,220,130,0.14)] text-[#48dc82]"
                  : "text-[#8ba896] hover:text-[#edf9f1] hover:bg-[rgba(72,220,130,0.07)]"
              }`}
              onClick={() => setView("upload")}>
              Diagnose Flow
            </button>
            {user && (
              <button
                type="button"
                className={`w-full text-left px-3 py-2 rounded-lg text-xs uppercase tracking-[0.12em] transition ${
                  view === "history"
                    ? "bg-[rgba(72,220,130,0.14)] text-[#48dc82]"
                    : "text-[#8ba896] hover:text-[#edf9f1] hover:bg-[rgba(72,220,130,0.07)]"
                }`}
                onClick={() => setView("history")}>
                History
              </button>
            )}
            {!user && (
              <button
                type="button"
                className={`w-full text-left px-3 py-2 rounded-lg text-xs uppercase tracking-[0.12em] transition ${
                  view === "auth"
                    ? "bg-[rgba(72,220,130,0.14)] text-[#48dc82]"
                    : "text-[#8ba896] hover:text-[#edf9f1] hover:bg-[rgba(72,220,130,0.07)]"
                }`}
                onClick={() => setView("auth")}>
                Sign In
              </button>
            )}
          </nav>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="p-2 rounded-lg bg-[#0d1512] border border-[rgba(72,220,130,0.12)]">
              <p className="text-[10px] uppercase tracking-[0.12em] text-[#7e9a8a]">
                Queued
              </p>
              <p className="font-bold text-[#edf9f1] mt-1">{queue.length}</p>
            </div>
            <div className="p-2 rounded-lg bg-[#0d1512] border border-[rgba(72,220,130,0.12)]">
              <p className="text-[10px] uppercase tracking-[0.12em] text-[#7e9a8a]">
                Done
              </p>
              <p className="font-bold text-[#48dc82] mt-1">{completed}</p>
            </div>
            <div className="p-2 rounded-lg bg-[#0d1512] border border-[rgba(72,220,130,0.12)]">
              <p className="text-[10px] uppercase tracking-[0.12em] text-[#7e9a8a]">
                Failed
              </p>
              <p className="font-bold text-[#fca5a5] mt-1">{failed}</p>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-[rgba(72,220,130,0.16)]">
            {user ? (
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs text-[#8ba896]">Logged in as</p>
                  <p className="text-sm text-[#edf9f1]">{user.name}</p>
                </div>
                <button
                  type="button"
                  className="px-2 py-1 rounded-md border border-[rgba(72,220,130,0.25)] text-xs text-[#8ba896] hover:text-[#edf9f1]"
                  onClick={handleLogout}>
                  Logout
                </button>
              </div>
            ) : (
              <p className="text-xs text-[#8ba896]">
                Sign in to save every prediction in history.
              </p>
            )}
          </div>
        </aside>

        <section className="min-w-0 rounded-2xl border border-[rgba(72,220,130,0.16)] bg-[linear-gradient(180deg,rgba(17,25,22,0.92),rgba(10,15,13,0.96))] p-4 md:p-5 shadow-[0_20px_40px_rgba(0,0,0,0.25)]">
          {view === "auth" && !user && (
            <div className="max-w-md animate-fade-in">
              <AuthForm
                onAuth={() => {
                  setUser(getUser());
                  setView("upload");
                }}
                error={error}
              />
            </div>
          )}

          {view === "upload" && (
            <div className="space-y-4 animate-fade-in">
              <UploadDropzone disabled={isBatchRunning} onFiles={addFiles} />

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={runBatchPredictions}
                  disabled={isBatchRunning || queue.length === 0}
                  className="px-4 py-3 rounded-xl bg-[#48dc82] text-[#0a0f0d] text-xs font-bold uppercase tracking-[0.12em] hover:brightness-95 disabled:opacity-50">
                  {isBatchRunning
                    ? "Running Sequence..."
                    : "Predict All One by One"}
                </button>
                <button
                  type="button"
                  onClick={clearQueue}
                  disabled={isBatchRunning || queue.length === 0}
                  className="px-4 py-3 rounded-xl border border-[rgba(72,220,130,0.25)] text-xs font-semibold uppercase tracking-[0.1em] text-[#8ba896] hover:text-[#edf9f1] disabled:opacity-50">
                  Clear Queue
                </button>
              </div>

              {error && (
                <p className="p-3 bg-[rgba(248,113,113,0.1)] border border-[rgba(248,113,113,0.3)] rounded-md text-sm text-[#f87171]">
                  {error}
                </p>
              )}

              {queue.length === 0 ? (
                <div className="rounded-2xl border border-[rgba(72,220,130,0.14)] bg-[#0d1512] p-8 text-center">
                  <p className="text-[#8ba896]">
                    Your flow queue is empty. Add leaf images to begin.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {queue.map((item, index) => (
                    <QueueFlowCard
                      key={item.id}
                      item={item}
                      index={index}
                      active={activeQueueId === item.id}
                      running={isBatchRunning}
                      onRemove={removeQueueItem}
                      onRetry={(failedItem) => {
                        void runSinglePrediction(failedItem);
                      }}
                      onOpenChatGpt={handleOpenChatGpt}
                    />
                  ))}
                </div>
              )}

              {!user && (
                <section className="text-center py-4 text-[#8ba896] text-sm">
                  <button
                    onClick={() => setView("auth")}
                    className="text-[#48dc82] underline">
                    Sign in
                  </button>{" "}
                  to save your predictions
                </section>
              )}
            </div>
          )}

          {view === "history" && user && (
            <section className="p-5 bg-[#111916] border border-[rgba(72,220,130,0.15)] rounded-xl animate-fade-in">
              <h3 className="text-xs font-medium uppercase tracking-wider text-[#8ba896] mb-4">
                Prediction History
              </h3>
              {history.length === 0 ? (
                <p className="text-center py-8 text-[#4d665a] text-sm">
                  No predictions yet. Upload an image to get started.
                </p>
              ) : (
                <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
                  {history.map((item) => (
                    <HistoryItemComponent
                      key={item.id}
                      item={item}
                      onDelete={handleDeleteHistory}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          <footer className="pt-5 mt-5 border-t border-[rgba(72,220,130,0.15)] text-center text-xs text-[#4d665a]">
            GreenGuard · {new Date().getFullYear()} ·{" "}
            <a
              href="https://github.com/thetanav/greenguard"
              target="_blank"
              rel="noopener"
              className="text-[#48dc82] no-underline hover:underline">
              View on GitHub
            </a>
          </footer>
        </section>
      </div>
    </main>
  );
}

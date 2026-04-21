import { useEffect, useState, useRef } from "react";
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

function formatLabel(raw: string): string {
  return raw?.replace(/___/g, " — ").replace(/_/g, " ") || "-";
}

function buildChatGptUrl(result: PredictionResult, fileName: string | undefined): string {
  const label = formatLabel(result?.label || "Unknown disease");
  const confidence = result?.confidence
    ? `${(result.confidence * 100).toFixed(1)}%`
    : "unknown";
  const recommendations = Array.isArray(result?.recommendations) && result.recommendations.length > 0
    ? result.recommendations.map((item, index) => `${index + 1}. ${item}`).join("\n")
    : "No recommendations were provided by the app.";

  const prompt = `I used GreenGuard to analyze a plant leaf image${fileName ? ` (${fileName})` : ""}.

Prediction summary:
- Disease: ${label}
- Confidence: ${confidence}
- Model mode: ${result?.model_ready ? "ML model" : "demo fallback"}

Details:
${
  Array.isArray(result?.details) && result.details.length > 0
    ? result.details.map(
        (item) => `- ${formatLabel(item.label || "Unknown")}: ${(item.score * 100).toFixed(1)}%`
      ).join("\n")
    : "- No extra detail available."
}

Current recommendations from GreenGuard:
${recommendations}

Give me a practical, step-by-step treatment plan, likely causes, urgency level, and prevention tips for a farmer or gardener. Keep the answer clear and actionable.`;

  return `https://chatgpt.com/?q=${encodeURIComponent(prompt)}`;
}

function DiagnosisCard({
  result,
  expanded,
  onExpand,
  onOpenChatGpt,
  imageUrl,
}: {
  result: PredictionResult;
  expanded: boolean;
  onExpand: () => void;
  onOpenChatGpt: () => void;
  imageUrl?: string;
}) {
  const confidencePct = (result.confidence * 100).toFixed(1);

  return (
    <div
      className={`bg-[#111916] border ${expanded ? "border-[#48dc82]" : "border-[rgba(72,220,130,0.15)]"} rounded-lg overflow-hidden transition-all cursor-pointer`}
      onClick={onExpand}
    >
      <div className="p-4 flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-['Playfair_Display'] text-lg font-semibold text-[#e8f5ec]">
              {formatLabel(result.label)}
            </span>
            <span
              className={`px-2 py-0.5 rounded text-xs font-medium ${
                result.model_ready
                  ? "bg-[rgba(72,220,130,0.12)] text-[#48dc82]"
                  : "bg-[rgba(251,191,36,0.15)] text-[#fbbf24]"
              }`}
            >
              {result.model_ready ? "ML" : "Demo"}
            </span>
          </div>
        </div>
        <span className="text-xl font-bold text-[#48dc82]">{confidencePct}%</span>
      </div>

      <div className="mx-4 h-1.5 bg-[#1a2622] rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-[#48dc82] to-[#2dd4bf] rounded-full transition-all duration-500"
          style={{ width: `${Math.max(5, parseFloat(confidencePct))}%` }}
        />
      </div>

      {expanded && (
        <div className="p-4 border-t border-[rgba(72,220,130,0.15)]">
          {imageUrl && (
            <div className="mb-4">
              <img
                src={imageUrl}
                alt="Analyzed specimen"
                className="w-full max-h-48 object-cover rounded-md border border-[rgba(72,220,130,0.15)]"
              />
            </div>
          )}

          {Array.isArray(result.details) && result.details.length > 0 && (
            <div className="mb-4">
              <h4 className="text-xs font-medium uppercase tracking-wider text-[#8ba896] mb-2">
                All Predictions
              </h4>
              <ul className="space-y-1">
                {result.details.map((item) => (
                  <li
                    key={item.label}
                    className="flex justify-between text-sm text-[#8ba896]"
                  >
                    <span>{formatLabel(item.label)}</span>
                    <span>{(item.score * 100).toFixed(1)}%</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {Array.isArray(result.recommendations) && result.recommendations.length > 0 && (
            <div className="mb-4">
              <h4 className="text-xs font-medium uppercase tracking-wider text-[#8ba896] mb-2">
                Treatment Protocol
              </h4>
              <ul className="space-y-1">
                {result.recommendations.map((item, i) => (
                  <li key={i} className="text-sm text-[#8ba896] list-disc list-inside">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button
            type="button"
            className="w-full py-3 bg-gradient-to-r from-[rgba(72,220,130,0.14)] to-[rgba(45,212,191,0.12)] border border-[rgba(72,220,130,0.32)] rounded-md text-[#e8f5ec] text-sm font-bold uppercase tracking-wider transition-all hover:border-[rgba(72,220,130,0.6)]"
            onClick={(e) => {
              e.stopPropagation();
              onOpenChatGpt();
            }}
          >
            Open in ChatGPT
          </button>
        </div>
      )}
    </div>
  );
}

function FileUploadSlot({
  index,
  file,
  previewUrl,
  onRemove,
  onFileChange,
  dragOver,
  setDragOver,
}: {
  index: number;
  file: SelectedFile | null;
  onRemove: () => void;
  onFileChange: (file: File) => void;
  dragOver: boolean;
  setDragOver: (v: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile && droppedFile.type.startsWith("image/")) {
      onFileChange(droppedFile);
    }
  };

  return (
    <div className="flex flex-col items-center">
      <span className="text-xs uppercase tracking-wider text-[#8ba896] mb-2">
        Image {index + 1}
      </span>
      {!file ? (
        <div
          className={`w-full h-32 border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer transition-all ${
            dragOver
              ? "border-[#48dc82] bg-[rgba(72,220,130,0.05)]"
              : "border-[rgba(72,220,130,0.15)] bg-[#1a2622] hover:border-[rgba(72,220,130,0.4)]"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFileChange(f);
            }}
          />
          <div className="text-2xl text-[#4d665a] mb-1">+</div>
          <small className="text-xs text-[#4d665a]">Drop or click</small>
        </div>
      ) : (
        <div className="relative w-full">
          <img
            src={file.previewUrl}
            alt={`Upload ${index + 1}`}
            className="w-full h-32 object-cover rounded-lg border border-[rgba(72,220,130,0.15)]"
          />
          <button
            type="button"
            className="absolute top-2 right-2 w-6 h-6 bg-[#f87171] text-white rounded-full text-sm font-bold flex items-center justify-center"
            onClick={onRemove}
          >
            ×
          </button>
          <div className="mt-1 text-xs text-[#8ba896] truncate">{file.file.name}</div>
        </div>
      )}
    </div>
  );
}

function AuthForm({
  onAuth,
  error,
}: {
  onAuth: () => void;
  error: string;
}) {
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
      <h2 className="font-['Playfair_Display'] text-xl mb-1">{isLogin ? "Sign In" : "Create Account"}</h2>
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
          className="w-full py-3 bg-[#48dc82] text-[#0a0f0d] rounded-md font-semibold uppercase tracking-wider text-sm hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "..." : isLogin ? "Sign In" : "Register"}
        </button>
      </form>

      <p className="text-center text-xs text-[#4d665a] mt-4">
        {isLogin ? "Don't have an account? " : "Already have an account? "}
        <button
          type="button"
          onClick={() => setIsLogin(!isLogin)}
          className="text-[#48dc82] underline"
        >
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
    <div className="flex items-center gap-3 p-3 bg-[#1a2622] rounded-md">
      <div className="flex-1">
        <div className="text-sm font-medium">{formatLabel(item.label)}</div>
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
        onClick={() => onDelete(item.id)}
      >
        ×
      </button>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(getUser());
  const [selectedFiles, setSelectedFiles] = useState<(SelectedFile | null)[]>([null, null, null]);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<PredictionResult[]>([]);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [backendStatus, setBackendStatus] = useState<"checking" | "online" | "offline">("checking");
  const [view, setView] = useState<"upload" | "auth" | "history">("upload");
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    let mounted = true;
    let interval: ReturnType<typeof setInterval>;

    const checkBackend = async () => {
      try {
        const data = await getHealthStatus();
        if (mounted) setBackendStatus(data.status === "ok" ? "online" : "offline");
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
    selectedFiles.forEach((f) => {
      if (f) URL.revokeObjectURL(f.previewUrl);
    });
  }, []);

  useEffect(() => {
    if (user && view === "history") loadHistory();
  }, [user, view]);

  const handleFile = (index: number, file: File | null) => {
    const newFiles = [...selectedFiles];
    if (newFiles[index]) URL.revokeObjectURL(newFiles[index]!.previewUrl);
    newFiles[index] = file ? { file, previewUrl: URL.createObjectURL(file) } : null;
    setSelectedFiles(newFiles);
    setResults([]);
    setError("");
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const files = selectedFiles.filter((f): f is SelectedFile => f !== null);
    if (files.length === 0) {
      setError("Select at least one image first");
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      const preds = await predict(files.map((f) => f.file));
      setResults(preds);
      if (user) loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Prediction failed");
    } finally {
      setIsLoading(false);
    }
  };

  const loadHistory = async () => {
    try {
      const hist = await getHistory();
      setHistory(hist);
    } catch (e) {
      console.error("Failed to load history");
    }
  };

  const handleDelete = async (id: number) => {
    await deleteHistoryItem(id);
    loadHistory();
  };

  const handleOpenChatGpt = (resultIndex: number) => {
    const result = results[resultIndex];
    const file = selectedFiles[resultIndex];
    if (!result) return;
    const chatGptUrl = buildChatGptUrl(result, file?.file.name);
    window.open(chatGptUrl, "_blank", "noopener,noreferrer");
  };

  const handleLogout = () => {
    logout();
    setUser(null);
    setResults([]);
    setHistory([]);
    setView("upload");
  };

  return (
    <main className="max-w-[900px] mx-auto p-4 pb-12 flex flex-col gap-5">
      <header className="flex justify-between items-center pb-4 border-b border-[rgba(72,220,130,0.15)]">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 border-2 border-[#48dc82] rounded-lg flex items-center justify-center relative overflow-hidden">
            <div className="w-2 h-2 bg-[#48dc82] rounded-full shadow-[0_0_12px_rgba(72,220,130,0.6)] animate-pulse" />
          </div>
          <h1 className="font-['Playfair_Display'] text-xl font-bold tracking-tight">
            Green<span className="text-[#48dc82]">Guard</span>
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-[#8ba896]">{user.name}</span>
              <button
                type="button"
                className="w-8 h-8 bg-transparent border border-[rgba(72,220,130,0.15)] rounded-md text-[#8ba896] hover:border-[#48dc82] hover:text-[#48dc82]"
                onClick={handleLogout}
              >
                ⎋
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="px-4 py-2 bg-[#48dc82] text-[#0a0f0d] border-none rounded-md text-xs font-semibold uppercase tracking-wider cursor-pointer hover:-translate-y-0.5"
              onClick={() => setView("auth")}
            >
              Sign In
            </button>
          )}
          <div
            className={`w-2 h-2 rounded-full ${
              backendStatus === "online"
                ? "bg-[#48dc82] shadow-[0_0_8px_rgba(72,220,130,0.6)]"
                : backendStatus === "offline"
                ? "bg-[#f87171] shadow-[0_0_8px_rgba(248,113,113,0.5)]"
                : "bg-[#fbbf24] shadow-[0_0_8px_rgba(251,191,36,0.5)]"
            } ${backendStatus === "online" ? "animate-pulse" : ""}`}
          />
        </div>
      </header>

      {user && (
        <nav className="flex gap-1 p-1 bg-[#111916] rounded-lg">
          <button
            type="button"
            className={`flex-1 py-2 px-4 rounded-md text-xs font-medium uppercase tracking-wider transition-all ${
              view === "upload"
                ? "bg-[rgba(72,220,130,0.12)] text-[#48dc82]"
                : "text-[#8ba896] hover:text-[#e8f5ec]"
            }`}
            onClick={() => setView("upload")}
          >
            Diagnose
          </button>
          <button
            type="button"
            className={`flex-1 py-2 px-4 rounded-md text-xs font-medium uppercase tracking-wider transition-all ${
              view === "history"
                ? "bg-[rgba(72,220,130,0.12)] text-[#48dc82]"
                : "text-[#8ba896] hover:text-[#e8f5ec]"
            }`}
            onClick={() => setView("history")}
          >
            History
          </button>
        </nav>
      )}

      {view === "auth" && !user && (
        <section className="flex flex-col gap-4 animate-fade-in">
          <AuthForm onAuth={() => setView("upload")} error={error} />
        </section>
      )}

      {view === "upload" && (
        <section className="flex flex-col gap-4 animate-fade-in">
          <div className="p-5 bg-[#111916] border border-[rgba(72,220,130,0.15)] rounded-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xs font-medium uppercase tracking-wider text-[#8ba896]">
                Specimen Input
              </h3>
              <span className="flex items-center gap-1 px-2 py-1 bg-[rgba(72,220,130,0.12)] rounded text-xs text-[#48dc82]">
                ◆ Ready
              </span>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {[0, 1, 2].map((index) => (
                <FileUploadSlot
                  key={index}
                  index={index}
                  file={selectedFiles[index]}
                  onRemove={() => handleFile(index, null)}
                  onFileChange={(file) => handleFile(index, file)}
                  dragOver={dragOverIndex === index}
                  setDragOver={(v) => setDragOverIndex(v ? index : null)}
                />
              ))}
            </div>

            <div className="flex gap-3 mt-4">
              <button
                type="button"
                onClick={onSubmit}
                disabled={isLoading || selectedFiles.every((f) => f === null)}
                className="flex-1 py-3 bg-[#48dc82] text-[#0a0f0d] border-none rounded-md font-semibold uppercase tracking-wider text-sm transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? "Analyzing..." : "Run Diagnosis"}
              </button>
              <button
                type="button"
                onClick={() => selectedFiles.forEach((_, i) => handleFile(i, null))}
                disabled={isLoading || selectedFiles.every((f) => f === null)}
                className="py-3 px-5 bg-transparent text-[#8ba896] border border-[rgba(72,220,130,0.15)] rounded-md text-sm hover:border-[#8ba896] disabled:opacity-50"
              >
                Clear
              </button>
            </div>

            {error && (
              <p className="mt-3 p-3 bg-[rgba(248,113,113,0.1)] border border-[rgba(248,113,113,0.3)] rounded-md text-sm text-[#f87171]">
                {error}
              </p>
            )}
          </div>

          {results.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {results.map((result, index) => (
                <DiagnosisCard
                  key={index}
                  result={result}
                  expanded={expandedIndex === index}
                  onExpand={() => setExpandedIndex(expandedIndex === index ? null : index)}
                  onOpenChatGpt={() => handleOpenChatGpt(index)}
                  imageUrl={selectedFiles[index]?.previewUrl}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {view === "history" && user && (
        <section className="p-5 bg-[#111916] border border-[rgba(72,220,130,0.15)] rounded-xl">
          <h3 className="text-xs font-medium uppercase tracking-wider text-[#8ba896] mb-4">
            Prediction History
          </h3>
          {history.length === 0 ? (
            <p className="text-center py-8 text-[#4d665a] text-sm">
              No predictions yet. Upload an image to get started!
            </p>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {history.map((item) => (
              <HistoryItemComponent key={item.id} item={item} onDelete={handleDelete} />
            ))}
          </div>
          )}
        </section>
      )}

      {!user && view === "upload" && (
        <section className="text-center py-6 text-[#8ba896] text-sm">
          <button onClick={() => setView("auth")} className="text-[#48dc82] underline">
            Sign in
          </button>{" "}
          to save your predictions
        </section>
      )}

      <footer className="pt-4 border-t border-[rgba(72,220,130,0.15)] text-center text-xs text-[#4d665a]">
        GreenGuard v0.1 —{" "}
        <a
          href="https://github.com/thetanav/greenguard"
          target="_blank"
          rel="noopener"
          className="text-[#48dc82] no-underline hover:underline"
        >
          View on GitHub
        </a>
      </footer>
    </main>
  );
}
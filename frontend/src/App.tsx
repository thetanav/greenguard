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

function makeQueueId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function UploadDropzone({
  disabled,
  onFiles,
}: {
  disabled: boolean;
  onFiles: (files: File[]) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) onFiles(files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) onFiles(files);
  };

  return (
    <div
      onClick={() => fileInputRef.current?.click()}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={`brutal-dropzone ${
        isDragOver
          ? "border-black bg-[#ffe44d]"
          : "border-black hover:bg-[#f4f4f4]"
      } ${disabled ? "opacity-50 pointer-events-none" : ""}`}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />
      <svg
        className="w-10 h-10 mx-auto mb-3 text-black"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
      <p className="text-black text-sm font-bold uppercase tracking-[0.06em]">
        Drop images here or click to browse
      </p>
      <p className="text-xs text-black mt-1">JPG, PNG, WebP up to 10MB</p>
    </div>
  );
}

function StatusBadge({ status }: { status: QueueStatus }) {
  const styles = {
    queued: "bg-[#fff] text-black border border-black",
    processing: "bg-[#ffe44d] text-black border border-black",
    done: "bg-[#98ff5e] text-black border border-black",
    failed: "bg-[#ff7d66] text-black border border-black",
  };
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider ${styles[status]}`}>
      {status}
    </span>
  );
}

function QueueCard({
  item,
  index,
  active,
  onRemove,
  onRetry,
}: {
  item: QueueItem;
  index: number;
  active: boolean;
  onRemove: (id: string) => void;
  onRetry: (item: QueueItem) => void;
}) {
  return (
    <div
      className={`flex items-center justify-between p-3 border-2 border-black bg-white ${
        active ? "shadow-[6px_6px_0_0_#000]" : ""
      }`}>
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <img
          src={item.previewUrl}
          alt={item.file.name}
          className="w-14 h-14 object-cover border-2 border-black bg-[#efefef]"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-black font-bold">#{index + 1}</span>
            <StatusBadge status={item.status} />
          </div>
          <p className="text-black text-sm font-semibold truncate">
            {item.file.name}
          </p>
          {item.result && (
            <p className="text-xs text-black mt-1 uppercase tracking-[0.05em]">
              {formatLabel(item.result.label)} (
              {Math.round(item.result.confidence * 100)}%)
            </p>
          )}
          {item.error && (
            <p className="text-xs text-black mt-1 bg-[#ff7d66] inline-block px-2 py-0.5 border border-black">
              {item.error}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 ml-3">
        {item.status === "failed" && (
          <button
            onClick={() => onRetry(item)}
            className="brutal-btn px-3 py-1.5 text-xs bg-[#ffe44d]">
            Retry
          </button>
        )}
        <button
          onClick={() => onRemove(item.id)}
          className="brutal-btn px-3 py-1.5 text-xs bg-[#ff7d66]">
          Remove
        </button>
      </div>
    </div>
  );
}

function HistoryItemCard({
  item,
  onDelete,
}: {
  item: HistoryItem;
  onDelete: (id: number) => void;
}) {
  return (
    <div className="flex items-center justify-between p-3 bg-white border-2 border-black">
      <div className="flex-1 min-w-0">
        <p className="text-black text-sm font-semibold truncate">
          {item.image_name}
        </p>
        <p className="text-xs text-black">
          {formatLabel(item.label)} · {Math.round(item.confidence * 100)}% ·{" "}
          {new Date(item.created_at).toLocaleDateString()}
        </p>
      </div>
      <button
        onClick={() => onDelete(item.id)}
        className="ml-2 px-2 py-1 text-xs text-black border-2 border-black bg-[#ff7d66]">
        Delete
      </button>
    </div>
  );
}

function AuthForm({
  onAuth,
  error: propError,
}: {
  onAuth: () => void;
  error?: string;
}) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await register(email, password, name);
      }
      onAuth();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Auth failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-sm mx-auto space-y-4">
      <h2 className="text-xl font-black text-black uppercase tracking-[0.04em]">
        {isLogin ? "Welcome back" : "Create account"}
      </h2>
      <p className="text-sm text-black">
        {isLogin
          ? "Sign in to access your predictions"
          : "Sign up to save your predictions"}
      </p>

      {!isLogin && (
        <input
          type="text"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="input-field"
        />
      )}
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        className="input-field"
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        className="input-field"
      />

      {(error || propError) && (
        <p className="text-sm text-black border border-black bg-[#ff7d66] px-2 py-1 inline-block">
          {error || propError}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="brutal-btn w-full bg-[#ffe44d]">
        {loading ? "Loading..." : isLogin ? "Sign in" : "Create account"}
      </button>

      <p className="text-center text-sm text-black">
        {isLogin ? "Don't have an account? " : "Already have an account? "}
        <button
          type="button"
          onClick={() => setIsLogin(!isLogin)}
          className="font-bold underline">
          {isLogin ? "Sign up" : "Sign in"}
        </button>
      </p>
    </form>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(getUser());
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [backendStatus, setBackendStatus] = useState<
    "checking" | "online" | "offline"
  >("checking");
  const [view, setView] = useState<"upload" | "auth" | "history">("upload");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const previewsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const checkBackend = async () => {
      try {
        const data = await getHealthStatus();
        setBackendStatus(data.status === "ok" ? "online" : "offline");
      } catch {
        setBackendStatus("offline");
      }
    };
    checkBackend();
    const interval = setInterval(checkBackend, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    return () => {
      previewsRef.current.forEach((url) => URL.revokeObjectURL(url));
      previewsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (user && view === "history") loadHistory();
  }, [user, view]);

  const addFiles = (files: File[]) => {
    const items = files.map((file) => ({
      id: makeQueueId(),
      file,
      previewUrl: URL.createObjectURL(file),
      status: "queued" as QueueStatus,
    }));
    items.forEach((item) => previewsRef.current.add(item.previewUrl));
    setQueue((prev) => [...prev, ...items]);
    setError("");
  };

  const removeQueueItem = (id: string) => {
    const item = queue.find((i) => i.id === id);
    if (item) {
      URL.revokeObjectURL(item.previewUrl);
      previewsRef.current.delete(item.previewUrl);
    }
    setQueue((prev) => prev.filter((i) => i.id !== id));
    if (activeId === id) setActiveId(null);
  };

  const clearQueue = () => {
    queue.forEach((item) => {
      URL.revokeObjectURL(item.previewUrl);
      previewsRef.current.delete(item.previewUrl);
    });
    setQueue([]);
    setActiveId(null);
    setError("");
  };

  const updateQueueItem = (id: string, updates: Partial<QueueItem>) => {
    setQueue((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item)),
    );
  };

  const runPrediction = async (item: QueueItem) => {
    if (isRunning) return;
    setError("");
    setActiveId(item.id);
    updateQueueItem(item.id, { status: "processing", error: undefined });
    try {
      const [result] = await predict([item.file]);
      updateQueueItem(item.id, { status: "done", result });
      if (user) loadHistory();
    } catch (err) {
      updateQueueItem(item.id, {
        status: "failed",
        error: err instanceof Error ? err.message : "Failed",
      });
    } finally {
      setActiveId(null);
    }
  };

  const runAllPredictions = async () => {
    if (queue.length === 0) {
      setError("Add images first");
      return;
    }
    setIsRunning(true);
    setError("");
    for (const item of queue) {
      setActiveId(item.id);
      updateQueueItem(item.id, {
        status: "processing",
        result: undefined,
        error: undefined,
      });
      try {
        const [result] = await predict([item.file]);
        updateQueueItem(item.id, { status: "done", result });
      } catch (err) {
        updateQueueItem(item.id, {
          status: "failed",
          error: err instanceof Error ? err.message : "Failed",
        });
      }
    }
    setActiveId(null);
    setIsRunning(false);
    if (user) loadHistory();
  };

  const loadHistory = async () => {
    try {
      setHistory(await getHistory());
    } catch {
      console.error("Failed to load history");
    }
  };

  const handleDeleteHistory = async (id: number) => {
    await deleteHistoryItem(id);
    await loadHistory();
  };

  const handleLogout = () => {
    logout();
    setUser(null);
    setHistory([]);
    setView("upload");
  };

  const queued = queue.filter((i) => i.status === "queued").length;
  const done = queue.filter((i) => i.status === "done").length;
  const failed = queue.filter((i) => i.status === "failed").length;

  return (
    <main className="min-h-screen px-4 py-6 md:px-6 brutal-canvas">
      <div className="mx-auto max-w-5xl grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-5">
        {/* Sidebar */}
        <aside className="lg:sticky lg:top-4 h-fit p-5 brutal-panel">
          <div className="flex items-center gap-3 pb-4 border-b-2 border-black">
            <img
              src="https://emojicdn.elk.sh/🌱"
              defaultValue={"🌱"}
              className="w-8 h-8"
            />
            <div>
              <h1 className="text-lg font-black text-black uppercase tracking-[0.06em]">
                GreenGuard
              </h1>
              <div className="flex items-center gap-2">
                <div
                  className={`w-2.5 h-2.5 border border-black ${backendStatus === "online" ? "bg-[#98ff5e]" : backendStatus === "offline" ? "bg-[#ff7d66]" : "bg-[#ffe44d]"}`}
                />
                <span className="text-xs text-black uppercase tracking-wider font-semibold">
                  {backendStatus}
                </span>
              </div>
            </div>
          </div>

          <nav className="mt-4 space-y-1">
            <button
              onClick={() => setView("upload")}
              className={`w-full text-left px-3 py-2 text-sm transition border-2 border-black font-bold uppercase ${view === "upload" ? "bg-[#ffe44d] text-black" : "bg-white text-black"}`}>
              Diagnose
            </button>
            {user && (
              <button
                onClick={() => setView("history")}
                className={`w-full text-left px-3 py-2 text-sm transition border-2 border-black font-bold uppercase ${view === "history" ? "bg-[#ffe44d] text-black" : "bg-white text-black"}`}>
                History
              </button>
            )}
            {!user && (
              <button
                onClick={() => setView("auth")}
                className={`w-full text-left px-3 py-2 text-sm transition border-2 border-black font-bold uppercase ${view === "auth" ? "bg-[#ffe44d] text-black" : "bg-white text-black"}`}>
                Sign In
              </button>
            )}
          </nav>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="p-2 border-2 border-black text-center bg-white">
              <p className="text-xs text-black font-bold">{queued}</p>
              <p className="text-[10px] uppercase text-black">Queued</p>
            </div>
            <div className="p-2 border-2 border-black text-center bg-[#98ff5e]">
              <p className="text-xs text-black font-bold">{done}</p>
              <p className="text-[10px] uppercase text-black">Done</p>
            </div>
            <div className="p-2 border-2 border-black text-center bg-[#ff7d66]">
              <p className="text-xs text-black font-bold">{failed}</p>
              <p className="text-[10px] uppercase text-black">Failed</p>
            </div>
          </div>

          <div className="mt-4 pt-4">
            {user ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-black">Signed in as</p>
                  <p className="text-sm text-black font-semibold">
                    {user.name}
                  </p>
                </div>
                <button
                  onClick={handleLogout}
                  className="brutal-btn px-3 py-1.5 text-xs bg-white">
                  Logout
                </button>
              </div>
            ) : (
              <p className="text-xs text-black">Sign in to save predictions</p>
            )}
          </div>
        </aside>

        {/* Main Content */}
        <section className="min-w-0 border-2 border-black bg-white p-5 shadow-[8px_8px_0_0_#000]">
          {view === "auth" && !user && (
            <div className="animate-fade-in">
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
              <UploadDropzone disabled={isRunning} onFiles={addFiles} />

              <div className="flex gap-2">
                <button
                  onClick={runAllPredictions}
                  disabled={isRunning || queue.length === 0}
                  className="brutal-btn bg-[#ffe44d]">
                  {isRunning
                    ? "Diagnosing..."
                    : `Diagnose All One By One (${queue.length})`}
                </button>
                <button
                  onClick={clearQueue}
                  disabled={isRunning || queue.length === 0}
                  className="brutal-btn bg-white">
                  Clear Queue
                </button>
              </div>

              {error && (
                <p className="text-sm text-black bg-[#ff7d66] border border-black px-3 py-2 inline-block">
                  {error}
                </p>
              )}

              {queue.length === 0 ? (
                <div className="py-12 text-center text-black border-2 border-dashed border-black bg-[#f4f4f4]">
                  No images added. Upload leaf images to diagnose.
                </div>
              ) : (
                <div className="space-y-2">
                  {queue.map((item, index) => (
                    <QueueCard
                      key={item.id}
                      item={item}
                      index={index}
                      active={activeId === item.id}
                      onRemove={removeQueueItem}
                      onRetry={runPrediction}
                    />
                  ))}
                </div>
              )}

              {!user && (
                <p className="text-center text-sm text-black">
                  <button
                    onClick={() => setView("auth")}
                    className="font-bold underline">
                    Sign in
                  </button>{" "}
                  to save predictions
                </p>
              )}
            </div>
          )}

          {view === "history" && user && (
            <div className="animate-fade-in">
              <h2 className="text-sm font-bold text-black uppercase tracking-wider mb-4">
                Prediction History
              </h2>
              {history.length === 0 ? (
                <p className="py-8 text-center text-black">
                  No predictions yet
                </p>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                  {history.map((item) => (
                    <HistoryItemCard
                      key={item.id}
                      item={item}
                      onDelete={handleDeleteHistory}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          <footer className="mt-6 text-center text-xs text-black">
            GreenGuard © {new Date().getFullYear()}
          </footer>
        </section>
      </div>
    </main>
  );
}

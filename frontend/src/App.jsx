import { useEffect, useMemo, useState } from "react";
import { getHealthStatus, predictPlantDisease } from "./services/api";

function PredictionCard({ result }) {
  if (!result) return null;

  const formatLabel = (raw) =>
    raw?.replace(/___/g, " — ").replace(/_/g, " ") || "-";

  const confidencePct = (result.confidence * 100).toFixed(1);

  return (
    <section className="result-section">
      <div className="diagnosis-header">
        <div>
          <h2 className="diagnosis-title">Diagnosis Complete</h2>
          <p className="diagnosis-label">{formatLabel(result.label)}</p>
        </div>
        <span className={`model-badge ${result.model_ready ? "" : "demo"}`}>
          {result.model_ready ? "ML Model" : "Fallback"}
        </span>
      </div>

      <div className="confidence-section">
        <div className="confidence-header">
          <span>Confidence</span>
          <span className="confidence-value">{confidencePct}%</span>
        </div>
        <div className="confidence-bar">
          <div
            className="confidence-fill"
            style={{ width: `${Math.max(5, confidencePct)}%` }}
          />
        </div>
      </div>

      {Array.isArray(result.details) && result.details.length > 0 && (
        <ul className="predictions-list">
          {result.details.map((item, idx) => (
            <li
              key={item.label}
              className={`prediction-item ${idx === 0 ? "top" : ""}`}
            >
              <span className="prediction-label">
                {formatLabel(item.label)}
              </span>
              <span className="prediction-score">
                {(item.score * 100).toFixed(1)}%
              </span>
            </li>
          ))}
        </ul>
      )}

      {Array.isArray(result.recommendations) &&
        result.recommendations.length > 0 && (
          <div className="recommendations-box">
            <h3 className="recommendations-title">Treatment Protocol</h3>
            <ul className="recommendations-list">
              {result.recommendations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        )}
    </section>
  );
}

function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [backendStatus, setBackendStatus] = useState("checking");

  useEffect(() => {
    let mounted = true;
    let interval;

    const checkBackend = async () => {
      try {
        const data = await getHealthStatus();
        if (mounted) {
          setBackendStatus(data.status === "ok" ? "online" : "offline");
        }
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
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFile = (file) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(file || null);
    setPreviewUrl(file ? URL.createObjectURL(file) : "");
    setResult(null);
    setError("");
  };

  const onFileChange = (e) => {
    handleFile(e.target.files?.[0] || null);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      handleFile(file);
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setError("Select an image file to analyze");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const prediction = await predictPlantDisease(selectedFile);
      setResult(prediction);
    } catch (err) {
      setError(err.message || "Analysis failed");
      setResult(null);
    } finally {
      setIsLoading(false);
    }
  };

  const clearFile = () => {
    handleFile(null);
  };

  const fileSize = selectedFile
    ? selectedFile.size > 1024 * 1024
      ? `${(selectedFile.size / (1024 * 1024)).toFixed(1)} MB`
      : `${(selectedFile.size / 1024).toFixed(1)} KB`
    : "";

  return (
    <main className="page">
      <header className="header">
        <div className="brand">
          <div className="logo-mark" />
          <h1 className="logo-text">
            Green<span>Guard</span>
          </h1>
        </div>
        <div className="status-indicator">
          <span className={`status-dot ${backendStatus}`} />
          <span>{backendStatus}</span>
        </div>
      </header>

      <section className="hero">
        <span className="hero-label">
          <span>◈</span> Plant Pathology AI
        </span>
        <h2 className="hero-title">
          Detect crop diseases<br />from leaf imagery
        </h2>
        <p className="hero-desc">
          Upload a leaf image for instant disease classification using trained
          machine learning models with treatment recommendations.
        </p>
      </section>

      <section className="main-panel">
        <div className="upload-section">
          <div className="section-header">
            <h3 className="section-title">Specimen Input</h3>
            <span className="scan-badge">◆ Ready</span>
          </div>

          {!selectedFile ? (
            <label
              className={`upload-zone ${isDragging ? "dragging" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
            >
              <input
                type="file"
                accept="image/*"
                onChange={onFileChange}
              />
              <div className="upload-content">
                <div className="upload-icon">↑</div>
                <span className="upload-text">Drop leaf image or click to browse</span>
                <span className="upload-hint">PNG, JPG up to 8MB</span>
              </div>
            </label>
          ) : (
            <>
              <div className="preview-container">
                <img
                  src={previewUrl}
                  alt="Specimen"
                  className="preview-image"
                />
                <div className="preview-info">
                  <p className="file-name">{selectedFile.name}</p>
                  <p className="file-meta">{fileSize}</p>
                </div>
              </div>

              <div className="btn-group">
                <button
                  type="button"
                  className={`btn btn-primary ${isLoading ? "btn-loading" : ""}`}
                  onClick={onSubmit}
                  disabled={isLoading || backendStatus !== "online"}
                >
                  {isLoading ? "Analyzing" : "Run Diagnosis"}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={clearFile}
                  disabled={isLoading}
                >
                  Clear
                </button>
              </div>
            </>
          )}

          {error && <p className="error-message">{error}</p>}
        </div>

        <PredictionCard result={result} />
      </section>

      <footer className="footer">
        GreenGuard v0.1 —{" "}
        <a href="https://github.com" target="_blank" rel="noopener">
          View on GitHub
        </a>
      </footer>
    </main>
  );
}

export default App;
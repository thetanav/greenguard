import { useEffect, useMemo, useState } from "react";
import PredictionCard from "./components/PredictionCard";
import { getHealthStatus, predictPlantDisease } from "./services/api";

function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [backendStatus, setBackendStatus] = useState("checking");

  const previewUrl = useMemo(() => {
    if (!selectedFile) return "";
    return URL.createObjectURL(selectedFile);
  }, [selectedFile]);

  useEffect(() => {
    let isMounted = true;

    const checkHealth = async () => {
      try {
        const data = await getHealthStatus();
        if (!isMounted) {
          return;
        }

        setBackendStatus(data.status === "ok" ? "online" : "offline");
      } catch (_err) {
        if (isMounted) {
          setBackendStatus("offline");
        }
      }
    };

    checkHealth();
    const intervalId = window.setInterval(checkHealth, 15000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(
    () => () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    },
    [previewUrl],
  );

  const setFile = (file) => {
    setSelectedFile(file || null);
    setResult(null);
    setError("");
  };

  const onFileChange = (event) => {
    const file = event.target.files?.[0];
    setFile(file || null);
  };

  const onDrop = (event) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      setFile(file);
    }
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!selectedFile) {
      setError("Please choose an image first.");
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      const prediction = await predictPlantDisease(selectedFile);
      setResult(prediction);
    } catch (err) {
      setError(err.message || "Something went wrong while predicting.");
      setResult(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="page">
      <div className="bg-orb bg-orb-1" />
      <div className="bg-orb bg-orb-2" />

      <section className="hero">
        <p className="eyebrow">AI Crop Intelligence</p>
        <h1>GreenGuard Disease Classifier</h1>
        <p className="subtitle">
          Detect major potato leaf diseases from an uploaded image and receive
          actionable recommendations for field intervention.
        </p>
        <p className={`status-pill status-${backendStatus}`}>
          API Status: {backendStatus}
        </p>
      </section>

      <section className="panel">
        <form className="upload-form" onSubmit={onSubmit}>
          <label
            className={`file-picker ${isDragging ? "dragging" : ""}`}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}>
            <span>Choose Leaf Image</span>
            <small>Drag and drop image here or click to browse</small>
            <input type="file" accept="image/*" onChange={onFileChange} />
          </label>

          <button
            type="submit"
            disabled={isLoading || backendStatus !== "online"}>
            {isLoading ? "Analyzing..." : "Predict Disease"}
          </button>

          <button
            type="button"
            className="ghost-btn"
            onClick={() => setFile(null)}
            disabled={!selectedFile || isLoading}>
            Clear
          </button>
        </form>

        {selectedFile && (
          <div className="preview-wrap">
            <img
              src={previewUrl}
              alt="Selected leaf"
              className="preview-image"
            />
            <p className="file-name">{selectedFile.name}</p>
          </div>
        )}

        {error && <p className="error-msg">{error}</p>}

        <PredictionCard result={result} />
      </section>
    </main>
  );
}

export default App;

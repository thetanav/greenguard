import { useMemo, useState } from "react";
import PredictionCard from "./components/PredictionCard";
import { predictPlantDisease } from "./services/api";

function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const previewUrl = useMemo(() => {
    if (!selectedFile) return "";
    return URL.createObjectURL(selectedFile);
  }, [selectedFile]);

  const onFileChange = (event) => {
    const file = event.target.files?.[0];
    setSelectedFile(file || null);
    setResult(null);
    setError("");
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
        <p className="eyebrow">Crop Intelligence</p>
        <h1>GreenGuard Disease Classifier</h1>
        <p className="subtitle">
          Upload a crop leaf image and get a disease prediction from your
          FastAPI backend.
        </p>
      </section>

      <section className="panel">
        <form className="upload-form" onSubmit={onSubmit}>
          <label className="file-picker">
            <span>Choose Leaf Image</span>
            <input type="file" accept="image/*" onChange={onFileChange} />
          </label>

          <button type="submit" disabled={isLoading}>
            {isLoading ? "Analyzing..." : "Predict Disease"}
          </button>
        </form>

        {selectedFile && (
          <div className="preview-wrap">
            <img
              src={previewUrl}
              alt="Selected leaf"
              className="preview-image"
            />
            <p>{selectedFile.name}</p>
          </div>
        )}

        {error && <p className="error-msg">{error}</p>}

        <PredictionCard result={result} />
      </section>
    </main>
  );
}

export default App;

function PredictionCard({ result }) {
  if (!result) return null;

  const formatLabel = (raw) =>
    raw?.replace(/___/g, " - ").replace(/_/g, " ") || "-";

  return (
    <section className="result-card">
      <h2>Diagnosis Result</h2>
      <p className="result-label">{formatLabel(result.label)}</p>
      <p className="result-confidence">
        Confidence: {(result.confidence * 100).toFixed(1)}%
      </p>
      <div className="confidence-track" aria-hidden="true">
        <div
          className="confidence-fill"
          style={{
            width: `${Math.max(2, Math.round(result.confidence * 100))}%`,
          }}
        />
      </div>

      <p className="model-state">
        Mode:{" "}
        {result.model_ready
          ? "Trained model inference"
          : "Demo fallback inference"}
      </p>

      {Array.isArray(result.details) && result.details.length > 0 && (
        <ul className="result-list">
          {result.details.map((item) => (
            <li key={item.label}>
              <span>{formatLabel(item.label)}</span>
              <span>{(item.score * 100).toFixed(1)}%</span>
            </li>
          ))}
        </ul>
      )}

      {Array.isArray(result.recommendations) &&
        result.recommendations.length > 0 && (
          <div className="recommendation-box">
            <h3>Recommended Actions</h3>
            <ul>
              {result.recommendations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        )}
    </section>
  );
}

export default PredictionCard;

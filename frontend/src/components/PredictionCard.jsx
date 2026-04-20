function PredictionCard({ result }) {
  if (!result) return null;

  return (
    <section className="result-card">
      <h2>Prediction Result</h2>
      <p className="result-label">{result.label}</p>
      <p className="result-confidence">
        Confidence: {(result.confidence * 100).toFixed(1)}%
      </p>
      {Array.isArray(result.details) && result.details.length > 0 && (
        <ul className="result-list">
          {result.details.map((item) => (
            <li key={item.label}>
              <span>{item.label}</span>
              <span>{(item.score * 100).toFixed(1)}%</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default PredictionCard;

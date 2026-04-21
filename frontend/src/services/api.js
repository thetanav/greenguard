export async function predictPlantDisease(file) {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/predict", {
        method: "POST",
        body: formData,
    });

    if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload.detail || "Prediction failed");
    }

    return response.json();
}

export async function getHealthStatus() {
    const response = await fetch("/health");
    if (!response.ok) {
        throw new Error("Backend unavailable");
    }
    return response.json();
}

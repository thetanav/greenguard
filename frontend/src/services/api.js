export async function predictPlantDisease(file) {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/v1/predict", {
        method: "POST",
        body: formData,
    });

    if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload.detail || "Prediction failed");
    }

    return response.json();
}

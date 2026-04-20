from __future__ import annotations

from hashlib import sha1


class ModelService:
    """Simple deterministic placeholder model service.

    Replace this with your real model loading and inference logic from the notebook.
    """

    labels = [
        "Tomato___Late_blight",
        "Tomato___Leaf_Mold",
        "Tomato___healthy",
        "Potato___Early_blight",
        "Potato___healthy",
    ]

    def predict(self, file_bytes: bytes) -> dict:
        if not file_bytes:
            return {
                "label": "Unknown",
                "confidence": 0.0,
                "details": [],
            }

        digest = sha1(file_bytes).hexdigest()
        idx = int(digest[:2], 16) % len(self.labels)
        base_confidence = 0.65 + ((int(digest[2:4], 16) % 30) / 100)

        # Produce a stable top-3 distribution for demo purposes.
        details = []
        for i in range(3):
            label_idx = (idx + i) % len(self.labels)
            score = max(0.01, round(base_confidence - i * 0.12, 3))
            details.append({"label": self.labels[label_idx], "score": score})

        return {
            "label": details[0]["label"],
            "confidence": details[0]["score"],
            "details": details,
        }


model_service = ModelService()

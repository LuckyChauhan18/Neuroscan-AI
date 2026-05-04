"""
Application-specific exception hierarchy for NeuroScan AI.

All custom exceptions inherit from NeuroScanError.
Use these instead of bare Exception so exception handlers can
distinguish application errors from unexpected failures.
"""


class NeuroScanError(Exception):
    """Base exception for all NeuroScan AI application errors."""

    def __init__(self, message: str, code: str = "internal_error"):
        super().__init__(message)
        self.message = message
        self.code = code

    def __repr__(self) -> str:
        return f"{self.__class__.__name__}(code={self.code!r}, message={self.message!r})"


class StorageError(NeuroScanError):
    """Raised when R2 / object-storage operations fail."""

    def __init__(self, message: str):
        super().__init__(message, code="storage_error")


class ModelInferenceError(NeuroScanError):
    """Raised when an ML model fails to load or produce a prediction."""

    def __init__(self, message: str):
        super().__init__(message, code="model_inference_error")


class ExternalAPIError(NeuroScanError):
    """Raised when an external API call (Gemini, OpenRouter) fails."""

    def __init__(self, message: str, service: str = ""):
        super().__init__(message, code="external_api_error")
        self.service = service


class ValidationError(NeuroScanError):
    """Raised for domain-level validation failures not covered by Pydantic."""

    def __init__(self, message: str):
        super().__init__(message, code="validation_error")

"""Receipt OCR via Claude vision.

Sends a receipt photo to Claude and returns structured line items. Kept on the
backend so the Anthropic API key never reaches the browser (same pattern as
splitwise_client). The feature is optional: with no ANTHROPIC_API_KEY set, the
app runs exactly as before and the scan UI stays hidden.
"""

import base64
import io
import os
from typing import Optional

# Sonnet 4.6 — a good balance of accuracy and cost for receipt extraction.
MODEL = "claude-sonnet-4-6"
MAX_EDGE = 1600  # px; receipts don't need more, and it keeps tokens/cost down.

_SYSTEM = (
    "You read photos of itemized receipts and extract the ordered line items. "
    "Return each distinct purchased item with its individual price. Do NOT include "
    "subtotal, tax, tip/gratuity, service charge, or total lines as items — capture "
    "tax and tip separately. If a line shows a quantity (e.g. '2 Coffee 6.00'), use "
    "the line's total price. Prices are plain numbers with no currency symbol. If "
    "part of the receipt is unreadable, make your best guess from context."
)


class ScanError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.message = message
        self.status = status


def configured() -> bool:
    """Whether receipt scanning is available (an Anthropic key is set)."""
    return bool(os.environ.get("ANTHROPIC_API_KEY"))


def _resize_to_jpeg(image_bytes: bytes) -> str:
    """Clamp the long edge and re-encode as JPEG, returning base64. Falls back to
    the original bytes (base64) if Pillow isn't available or can't decode them —
    the client already sends a downsized JPEG, so this is a server-side safety net."""
    try:
        from PIL import Image

        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        img.thumbnail((MAX_EDGE, MAX_EDGE))
        out = io.BytesIO()
        img.save(out, format="JPEG", quality=85)
        return base64.standard_b64encode(out.getvalue()).decode()
    except Exception:
        return base64.standard_b64encode(image_bytes).decode()


def extract_receipt(image_bytes: bytes) -> dict:
    """Extract line items (and tax/tip if present) from a receipt image.

    Returns {items: [{name, cost}], tax, tip, total, currency}. Raises ScanError
    on a missing key or an upstream failure.
    """
    if not configured():
        raise ScanError("Receipt scanning is not configured", status=400)

    import anthropic
    from pydantic import BaseModel, Field

    class ReceiptItem(BaseModel):
        name: str = Field(description="The item name as printed on the receipt")
        cost: float = Field(description="The item's total price as a number")

    class Receipt(BaseModel):
        items: list[ReceiptItem]
        tax: Optional[float] = Field(default=None, description="Tax amount, if shown")
        tip: Optional[float] = Field(default=None, description="Tip/gratuity, if shown")
        total: Optional[float] = Field(default=None, description="Grand total, if shown")
        currency: Optional[str] = Field(default=None, description="Currency symbol or code, if discernible")

    data_b64 = _resize_to_jpeg(image_bytes)
    client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY from the environment

    try:
        resp = client.messages.parse(
            model=MODEL,
            max_tokens=2000,
            system=_SYSTEM,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": "image/jpeg",
                                "data": data_b64,
                            },
                        },
                        {"type": "text", "text": "Extract the line items, plus tax and tip if present."},
                    ],
                }
            ],
            output_format=Receipt,
        )
    except anthropic.APIConnectionError:
        raise ScanError("Could not reach the vision service", status=502)
    except anthropic.APIStatusError as e:
        raise ScanError("The vision model could not process this image", status=502 if e.status_code >= 500 else 400)

    receipt = resp.parsed_output
    if receipt is None:
        raise ScanError("Could not read any items from this image", status=422)
    return receipt.model_dump()

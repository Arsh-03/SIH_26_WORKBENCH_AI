import os
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional

logger = logging.getLogger("ocr_processor")

class OCRProcessor:
    """
    PaddleOCR Engine wrapper providing 2D spatial bounding boxes [ymin, xmin, ymax, xmax]
    and offline model initialization capability.
    """
    def __init__(self, model_dir: Optional[str] = None, use_gpu: bool = False):
        self.model_dir = Path(model_dir) if model_dir else None
        self.use_gpu = use_gpu
        self.ocr_engine = None

    def initialize(self):
        """Lazy initialization of PaddleOCR instance with offline path checks."""
        if self.ocr_engine is not None:
            return

        try:
            from paddleocr import PaddleOCR
        except ImportError as e:
            raise ImportError(
                f"PaddleOCR is not installed in current Python environment: {e}"
            )

        kwargs: Dict[str, Any] = {
            "use_gpu": self.use_gpu,
            "show_log": False,
            "use_angle_cls": True,
            "lang": "en"
        }

        if self.model_dir and self.model_dir.exists():
            det_dir = self.model_dir / "ch_PP-OCRv4_det"
            rec_dir = self.model_dir / "ch_PP-OCRv4_rec"
            cls_dir = self.model_dir / "ch_ppocr_mobile_v2.0_cls"

            if det_dir.exists():
                kwargs["det_model_dir"] = str(det_dir)
            if rec_dir.exists():
                kwargs["rec_model_dir"] = str(rec_dir)
            if cls_dir.exists():
                kwargs["cls_model_dir"] = str(cls_dir)

        self.ocr_engine = PaddleOCR(**kwargs)

    def process_image(
        self,
        image_path: str,
        confidence_threshold: float = 0.50
    ) -> List[Dict[str, Any]]:
        """
        Run OCR on an image file and convert bounding polygons into [ymin, xmin, ymax, xmax].
        """
        self.initialize()
        results = self.ocr_engine.ocr(image_path, cls=True)

        text_blocks: List[Dict[str, Any]] = []
        if not results or not results[0]:
            return text_blocks

        for idx, line in enumerate(results[0]):
            box, (text, conf) = line
            if conf < confidence_threshold:
                continue

            # Polygon box is [[x1, y1], [x2, y2], [x3, y3], [x4, y4]]
            xs = [pt[0] for pt in box]
            ys = [pt[1] for pt in box]

            ymin = int(round(min(ys)))
            xmin = int(round(min(xs)))
            ymax = int(round(max(ys)))
            xmax = int(round(max(xs)))

            text_blocks.append({
                "block_id": f"blk_{idx+1:03d}",
                "text": text.strip(),
                "confidence": round(float(conf), 4),
                "bounding_box_2d": [ymin, xmin, ymax, xmax]
            })

        return text_blocks

import os
import tempfile
import logging
from typing import Optional

logger = logging.getLogger("transcription_service")

class TranscriptionService:
    _instance: Optional["TranscriptionService"] = None
    _model = None

    @classmethod
    def get_instance(cls) -> "TranscriptionService":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def _get_model(self):
        if self._model is None:
            try:
                from faster_whisper import WhisperModel
                logger.info("Initializing faster-whisper model (tiny.en on cpu)...")
                # Using tiny.en with int8 quantization for ultra-fast local CPU inference (<150ms)
                self._model = WhisperModel("tiny.en", device="cpu", compute_type="int8")
                logger.info("faster-whisper model loaded successfully.")
            except Exception as e:
                logger.error(f"Failed to load faster-whisper model: {e}")
                raise e
        return self._model

    def transcribe_audio_bytes(self, audio_bytes: bytes, suffix: str = ".webm") -> str:
        """
        Transcribe audio bytes to text using faster-whisper.
        """
        model = self._get_model()
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp_file:
            tmp_path = tmp_file.name
            tmp_file.write(audio_bytes)

        try:
            segments, info = model.transcribe(tmp_path, beam_size=1, language="en")
            transcribed_text = " ".join([segment.text.strip() for segment in segments]).strip()
            logger.info(f"Transcribed {len(audio_bytes)} bytes -> '{transcribed_text}' (lang={info.language})")
            return transcribed_text
        finally:
            if os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)
                except Exception:
                    pass

transcription_service = TranscriptionService.get_instance()

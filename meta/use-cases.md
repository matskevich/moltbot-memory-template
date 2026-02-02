# Use Cases

Реальные кейсы использования:

## 2026-01-30: YouTube audio extraction
**Задача:** скачать аудио с YouTube для обработки  
**Решение:** yt-dlp + deno runtime (tier 1)  
**Статус:** ✅ работает (без cookies, deno решает JS challenges)

## 2026-01-30: YouTube transcription
**Задача:** транскрибировать YouTube видео в текст  
**Решение:** download_youtube_audio.py → transcribe_audio.py (Groq Whisper API)  
**Статус:** ✅ работает (полный пайплайн, авто-удаление аудио)


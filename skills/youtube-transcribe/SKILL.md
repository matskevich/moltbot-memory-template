# YouTube Transcribe Skill

Полный пайплайн: скачивает аудио из YouTube и транскрибирует через Groq Whisper API.

## Capabilities

- Извлечение аудио из YouTube видео (yt-dlp + deno)
- Конвертация в mp3 (лучшее качество)
- Транскрипция через Groq Whisper API (whisper-large-v3)
- Автоматическое определение языка
- Автоматическое удаление временных файлов
- Поддержка любых публичных YouTube URL

## Dependencies

- `yt-dlp` (установлен: /usr/local/bin/yt-dlp)
- `deno` (установлен: ~/.deno/bin/deno)
- `requests` (Python library для HTTP)
- `GROQ_API_KEY` (env variable)
- Python 3 scripts:
  - `~/clawd/scripts/download_youtube_audio.py`
  - `~/clawd/scripts/transcribe_audio.py`
  - `~/clawd/scripts/transcribe_youtube.py` (комбинированный)

## Usage

### 1. Полная транскрипция (download + transcribe):

```bash
python3 ~/clawd/scripts/transcribe_youtube.py <youtube_url>
```

**Пример:**
```bash
python3 ~/clawd/scripts/transcribe_youtube.py \
  "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
```

**Результат:**
```
YouTube Transcriber
==================================================

[1/2] Downloading audio from YouTube...
✓ Audio saved: /path/to/youtube_transcripts/dQw4w9WgXcQ.mp3

[2/2] Transcribing audio...
✓ Audio file deleted

==================================================
✓ SUCCESS

URL:      https://www.youtube.com/watch?v=dQw4w9WgXcQ
Language: English
Duration: 212.9s

Transcript:
--------------------------------------------------
We're no strangers to love...
```

**Опции:**
- `--keep-audio` — сохранить аудио файл после транскрипции

### 2. Только скачивание аудио:

```bash
python3 ~/clawd/scripts/download_youtube_audio.py <youtube_url> [output_dir]
```

### 3. Только транскрипция (готового аудио):

```bash
python3 ~/clawd/scripts/transcribe_audio.py <audio_file>
```

### 4. Через clawd (агента):

Просто попроси:
- "Транскрибируй это YouTube видео: [URL]"
- "Что говорится в этом видео: https://youtube.com/..."
- "Скачай и транскрибируй: [URL]"

Агент автоматически:
1. Скачает аудио через `download_youtube_audio.py`
2. Отправит на Groq Whisper API через `transcribe_audio.py`
3. Вернёт транскрипцию с языком и длительностью
4. Удалит временный аудио файл

## Limitations

- Работает только с публичными YouTube видео
- Требует стабильное соединение с YouTube
- Таймаут: 5 минут на скачивание

## Troubleshooting

**Ошибка: "No supported JavaScript runtime"**
→ Убедись что deno установлен и в PATH

**Ошибка: "Sign in to confirm you're not a bot"**
→ С deno runtime эта ошибка НЕ должна возникать (deno решает JS challenges)

## Technical Notes

- **Tier 1** solution (нативный yt-dlp, без сторонних API)
- Deno runtime решает YouTube JS challenges автоматически
- Cookies НЕ нужны (в отличие от старых версий)
- Формат: mp3, качество: 0 (лучшее)

## Next Steps

После транскрипции можно:
1. Сохранить transcript в файл (.txt или .md)
2. Анализировать контент (sentiment, keywords, summary)
3. Извлекать структурированные данные (timestamps, speakers)
4. Генерировать краткое саммари через LLM
5. Переводить на другие языки

## Example Workflow

```bash
# Полный пайплайн
cd ~/clawd
python3 scripts/transcribe_youtube.py "https://youtube.com/watch?v=VIDEO_ID" > transcript.txt

# С сохранением аудио
python3 scripts/transcribe_youtube.py "https://youtube.com/watch?v=VIDEO_ID" --keep-audio
```

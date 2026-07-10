import type { LyricLine, LyricWord } from '../types.js';

export function parseTime(timeStr: string): number {
  if (!timeStr) return 0;
  timeStr = timeStr.trim();

  const offsetMatch = timeStr.match(/^([\d.]+)(h|m|s|ms)$/);
  if (offsetMatch) {
    const value = parseFloat(offsetMatch[1]);
    const unit = offsetMatch[2];
    if (unit === 'h') return Math.round(value * 3600 * 1000);
    if (unit === 'm') return Math.round(value * 60 * 1000);
    if (unit === 's') return Math.round(value * 1000);
    if (unit === 'ms') return Math.round(value);
  }

  const parts = timeStr.split(':');
  let totalMs = 0;
  if (parts.length === 1) {
    totalMs = parseFloat(parts[0]) * 1000;
  } else if (parts.length === 2) {
    totalMs = parseInt(parts[0], 10) * 60 * 1000 + parseFloat(parts[1]) * 1000;
  } else if (parts.length === 3) {
    totalMs = parseInt(parts[0], 10) * 3600 * 1000 + parseInt(parts[1], 10) * 60 * 1000 + parseFloat(parts[2]) * 1000;
  }
  return Math.round(totalMs);
}

export function alignSyllablesWithLineText(
  syllabus: { startTimeMs: number; durationMs?: number; text: string; isBackground?: boolean }[],
  lineText: string
): LyricWord[] {
  const words: LyricWord[] = [];
  let lineIndex = 0;

  for (let i = 0; i < syllabus.length; i++) {
    const syl = syllabus[i];
    if (!syl) continue;

    const trimmedSyl = syl.text.trim();
    if (!trimmedSyl) continue;

    const idx = lineText.indexOf(trimmedSyl, lineIndex);
    if (idx !== -1) {
      let wordContent = lineText.substring(lineIndex, idx + trimmedSyl.length);
      
      let nextIndex = idx + trimmedSyl.length;
      while (nextIndex < lineText.length && lineText[nextIndex] === ' ') {
        wordContent += ' ';
        nextIndex++;
      }

      if (i === syllabus.length - 1 && nextIndex < lineText.length) {
        wordContent += lineText.substring(nextIndex);
      }

      words.push({
        startTimeMs: syl.startTimeMs,
        text: wordContent,
        durationMs: syl.durationMs,
        isBackground: syl.isBackground
      });

      lineIndex = nextIndex;
    } else {
      words.push({
        startTimeMs: syl.startTimeMs,
        text: syl.text,
        durationMs: syl.durationMs,
        isBackground: syl.isBackground
      });
    }
  }

  return words;
}

export function parseLyricsPlus(payload: any): LyricLine[] | null {
  if (!payload) return null;

  let rawLyrics: any[] | null = null;
  if (Array.isArray(payload.lyrics)) {
    rawLyrics = payload.lyrics;
  } else if (Array.isArray(payload.data?.lyrics)) {
    rawLyrics = payload.data.lyrics;
  } else if (Array.isArray(payload.data)) {
    rawLyrics = payload.data;
  }

  if (!rawLyrics || rawLyrics.length === 0) return null;

  const toMs = (val: any, fallback = 0): number => {
    const num = Number(val);
    if (!Number.isFinite(num) || Number.isNaN(num)) return fallback;
    if (!Number.isInteger(num)) return Math.round(num * 1000);
    return Math.max(0, Math.round(num));
  };

  const isLineType = payload.type === 'Line' || payload.type === 'line';
  const lines: LyricLine[] = [];

  for (const entry of rawLyrics) {
    if (!entry) continue;

    const lineStart = toMs(entry.time);
    const lineDuration = toMs(entry.duration);
    const explicitEnd = toMs(entry.endTime);
    const lineEnd = explicitEnd || (lineStart + lineDuration);

    const lineText = typeof entry.text === 'string' ? entry.text : '';

    let syllabus: any[] = [];
    if (Array.isArray(entry.syllabus)) {
      syllabus = entry.syllabus.filter(Boolean);
    } else if (Array.isArray(entry.words)) {
      syllabus = entry.words.filter(Boolean);
    }

    let words: LyricWord[] = [];
    if (!isLineType && syllabus.length > 0) {
      const tempWords: any[] = [];
      for (const syl of syllabus) {
        const sylStart = toMs(syl.time, lineStart);
        const sylDuration = toMs(syl.duration);
        tempWords.push({
          startTimeMs: sylStart,
          text: typeof syl.text === 'string' ? syl.text : '',
          durationMs: sylDuration,
          isBackground: Boolean(syl.isBackground)
        });
      }
      words = alignSyllablesWithLineText(tempWords, lineText);
    }

    const romanizedText = entry.transliteration?.text || entry.romanizedText;

    lines.push({
      startTimeMs: lineStart,
      endTimeMs: lineEnd,
      durationMs: lineDuration,
      text: lineText,
      words: words.length > 0 ? words : undefined,
      isBackground: Boolean(entry.isBackground),
      romanizedText: typeof romanizedText === 'string' ? romanizedText : undefined
    });
  }

  return lines;
}

export function parseLrc(lrcText: string): LyricLine[] {
  const lines = lrcText.split('\n');
  const result: LyricLine[] = [];
  const timeRegex = /\[(\d+):(\d+)(?:\.(\d+))?\]/g;
  const wordRegex = /<(\d+):(\d+)(?:\.(\d+))?>/g;

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    timeRegex.lastIndex = 0;
    const matches: { time: number; matchStr: string }[] = [];
    let match;
    while ((match = timeRegex.exec(line)) !== null) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const msStr = match[3] || '0';
      const ms = parseInt(msStr.padEnd(3, '0').substring(0, 3), 10);
      const timeMs = minutes * 60 * 1000 + seconds * 1000 + ms;
      matches.push({ time: timeMs, matchStr: match[0] });
    }

    if (matches.length === 0) continue;

    let rawText = line;
    for (const m of matches) {
      rawText = rawText.replace(m.matchStr, '');
    }
    rawText = rawText.trim();

    const words: LyricWord[] = [];
    if (rawText.includes('<')) {
      const wordParts = rawText.split(/(<\d+:\d+(?:\.\d+)?>)/);
      let currentWordTime = matches[0].time;

      for (let i = 0; i < wordParts.length; i++) {
        const part = wordParts[i];
        if (!part) continue;

        if (part.startsWith('<') && part.endsWith('>')) {
          wordRegex.lastIndex = 0;
          const wMatch = wordRegex.exec(part);
          if (wMatch) {
            const minutes = parseInt(wMatch[1], 10);
            const seconds = parseInt(wMatch[2], 10);
            const msStr = wMatch[3] || '0';
            const ms = parseInt(msStr.padEnd(3, '0').substring(0, 3), 10);
            currentWordTime = minutes * 60 * 1000 + seconds * 1000 + ms;
          }
        } else {
          const subWords = part.match(/\S+\s*/g) || [];
          for (const sw of subWords) {
            words.push({
              startTimeMs: currentWordTime,
              text: sw
            });
          }
        }
      }
    }

    const cleanText = rawText.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

    for (const m of matches) {
      result.push({
        startTimeMs: m.time,
        text: cleanText,
        words: words.length > 0 ? words : undefined
      });
    }
  }

  return result.sort((a, b) => (a.startTimeMs || 0) - (b.startTimeMs || 0));
}

export function parseTtml(ttmlText: string): LyricLine[] {
  const result: LyricLine[] = [];
  const pRegex = /<p\b[^>]*?begin="([^"]+)"[^>]*?>(.*?)<\/p>/gi;
  let match;
  while ((match = pRegex.exec(ttmlText)) !== null) {
    const beginTimeStr = match[1];
    const pContent = match[2];
    const timeMs = parseTime(beginTimeStr);

    const pTag = match[0].substring(0, match[0].indexOf('>') + 1);
    const isLineBg = pTag.includes('role="x-bg"');

    const cleanText = pContent.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (!cleanText) continue;

    const words: LyricWord[] = [];
    const tokenRegex = /(<[^>]+>)|([^<]+)/gi;
    let tokenMatch;

    interface SpanState {
      begin: string | null;
      end: string | null;
      dur: string | null;
      isBg: boolean;
    }
    const spanStack: SpanState[] = [];

    while ((tokenMatch = tokenRegex.exec(pContent)) !== null) {
      if (tokenMatch[1]) {
        const tag = tokenMatch[1];
        if (tag.toLowerCase().startsWith('<span')) {
          const beginMatch = /begin="([^"]+)"/i.exec(tag);
          const endMatch = /end="([^"]+)"/i.exec(tag);
          const durMatch = /dur="([^"]+)"/i.exec(tag);
          const isBg = /role=["']x-bg["']/i.test(tag);
          spanStack.push({
            begin: beginMatch ? beginMatch[1] : null,
            end: endMatch ? endMatch[1] : null,
            dur: durMatch ? durMatch[1] : null,
            isBg
          });
        } else if (tag.toLowerCase() === '</span>') {
          spanStack.pop();
        }
      } else if (tokenMatch[2]) {
        const text = tokenMatch[2];

        let currentBegin: string | null = null;
        let currentEnd: string | null = null;
        let currentDur: string | null = null;
        for (let idx = spanStack.length - 1; idx >= 0; idx--) {
          if (spanStack[idx].begin) {
            currentBegin = spanStack[idx].begin;
            currentEnd = spanStack[idx].end;
            currentDur = spanStack[idx].dur;
            break;
          }
        }
        const isSpanBg = spanStack.some(s => s.isBg);

        if (currentBegin) {
          const startMs = parseTime(currentBegin);
          let durationMs: number | undefined = undefined;
          if (currentEnd) {
            durationMs = parseTime(currentEnd) - startMs;
          } else if (currentDur) {
            durationMs = parseTime(currentDur);
          }

          words.push({
            startTimeMs: startMs,
            durationMs,
            text: text,
            isBackground: isSpanBg || isLineBg
          });
        } else {
          if (words.length > 0) {
            words[words.length - 1].text += text;
          } else {
            words.push({
              startTimeMs: timeMs,
              text: text,
              isBackground: isSpanBg || isLineBg
            });
          }
        }
      }
    }

    // Normalize spacing on parsed words using the alignment helper
    const alignedWords = words.length > 0 ? alignSyllablesWithLineText(words, cleanText) : [];

    result.push({
      startTimeMs: timeMs,
      text: cleanText,
      words: alignedWords.length > 0 ? alignedWords : undefined,
      isBackground: isLineBg
    });
  }
  return result.sort((a, b) => (a.startTimeMs || 0) - (b.startTimeMs || 0));
}

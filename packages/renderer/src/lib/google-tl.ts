/**
 * Config for GoogleService
 */
const CONFIG = {
  GOOGLE: {
    MAX_RETRIES: 3,
    RETRY_DELAY_MS: 1000,
    FETCH_TIMEOUT_MS: 6000,
  },
};

interface RomanizableLine {
  text?: { text: string; romanizedText?: string }[] | string;
  romanizedText?: string;
  isWordSynced?: boolean;
}

/**
 * Service for translating and romanizing text using Google Translate (unofficial API)
 */
export class GoogleService {
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => {
      setTimeout(resolve, ms);
    });
  }

  private static fetchWithTimeout(
    url: string,
    timeoutMs = CONFIG.GOOGLE.FETCH_TIMEOUT_MS,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(url, { signal: controller.signal }).finally(() =>
      clearTimeout(timeoutId),
    );
  }

  private static isPurelyLatinScript(text: string): boolean {
    // Basic check for Latin script characters plus common punctuation and numbers
    // eslint-disable-next-line no-control-regex
    return /^[\u0000-\u007F\u0080-\u00FF\u0100-\u017F\u0180-\u024F]*$/.test(
      text,
    );
  }

  static async translate(
    textOrArray: string | string[],
    targetLang: string,
  ): Promise<string | string[]> {
    if (
      !textOrArray ||
      (Array.isArray(textOrArray) && textOrArray.length === 0)
    ) {
      return Array.isArray(textOrArray) ? [] : '';
    }

    const isArray = Array.isArray(textOrArray);
    const texts = isArray ? (textOrArray as string[]) : [textOrArray as string];

    // Check for empty strings to preserve indices
    const nonEmptyIndices: number[] = [];
    const textsToTranslate: string[] = [];

    texts.forEach((t, i) => {
      if (t && t.trim()) {
        nonEmptyIndices.push(i);
        textsToTranslate.push(t);
      }
    });

    if (textsToTranslate.length === 0) {
      return isArray ? texts : texts[0];
    }

    // Batching logic: Google Translate URL limit is roughly 2000 chars.
    // We'll be conservative with 1500 chars per batch.
    const BATCH_SIZE_CHARS = 1500;
    const translatedResults: string[] = new Array(textsToTranslate.length).fill(
      '',
    );

    let currentBatch: string[] = [];
    let currentBatchIndices: number[] = [];
    let currentBatchLength = 0;

    const processBatch = async (batch: string[], indices: number[]) => {
      if (batch.length === 0) return;
      const joinedText = batch.join('\n');

      let attempt = 0;
      let success = false;

      while (attempt < CONFIG.GOOGLE.MAX_RETRIES && !success) {
        try {
          const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(joinedText)}`;
          // eslint-disable-next-line no-await-in-loop
          const response = await GoogleService.fetchWithTimeout(url);
          if (!response.ok) throw new Error(`Status ${response.status}`);
          // eslint-disable-next-line no-await-in-loop
          const data = await response.json();

          // data[0] contains segments.
          // With batching/newlines, Google sometimes returns one large segment with newlines,
          // or multiple segments. We need to reconstruct the full text first.

          const fullTranslation =
            data?.[0]?.map((seg: any) => seg?.[0]).join('') || '';

          // Split by newline to get individual lines back
          const lines = fullTranslation.split('\n');

          // Edge case: Google might strip trailing newlines or add extra.
          // If we sent N lines, we expect N lines back approx.
          // However, empty lines in input were filtered out before sending.
          // So 'lines' should match 'batch'.

          // If mismatch, try to align? Or just take what we have.
          // If lines.length < batch.length, we might have lost some.
          // If lines.length > batch.length, maybe some line wrap?

          // We'll trust the split for now but ensure we don't overflow.

          indices.forEach((originalIdx, i) => {
            // Safe access
            if (i < lines.length) {
              translatedResults[originalIdx] = lines[i];
            } else {
              // Fallback if response is shorter
              translatedResults[originalIdx] = batch[i];
            }
          });

          success = true;
        } catch (e) {
          attempt += 1;
          if (attempt < CONFIG.GOOGLE.MAX_RETRIES) {
            // eslint-disable-next-line no-await-in-loop
            await GoogleService.delay(
              CONFIG.GOOGLE.RETRY_DELAY_MS * 2 ** (attempt - 1),
            );
          } else {
            // Fail: fill with original
            indices.forEach((originalIdx, i) => {
              translatedResults[originalIdx] = batch[i];
            });
          }
        }
      }
    };

    for (let i = 0; i < textsToTranslate.length; i += 1) {
      const text = textsToTranslate[i];
      if (currentBatchLength + text.length > BATCH_SIZE_CHARS) {
        // eslint-disable-next-line no-await-in-loop
        await processBatch(currentBatch, currentBatchIndices);
        currentBatch = [];
        currentBatchIndices = [];
        currentBatchLength = 0;
      }
      currentBatch.push(text);
      currentBatchIndices.push(i);
      currentBatchLength += text.length;
    }

    if (currentBatch.length > 0) {
      await processBatch(currentBatch, currentBatchIndices);
    }

    // Reconstruct final array
    const finalArray = [...texts];
    nonEmptyIndices.forEach((realIdx, mappedIdx) => {
      finalArray[realIdx] = translatedResults[mappedIdx];
    });

    return isArray ? finalArray : finalArray[0];
  }

  static async romanizeRawTexts(texts: string[]): Promise<string[]> {
    const contextText = texts.join(' ');

    if (GoogleService.isPurelyLatinScript(contextText)) {
      return texts;
    }

    // Filter lines that actually need romanization
    const indicesToRomanize: number[] = [];
    const textsToRomanize: string[] = [];

    texts.forEach((text, index) => {
      if (text && text.trim() && !GoogleService.isPurelyLatinScript(text)) {
        indicesToRomanize.push(index);
        textsToRomanize.push(text);
      }
    });

    if (textsToRomanize.length === 0) {
      return texts;
    }

    // Process romanization requests in batches of 10 in parallel
    const romanizedResults = new Array<string>(textsToRomanize.length);
    const BATCH_SIZE = 10;

    for (let i = 0; i < textsToRomanize.length; i += BATCH_SIZE) {
      const batchTexts = textsToRomanize.slice(i, i + BATCH_SIZE);
      const batchPromises = batchTexts.map(async (text, batchIdx) => {
        let attempt = 0;
        let success = false;
        while (attempt < CONFIG.GOOGLE.MAX_RETRIES && !success) {
          try {
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=rm&q=${encodeURIComponent(text)}`;
            const response = await GoogleService.fetchWithTimeout(url);
            const data = await response.json();
            const romanized = data?.[0]?.[0]?.[3] || text;
            romanizedResults[i + batchIdx] = romanized;
            success = true;
          } catch (e) {
            attempt++;
            if (attempt < CONFIG.GOOGLE.MAX_RETRIES) {
              await GoogleService.delay(CONFIG.GOOGLE.RETRY_DELAY_MS * 2 ** (attempt - 1));
            } else {
              romanizedResults[i + batchIdx] = text;
            }
          }
        }
      });
      // eslint-disable-next-line no-await-in-loop
      await Promise.all(batchPromises);
    }

    // Map results back
    const finalTexts = [...texts];
    indicesToRomanize.forEach((realIdx, mappedIdx) => {
      finalTexts[realIdx] = romanizedResults[mappedIdx];
    });

    return finalTexts;
  }

  static async romanize<T extends RomanizableLine>(
    originalLyrics: T[] | { data?: T[]; content?: T[] },
  ): Promise<T[]> {
    const lines: T[] = Array.isArray(originalLyrics)
      ? originalLyrics
      : (originalLyrics as { data?: T[]; content?: T[] }).data ||
        (originalLyrics as { data?: T[]; content?: T[] }).content ||
        [];

    if (!lines || lines.length === 0)
      return Array.isArray(originalLyrics) ? originalLyrics : [];

    const rawTexts = lines.map((line: any) => {
      if (line.isInstrumental || line.romanizedText) return '';
      if (typeof line.text === 'string') return line.text;
      if (Array.isArray(line.text) && line.text.length > 0) {
        return line.text.map((s: { text: string }) => s.text).join('');
      }
      return '';
    });

    const romanizedTexts = await GoogleService.romanizeRawTexts(rawTexts);

    return lines.map((line: T, index: number) => {
      if (line.romanizedText) return line;
      const romanized = romanizedTexts[index];
      const hasRomanization = romanized && romanized !== rawTexts[index];
      if (hasRomanization) {
        return {
          ...line,
          romanizedText: romanized,
        };
      }
      return line;
    });
  }

  static async romanizeTexts(texts: string[]): Promise<string[]> {
    return GoogleService.romanizeRawTexts(texts);
  }
}

import { traverseString, traverseList } from '../jsonTraverse.js';
import { StreamManifest, IStreamInfo, IAudioStreamInfo, IVideoStreamInfo } from '../types.js';

export function parse(playerData: any): StreamManifest {
  validatePlayable(playerData);

  const streams: IStreamInfo[] = [];

  for (const format of traverseList(playerData, 'streamingData', 'formats')) {
    tryAddStream(format, streams);
  }

  for (const format of traverseList(playerData, 'streamingData', 'adaptiveFormats')) {
    tryAddStream(format, streams);
  }

  if (streams.length === 0) {
    const videoId = traverseString(playerData, 'videoDetails', 'videoId');
    throw new Error(`Video '${videoId}' does not contain any playable streams.`);
  }

  return new StreamManifest(streams);
}

function validatePlayable(playerData: any): void {
  const previewVideoId = traverseString(
    playerData,
    'playabilityStatus',
    'errorScreen',
    'playerLegacyDesktopYpcTrailerRenderer',
    'trailerVideoId'
  );

  if (previewVideoId && previewVideoId.trim()) {
    const videoId = traverseString(playerData, 'videoDetails', 'videoId');
    throw new Error(`Video '${videoId}' requires purchase and cannot be played.`);
  }

  const status = traverseString(playerData, 'playabilityStatus', 'status');
  if (status.toUpperCase() !== 'OK') {
    const videoId = traverseString(playerData, 'videoDetails', 'videoId');
    const reason = traverseString(playerData, 'playabilityStatus', 'reason');
    throw new Error(`Video '${videoId}' is unplayable. Reason: '${reason}'.`);
  }
}

function tryAddStream(content: any, streams: IStreamInfo[]): void {
  if (!content) return;

  const itagVal = traverseString(content, 'itag');
  const itag = parseInt(itagVal, 10);
  if (isNaN(itag)) return;

  const cipherData = parseCipherData(content);
  let url = traverseString(content, 'url');
  if (!url && cipherData) {
    url = cipherData['url'] || '';
  }

  if (!url || !url.trim()) return;

  const clenStr = traverseString(content, 'contentLength');
  const clenUrl = tryGetQueryParameterValue(url, 'clen');
  const contentLength = (clenStr ? parseInt(clenStr, 10) : null) || (clenUrl ? parseInt(clenUrl, 10) : null);

  if (contentLength === null || isNaN(contentLength)) return;

  const mimeType = traverseString(content, 'mimeType');
  const containerName = substringAfter(substringUntil(mimeType, ';'), '/');
  if (!containerName || !containerName.trim()) return;

  const bitrateValue = parseInt(traverseString(content, 'bitrate'), 10);
  if (isNaN(bitrateValue)) return;

  const isAudioOnly = mimeType.toLowerCase().startsWith('audio/');
  const codecsMatch = /codecs="([^"]+)"/.exec(mimeType);
  const codecs = codecsMatch ? codecsMatch[1] : '';
  const audioCodec = isAudioOnly ? codecs : nullIfWhiteSpace(substringAfter(codecs, ', '));
  const videoCodec = isAudioOnly ? null : parseVideoCodec(codecs);

  let audioLanguage: { code: string; name: string } | null = null;
  let isAudioLanguageDefault: boolean | null = null;
  const audioLanguageCode = substringUntil(traverseString(content, 'audioTrack', 'id'), '.');
  const audioLanguageName = traverseString(content, 'audioTrack', 'displayName');

  if (audioLanguageCode && audioLanguageCode.trim()) {
    audioLanguage = {
      code: audioLanguageCode,
      name: audioLanguageName && audioLanguageName.trim() ? audioLanguageName : audioLanguageCode
    };
  }

  const isDefaultStr = traverseString(content, 'audioTrack', 'audioIsDefault');
  if (isDefaultStr) {
    isAudioLanguageDefault = isDefaultStr.toLowerCase() === 'true';
  }

  if (videoCodec) {
    const fpsVal = parseInt(traverseString(content, 'fps'), 10);
    const framerate = isNaN(fpsVal) ? 24 : fpsVal;
    const qualityLabel = traverseString(content, 'qualityLabel');
    const videoQuality = qualityLabel && qualityLabel.trim()
      ? parseVideoQualityFromLabel(qualityLabel, framerate)
      : parseVideoQualityFromItag(itag, framerate);

    const widthVal = parseInt(traverseString(content, 'width'), 10);
    const heightVal = parseInt(traverseString(content, 'height'), 10);
    const videoResolution = !isNaN(widthVal) && !isNaN(heightVal)
      ? { width: widthVal, height: heightVal }
      : getDefaultResolution(videoQuality.maxHeight);

    const isVideoUpscaledFlag = isVideoUpscaled(content);

    if (audioCodec) {
      streams.push({
        type: 'muxed',
        url,
        container: containerName,
        size: contentLength,
        bitrate: bitrateValue,
        audioCodec,
        audioLanguage,
        isAudioLanguageDefault,
        videoCodec,
        videoQuality: videoQuality.label,
        videoResolution,
        isVideoUpscaled: isVideoUpscaledFlag
      } as any);
    } else {
      streams.push({
        type: 'video',
        url,
        container: containerName,
        size: contentLength,
        bitrate: bitrateValue,
        videoCodec,
        videoQuality: videoQuality.label,
        videoResolution,
        isVideoUpscaled: isVideoUpscaledFlag
      } as any);
    }
  } else if (audioCodec) {
    streams.push({
      type: 'audio',
      url,
      container: containerName,
      size: contentLength,
      bitrate: bitrateValue,
      audioCodec,
      audioLanguage,
      isAudioLanguageDefault
    } as any);
  }
}

function parseVideoCodec(codecs: string): string | null {
  const codec = nullIfWhiteSpace(substringUntil(codecs, ', '));
  if (codec && codec.toLowerCase() === 'unknown') {
    return 'av01.0.05M.08';
  }
  return codec;
}

function isVideoUpscaled(content: any): boolean {
  const xtags = traverseString(content, 'xtags');
  if (!xtags || !xtags.trim()) return false;

  try {
    const bytes = Buffer.from(xtags, 'base64');
    const map = tryDeserializeProtobufMap(bytes);
    if (!map) return false;

    return map['sr'] === '1';
  } catch (e) {
    return false;
  }
}

function parseCipherData(content: any): Record<string, string> | null {
  let cipher = traverseString(content, 'cipher');
  if (!cipher || !cipher.trim()) {
    cipher = traverseString(content, 'signatureCipher');
  }

  return (!cipher || !cipher.trim()) ? null : getQueryParameters(cipher);
}

function nullIfWhiteSpace(value: string | null): string | null {
  return (!value || !value.trim()) ? null : value;
}

function substringUntil(value: string | null, delimiter: string): string {
  if (!value) return '';
  const index = value.indexOf(delimiter);
  return index < 0 ? value : value.substring(0, index);
}

function substringAfter(value: string | null, delimiter: string): string {
  if (!value) return '';
  const index = value.indexOf(delimiter);
  return index < 0 ? '' : value.substring(index + delimiter.length);
}

function getQueryParameters(query: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const parameter of query.split('&')) {
    const key = decodeURIComponent(substringUntil(parameter, '='));
    const val = decodeURIComponent(substringAfter(parameter, '='));
    if (key && key.trim()) {
      result[key] = val;
    }
  }
  return result;
}

function tryGetQueryParameterValue(url: string, key: string): string | null {
  const query = url.includes('?') ? substringAfter(url, '?') : url;
  const parameters = getQueryParameters(query);
  return parameters[key] || null;
}

interface VideoQualityInfo {
  label: string;
  maxHeight: number;
  framerate: number;
}

function parseVideoQualityFromLabel(label: string, framerateFallback: number): VideoQualityInfo {
  const match = /^(\d+)\D(\d+)?/.exec(label);
  if (!match) {
    return { label, maxHeight: 360, framerate: framerateFallback };
  }

  const maxHeight = parseInt(match[1], 10);
  const framerateGroup = match[2];
  const framerate = framerateGroup ? parseInt(framerateGroup, 10) : framerateFallback;

  return { label, maxHeight, framerate };
}

function parseVideoQualityFromItag(itag: number, framerate: number): VideoQualityInfo {
  const maxHeight = itagToMaxHeight(itag);
  const label = framerate <= 30 ? `${maxHeight}p` : `${maxHeight}p${Math.ceil(framerate / 10) * 10}`;
  return { label, maxHeight, framerate };
}

function getDefaultResolution(maxHeight: number): { width: number; height: number } {
  switch (maxHeight) {
    case 144: return { width: 256, height: 144 };
    case 240: return { width: 426, height: 240 };
    case 360: return { width: 640, height: 360 };
    case 480: return { width: 854, height: 480 };
    case 720: return { width: 1280, height: 720 };
    case 1080: return { width: 1920, height: 1080 };
    case 1440: return { width: 2560, height: 1440 };
    case 2160: return { width: 3840, height: 2160 };
    case 2880: return { width: 5120, height: 2880 };
    case 3072: return { width: 4096, height: 3072 };
    case 4320: return { width: 7680, height: 4320 };
    default: return { width: Math.floor(16 * maxHeight / 9), height: maxHeight };
  }
}

function itagToMaxHeight(itag: number): number {
  switch (itag) {
    case 5: return 144;
    case 6: return 240;
    case 13: return 144;
    case 17: return 144;
    case 18: return 360;
    case 22: return 720;
    case 34: return 360;
    case 35: return 480;
    case 36: return 240;
    case 37: return 1080;
    case 38: return 3072;
    case 43: return 360;
    case 44: return 480;
    case 45: return 720;
    case 46: return 1080;
    case 59: return 480;
    case 78: return 480;
    case 82: return 360;
    case 83: return 480;
    case 84: return 720;
    case 85: return 1080;
    case 91: return 144;
    case 92: return 240;
    case 93: return 360;
    case 94: return 480;
    case 95: return 720;
    case 96: return 1080;
    case 100: return 360;
    case 101: return 480;
    case 102: return 720;
    case 132: return 240;
    case 151: return 144;
    case 133: return 240;
    case 134: return 360;
    case 135: return 480;
    case 136: return 720;
    case 137: return 1080;
    case 138: return 4320;
    case 142: return 240;
    case 143: return 360;
    case 144: return 480;
    case 145: return 720;
    case 146: return 1080;
    case 160: return 144;
    case 161: return 144;
    case 167: return 360;
    case 168: return 480;
    case 169: return 720;
    case 170: return 1080;
    case 212: return 480;
    case 213: return 480;
    case 214: return 720;
    case 215: return 720;
    case 216: return 1080;
    case 217: return 1080;
    case 218: return 480;
    case 219: return 480;
    case 222: return 480;
    case 223: return 480;
    case 224: return 720;
    case 225: return 720;
    case 226: return 1080;
    case 227: return 1080;
    case 242: return 240;
    case 243: return 360;
    case 244: return 480;
    case 245: return 480;
    case 246: return 480;
    case 247: return 720;
    case 248: return 1080;
    case 264: return 1440;
    case 266: return 2160;
    case 271: return 1440;
    case 272: return 2160;
    case 278: return 144;
    case 298: return 720;
    case 299: return 1080;
    case 302: return 720;
    case 303: return 1080;
    case 308: return 1440;
    case 313: return 2160;
    case 315: return 2160;
    case 330: return 144;
    case 331: return 240;
    case 332: return 360;
    case 333: return 480;
    case 334: return 720;
    case 335: return 1080;
    case 336: return 1440;
    case 337: return 2160;
    case 399: return 1080;
    case 398: return 720;
    case 397: return 480;
    case 396: return 360;
    case 395: return 240;
    case 394: return 144;
    default: return 360;
  }
}

function tryDeserializeProtobufMap(data: Uint8Array): Record<string, string> | null {
  const result: Record<string, string> = {};
  let i = 0;

  function tryReadVarint(): number | null {
    let result = 0;
    let shift = 0;
    while (i < data.length) {
      const b = data[i++];
      result |= (b & 0x7f) << shift;
      if ((b & 0x80) === 0) {
        return result;
      }
      shift += 7;
      if (shift >= 64) {
        return null;
      }
    }
    return null;
  }

  while (i < data.length) {
    const outerTag = tryReadVarint();
    if (outerTag === null) return null;
    if ((outerTag & 0b111) !== 2) return null;

    const entryLen = tryReadVarint();
    if (entryLen === null) return null;

    const entryEnd = i + entryLen;
    if (entryEnd > data.length) return null;

    let key: string | null = null;
    let value: string | null = null;

    while (i < entryEnd) {
      const tag = tryReadVarint();
      if (tag === null) return null;

      const fieldNumber = tag >> 3;
      const wireType = tag & 0b111;

      if (wireType !== 2) return null;

      const len = tryReadVarint();
      if (len === null || i + len > entryEnd) return null;

      const str = new TextDecoder('utf-8').decode(data.subarray(i, i + len));
      i += len;

      if (fieldNumber === 1) {
        key = str;
      } else if (fieldNumber === 2) {
        value = str;
      }
    }

    if (key !== null && value !== null) {
      result[key] = value;
    }
  }

  return result;
}

// ============================================
// BiliBGM Pro - Stream Selector
// ============================================

import type {
  PlayUrlData,
  DashStream,
  AudioStreamInfo,
  VideoStreamInfo,
  StreamInfo,
} from '@/types';
import { QualityMap, AudioQualityMap, VideoCodecMap } from '@/types';

/**
 * 从 playurl 数据中提取所有可用音频流
 */
export function getAudioStreams(playUrl: PlayUrlData): AudioStreamInfo[] {
  if (!playUrl.dash?.audio) return [];

  return playUrl.dash.audio.map((stream) => ({
    url: stream.baseUrl || stream.base_url,
    backupUrls: stream.backupUrl || stream.backup_url || [],
    quality: stream.id,
    qualityName: QualityMap[stream.id] || `Quality ${stream.id}`,
    bandwidth: stream.bandwidth,
    codecs: stream.codecs,
    codecName: stream.codecs,
    audioQuality: stream.id,
    audioQualityName: AudioQualityMap[stream.id] || `${stream.id}`,
    size: estimateSize(stream.bandwidth, playUrl.dash!.duration),
  }));
}

/**
 * 从 playurl 数据中提取所有可用视频流
 */
export function getVideoStreams(playUrl: PlayUrlData): VideoStreamInfo[] {
  if (!playUrl.dash?.video) return [];

  return playUrl.dash.video.map((stream) => ({
    url: stream.baseUrl || stream.base_url,
    backupUrls: stream.backupUrl || stream.backup_url || [],
    quality: stream.id,
    qualityName: QualityMap[stream.id] || `Quality ${stream.id}`,
    bandwidth: stream.bandwidth,
    codecs: stream.codecs,
    codecName: getCodecName(stream.codecid, stream.codecs),
    width: stream.width,
    height: stream.height,
    videoQuality: stream.id,
    videoQualityName: QualityMap[stream.id] || `${stream.height}P`,
    size: estimateSize(stream.bandwidth, playUrl.dash!.duration),
  }));
}

/**
 * 获取最佳音频流 (最高质量)
 */
export function getBestAudioStream(playUrl: PlayUrlData): AudioStreamInfo | null {
  const streams = getAudioStreams(playUrl);
  if (streams.length === 0) return null;

  // 按 bandwidth 降序，取最高的
  streams.sort((a, b) => b.bandwidth - a.bandwidth);
  return streams[0];
}

/**
 * 获取指定质量的音频流
 */
export function getAudioStreamByQuality(
  playUrl: PlayUrlData,
  qualityId: number
): AudioStreamInfo | null {
  const streams = getAudioStreams(playUrl);
  const exact = streams.find((s) => s.quality === qualityId);
  if (exact) return exact;

  // fallback: 找最接近的
  if (streams.length === 0) return null;
  streams.sort((a, b) => Math.abs(a.quality - qualityId) - Math.abs(b.quality - qualityId));
  return streams[0];
}

/**
 * 获取最佳视频流 (指定或最高画质)
 */
export function getBestVideoStream(
  playUrl: PlayUrlData,
  preferredQuality?: number
): VideoStreamInfo | null {
  const streams = getVideoStreams(playUrl);
  if (streams.length === 0) return null;

  if (preferredQuality) {
    // 找精确匹配
    const exact = streams.find((s) => s.quality === preferredQuality);
    if (exact) return exact;

    // 找最接近但不超过的
    const lower = streams
      .filter((s) => s.quality <= preferredQuality)
      .sort((a, b) => b.quality - a.quality);
    if (lower.length > 0) return lower[0];
  }

  // 默认取最高画质 (按 quality id 降序)
  streams.sort((a, b) => b.quality - a.quality);
  return streams[0];
}

/**
 * 获取去重后的视频画质列表
 */
export function getUniqueVideoQualities(playUrl: PlayUrlData): Array<{
  id: number;
  name: string;
  height?: number;
  codec: string;
}> {
  const streams = getVideoStreams(playUrl);
  const seen = new Set<string>();
  const result: Array<{ id: number; name: string; height?: number; codec: string }> = [];

  for (const stream of streams) {
    // 按 quality id 去重
    const key = `${stream.quality}`;
    if (seen.has(key)) continue;
    seen.add(key);

    result.push({
      id: stream.quality,
      name: QualityMap[stream.quality] || `${stream.height || '?'}P`,
      height: stream.height,
      codec: stream.codecName,
    });
  }

  // 按 quality id 降序排列
  result.sort((a, b) => b.id - a.id);
  return result;
}

/**
 * 获取可用的音频质量列表
 */
export function getAudioQualities(playUrl: PlayUrlData): Array<{
  id: number;
  name: string;
  bandwidth: number;
}> {
  const streams = getAudioStreams(playUrl);
  const seen = new Set<number>();
  const result: Array<{ id: number; name: string; bandwidth: number }> = [];

  for (const stream of streams) {
    if (seen.has(stream.quality)) continue;
    seen.add(stream.quality);

    result.push({
      id: stream.quality,
      name: AudioQualityMap[stream.quality] || `${stream.quality}`,
      bandwidth: stream.bandwidth,
    });
  }

  result.sort((a, b) => b.bandwidth - a.bandwidth);
  return result;
}

// -------- 辅助函数 --------

function getCodecName(codecid?: number, codecs?: string): string {
  if (codecid && VideoCodecMap[codecid]) return VideoCodecMap[codecid];
  if (codecs) {
    if (codecs.includes('avc')) return 'AVC (H.264)';
    if (codecs.includes('hev') || codecs.includes('hvc')) return 'HEVC (H.265)';
    if (codecs.includes('av01')) return 'AV1';
    return codecs;
  }
  return '未知编码';
}

function estimateSize(bandwidth: number, duration: number): string {
  if (!bandwidth || !duration) return '未知';
  const bytes = (bandwidth * duration) / 8;
  const mb = bytes / (1024 * 1024);
  if (mb < 1) return `${Math.round(bytes / 1024)} KB`;
  return `${mb.toFixed(1)} MB`;
}

/**
 * 获取音频流的下载URL (优先使用主URL，如果失败用backup)
 */
export function getDownloadUrl(stream: StreamInfo): string {
  return stream.url;
}

/**
 * 获取带 headers 的下载配置 (用于 chrome.downloads)
 */
export function getDownloadHeaders(): { name: string; value: string }[] {
  return [
    { name: 'Referer', value: 'https://www.bilibili.com' },
    { name: 'User-Agent', value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
  ];
}

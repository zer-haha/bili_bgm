// ============================================
// BiliBGM Pro - URL Parser
// ============================================

import type { ParsedUrl, PageType } from '@/types';

/**
 * 从 URL 解析 BV号/AV号/EP号/SS号
 */
export function parseUrl(url: string): ParsedUrl {
  if (!url) return { pageType: 'unknown' };

  let urlObj: URL;
  try {
    urlObj = new URL(url);
  } catch {
    return { pageType: 'unknown' };
  }

  // 检查是否是B站域名
  if (!urlObj.hostname.includes('bilibili.com')) {
    return { pageType: 'unknown' };
  }

  const pathname = urlObj.pathname;

  // 视频页: /video/BV1xx411c7mD 或 /video/av170001
  if (pathname.startsWith('/video/')) {
    return parseVideoUrl(pathname, urlObj);
  }

  // 番剧页: /bangumi/play/ep123456 或 /bangumi/play/ss12345
  if (pathname.startsWith('/bangumi/play/')) {
    return parseBangumiUrl(pathname, urlObj);
  }

  return { pageType: 'unknown' };
}

/**
 * 解析视频URL
 */
function parseVideoUrl(pathname: string, urlObj: URL): ParsedUrl {
  const result: ParsedUrl = { pageType: 'video' };

  // 提取 BV 号
  const bvMatch = pathname.match(/\/video\/(BV[\w]+)/i);
  if (bvMatch) {
    result.bvid = bvMatch[1];
  }

  // 提取 AV 号
  const avMatch = pathname.match(/\/video\/av(\d+)/i);
  if (avMatch) {
    result.aid = parseInt(avMatch[1], 10);
  }

  // 提取分P号
  const pParam = urlObj.searchParams.get('p');
  if (pParam) {
    result.p = parseInt(pParam, 10);
  }

  if (!result.bvid && !result.aid) {
    return { pageType: 'unknown' };
  }

  return result;
}

/**
 * 解析番剧URL
 */
function parseBangumiUrl(pathname: string, urlObj: URL): ParsedUrl {
  const result: ParsedUrl = { pageType: 'bangumi' };

  // 提取 EP 号
  const epMatch = pathname.match(/\/bangumi\/play\/ep(\d+)/i);
  if (epMatch) {
    result.epid = parseInt(epMatch[1], 10);
  }

  // 提取 SS 号
  const ssMatch = pathname.match(/\/bangumi\/play\/ss(\d+)/i);
  if (ssMatch) {
    result.ssid = parseInt(ssMatch[1], 10);
  }

  if (!result.epid && !result.ssid) {
    return { pageType: 'unknown' };
  }

  return result;
}

/**
 * BV号转AV号 (简化版, 仅用于显示)
 * 完整算法: https://github.com/SocialSisterYi/bilibili-API-collect
 */
export function bv2av(bvid: string): number | null {
  if (!bvid || !bvid.startsWith('BV') || bvid.length !== 12) return null;
  // 简化：不实现完整转换，直接返回 null
  // 实际使用中优先使用 bvid 调用接口
  return null;
}

/**
 * 检查 URL 是否为 B站视频页
 */
export function isBilibiliVideoPage(url: string): boolean {
  const parsed = parseUrl(url);
  return parsed.pageType !== 'unknown';
}

/**
 * 获取当前标签页URL (供 service worker 使用)
 */
export async function getCurrentTabUrl(): Promise<string | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.url || null;
}

/**
 * 提取URL中的BV号
 */
export function extractBvid(text: string): string | null {
  const match = text.match(/BV[\w]{10}/i);
  return match ? match[0] : null;
}

/**
 * 格式化显示用的 URL 描述
 */
export function describeUrl(parsed: ParsedUrl): string {
  switch (parsed.pageType) {
    case 'video':
      if (parsed.bvid) return `视频 ${parsed.bvid}${parsed.p ? ` P${parsed.p}` : ''}`;
      if (parsed.aid) return `视频 av${parsed.aid}${parsed.p ? ` P${parsed.p}` : ''}`;
      return '视频';
    case 'bangumi':
      if (parsed.epid) return `番剧 EP${parsed.epid}`;
      if (parsed.ssid) return `番剧 SS${parsed.ssid}`;
      return '番剧';
    default:
      return '未知页面';
  }
}

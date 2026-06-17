// ============================================
// BiliBGM Pro - Filename Generator
// ============================================

import type { VideoInfo, OutputFormat } from '@/types';

/**
 * 清理文件名中的非法字符
 * Windows: \ / : * ? " < > |
 */
export function sanitizeFilename(name: string): string {
  if (!name) return 'unknown';
  // 替换 Windows 文件名中的非法字符
  return name
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 200); // 限制长度
}

/**
 * 根据模板生成文件名
 * 模板变量: [title], [up], [bvid], [aid], [page], [pageName], [quality]
 */
export function generateFilename(
  template: string,
  info: VideoInfo,
  format: OutputFormat,
  pageIndex?: number,
  pageName?: string,
  qualityName?: string
): string {
  const page = info.pages.find((p) => p.page === (pageIndex || 1));

  let filename = template
    .replace(/\[title\]/g, sanitizeFilename(info.title))
    .replace(/\[up\]/g, sanitizeFilename(info.owner.name))
    .replace(/\[bvid\]/g, info.bvid || '')
    .replace(/\[aid\]/g, String(info.aid || ''))
    .replace(/\[page\]/g, String(pageIndex || 1))
    .replace(/\[pageName\]/g, sanitizeFilename(pageName || page?.part || ''))
    .replace(/\[quality\]/g, sanitizeFilename(qualityName || ''));

  // 如果有多P，加后缀区分
  if (info.pages.length > 1 && pageIndex) {
    const partName = sanitizeFilename(pageName || page?.part || `P${pageIndex}`);
    filename = `${filename} - ${partName}`;
  }

  // 加扩展名
  filename = `${filename}.${format}`;

  return sanitizeFilename(filename);
}

/**
 * 生成临时文件名 (用于 native host 转码)
 */
export function generateTempFilename(info: VideoInfo, pageIndex?: number): string {
  const base = generateFilename('[title] - [up] - [bvid]', info, 'm4a', pageIndex);
  return base;
}

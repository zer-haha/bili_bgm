// ============================================
// BiliBGM Pro - Bilibili API Module
// ============================================

import type {
  BiliApiResponse,
  VideoInfo,
  PageInfo,
  PlayUrlData,
  ParsedUrl,
} from '@/types';

// -------- 常量 --------
const BILIBILI_API = {
  // 视频信息
  VIDEO_INFO: 'https://api.bilibili.com/x/web-interface/view',
  // 番剧信息
  BANGUMI_INFO: 'https://api.bilibili.com/pgc/view/web/season',
  // 播放地址 (需要登录才能获取高画质)
  PLAY_URL: 'https://api.bilibili.com/x/player/playurl',
  // WBI 播放地址 (支持更多编码)
  PLAY_URL_WBI: 'https://api.bilibili.com/x/player/wbi/playurl',
  // 番剧播放地址
  BANGUMI_PLAY_URL: 'https://api.bilibili.com/pgc/player/web/playurl',
};

// 请求 headers
const COMMON_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Referer: 'https://www.bilibili.com',
  Origin: 'https://www.bilibili.com',
};

// -------- 错误处理 --------
const ERROR_MESSAGES: Record<number, string> = {
  '-1': '接口返回异常',
  '-2': '请求参数错误',
  '-3': '接口校验失败',
  '-4': '请求被拦截',
  '-400': '请求错误',
  '-403': '权限不足，请登录B站账号',
  '-404': '视频不存在或已被删除',
  '-509': '请求过于频繁，请稍后再试',
  '-2001': '缺少必要参数',
  62001: '需要大会员才能观看',
  62002: '稿件不可见',
  62004: '稿件审核中',
  62011: '番剧需要大会员',
};

function getErrorMessage(code: number, msg: string): string {
  return ERROR_MESSAGES[code] || msg || `未知错误 (${code})`;
}

export class BilibiliApiError extends Error {
  code: number;
  constructor(code: number, message: string) {
    super(message);
    this.name = 'BilibiliApiError';
    this.code = code;
  }
}

// -------- 基础请求 --------
async function request<T>(url: string, params?: Record<string, any>): Promise<BiliApiResponse<T>> {
  const urlObj = new URL(url);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) {
        urlObj.searchParams.set(k, String(v));
      }
    });
  }

  const resp = await fetch(urlObj.toString(), {
    method: 'GET',
    credentials: 'include', // 自动携带同域 Cookie
    headers: COMMON_HEADERS,
  });

  if (!resp.ok) {
    throw new BilibiliApiError(-1, `HTTP 请求失败: ${resp.status} ${resp.statusText}`);
  }

  const data: BiliApiResponse<T> = await resp.json();

  if (data.code !== 0) {
    throw new BilibiliApiError(data.code, getErrorMessage(data.code, data.message));
  }

  return data;
}

// -------- 视频信息 --------
export async function getVideoInfo(bvid?: string, aid?: number): Promise<VideoInfo> {
  const params: Record<string, any> = {};
  if (bvid) params.bvid = bvid;
  else if (aid) params.aid = aid;
  else throw new BilibiliApiError(-2, '缺少 bvid 或 aid 参数');

  const resp = await request<any>(BILIBILI_API.VIDEO_INFO, params);
  const d = resp.data;

  return {
    bvid: d.bvid,
    aid: d.aid,
    cid: d.cid,
    title: d.title,
    desc: d.desc,
    owner: {
      name: d.owner?.name || '未知',
      mid: d.owner?.mid || 0,
      face: d.owner?.face,
    },
    pic: d.pic,
    duration: d.duration,
    pages: (d.pages || []).map((p: any) => ({
      cid: p.cid,
      page: p.page,
      part: p.part,
      duration: p.duration,
    })),
    stat: {
      view: d.stat?.view || 0,
      like: d.stat?.like || 0,
      coin: d.stat?.coin || 0,
      favorite: d.stat?.favorite || 0,
      share: d.stat?.share || 0,
      danmaku: d.stat?.danmaku || 0,
    },
  };
}

// -------- 番剧信息 --------
export async function getBangumiInfo(epid?: number, ssid?: number): Promise<VideoInfo> {
  const params: Record<string, any> = {};
  if (epid) params.ep_id = epid;
  else if (ssid) params.season_id = ssid;
  else throw new BilibiliApiError(-2, '缺少 ep_id 或 season_id');

  const resp = await request<any>(BILIBILI_API.BANGUMI_INFO, params);
  const result = resp.data;

  // 找到当前 ep
  const episodes = result.episodes || [];
  const currentEp = epid
    ? episodes.find((e: any) => e.id === epid) || episodes[0]
    : episodes[0];

  if (!currentEp) {
    throw new BilibiliApiError(-404, '未找到番剧剧集信息');
  }

  const pages: PageInfo[] = episodes.map((ep: any, idx: number) => ({
    cid: ep.cid,
    page: idx + 1,
    part: ep.long_title || ep.title || `第${idx + 1}话`,
    duration: Math.floor((ep.duration || 0) / 1000),
  }));

  return {
    bvid: currentEp.bvid || '',
    aid: currentEp.aid || 0,
    cid: currentEp.cid,
    title: currentEp.long_title || currentEp.share_copy || result.title,
    desc: result.evaluate,
    owner: {
      name: '番剧',
      mid: 0,
      face: '',
    },
    pic: result.cover || currentEp.cover,
    duration: Math.floor((currentEp.duration || 0) / 1000),
    pages,
    seasonId: result.season_id,
    episodeId: currentEp.id,
    seasonTitle: result.title,
  };
}

// -------- 播放地址 --------
export async function getPlayUrl(
  bvid: string,
  cid: number,
  qn: number = 80,
  fnval: number = 4048, // dash + flac + dolby + hdr + 4k + av1
  isBangumi: boolean = false
): Promise<PlayUrlData> {
  const params: Record<string, any> = {
    bvid,
    cid,
    qn,
    fnval,
    fnver: 0,
    fourk: 1,
    platform: 'pc',
    // 默认 AVC + HEVC + AV1 都请求
    // fnval 4048 = dash(16) + hdr(64) + 4k(128) + flac(256) + dolby(512) + av1(2048) + ...
  };

  let apiUrl: string;
  if (isBangumi) {
    apiUrl = BILIBILI_API.BANGUMI_PLAY_URL;
    params.ep_id = undefined; // 番剧用 bangumi api 需要额外参数
  } else {
    apiUrl = BILIBILI_API.PLAY_URL;
  }

  const resp = await request<any>(apiUrl, params);
  return resp.data as PlayUrlData;
}

// -------- 通过 ParsedUrl 获取视频信息 --------
export async function fetchVideoInfoByParsed(parsed: ParsedUrl): Promise<VideoInfo> {
  if (parsed.pageType === 'bangumi') {
    return getBangumiInfo(parsed.epid, parsed.ssid);
  }
  return getVideoInfo(parsed.bvid, parsed.aid);
}

// -------- 获取分P的 cid --------
export function getPageCid(videoInfo: VideoInfo, pageIndex: number): number {
  const page = videoInfo.pages.find((p) => p.page === pageIndex);
  if (!page) {
    // fallback 到第一P
    return videoInfo.pages[0]?.cid || videoInfo.cid;
  }
  return page.cid;
}

// -------- 复制文字到剪贴板 --------
export async function copyToClipboard(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}

// -------- 格式化文件大小 --------
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// -------- 格式化时长 --------
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ============================================
// BiliBGM Pro - Background Service Worker
// ============================================

import type { Message, MessageResponse, AppSettings } from '@/types';
import { DEFAULT_SETTINGS } from '@/types';
import { parseUrl } from '@/core/parser';
import { fetchVideoInfoByParsed, getPlayUrl } from '@/core/bilibiliApi';
import { getBestAudioStream, getAudioStreamByQuality, getAudioStreams, getVideoStreams } from '@/core/streamSelector';
import { downloadAudio, downloadVideo, downloadBatchAudio, downloadBatchVideo } from '@/core/downloader';
import { getAllTasks, clearCompletedTasks } from '@/core/taskManager';
import { checkNativeHost } from '@/native/nativeMessaging';

// -------- 安装事件 --------
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // 初始化默认设置
    chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
    console.log('[BiliBGM Pro] 插件已安装');
  } else if (details.reason === 'update') {
    console.log('[BiliBGM Pro] 插件已更新到', chrome.runtime.getManifest().version);
  }
});

// -------- 消息处理 --------
chrome.runtime.onMessage.addListener(
  (message: Message, sender, sendResponse: (resp: MessageResponse) => void) => {
    handleMessage(message).then(sendResponse).catch((err) => {
      sendResponse({ success: false, error: err.message || '未知错误' });
    });
    return true; // 保持消息通道异步
  }
);

// -------- 端口流式传输: 大文件音频数据 (用于 MP3 转换) --------
// service worker fetch 完整音频 → blob URL → popup 从 blob URL fetch 原始数据
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'stream-audio') {
    port.onMessage.addListener(async (msg) => {
      if (msg.action === 'start') {
        try {
          // declarativeNetRequest 已设置正确 Referer，可以直接 fetch CDN
          const response = await fetch(msg.url);
          if (!response.ok) {
            port.postMessage({ type: 'error', error: `HTTP_${response.status}` });
            return;
          }

          const blob = await response.blob();
          const blobUrl = URL.createObjectURL(blob);

          port.postMessage({
            type: 'ready',
            blobUrl,
            size: blob.size,
            mimeType: blob.type,
          });
        } catch (err: any) {
          port.postMessage({ type: 'error', error: err.message });
        }
      } else if (msg.action === 'revoke') {
        // popup 用完之后释放 blob URL
        if (msg.blobUrl) {
          try { URL.revokeObjectURL(msg.blobUrl); } catch {}
        }
      }
    });
  }
});

async function handleMessage(message: Message): Promise<MessageResponse> {
  switch (message.type) {
    case 'GET_CURRENT_TAB_INFO':
      return await handleGetCurrentTabInfo();

    case 'PARSE_VIDEO_INFO':
      return await handleParseVideoInfo(message.data);

    case 'START_DOWNLOAD':
      return await handleStartDownload(message.data);

    case 'GET_TASK_LIST':
      return await handleGetTaskList();

    case 'CLEAR_TASKS':
      return await handleClearTasks();

    case 'GET_SETTINGS':
      return await handleGetSettings();

    case 'SAVE_SETTINGS':
      return await handleSaveSettings(message.data);

    case 'CHECK_NATIVE_HOST':
      return await handleCheckNativeHost();

    case 'COPY_TO_CLIPBOARD':
      return await handleCopyToClipboard(message.data);

    case 'FETCH_CDN_BLOB':
      return await handleFetchCdnBlob(message.data);

    case 'GET_AUDIO_STREAM_URL':
      return await handleGetAudioStreamUrl(message.data);

    case 'DOWNLOAD_AUDIO':
      return await handleDownloadAudio(message.data);

    case 'GET_DASH_STREAMS':
      return await handleGetDashStreams(message.data);

    case 'DOWNLOAD_VIDEO_STREAM':
      return await handleDownloadVideoStream(message.data);

    default:
      return { success: false, error: `未知消息类型: ${message.type}` };
  }
}

// -------- Handler 实现 --------

async function handleGetCurrentTabInfo(): Promise<MessageResponse> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) {
      return { success: false, error: '无法获取当前标签页信息' };
    }

    const url = tab.url;
    const parsed = parseUrl(url);

    if (parsed.pageType === 'unknown') {
      return {
        success: true,
        data: { url, isBiliPage: false, parsed },
      };
    }

    // 尝试获取视频信息
    try {
      const videoInfo = await fetchVideoInfoByParsed(parsed);
      return {
        success: true,
        data: { url, isBiliPage: true, parsed, videoInfo },
      };
    } catch (err: any) {
      return {
        success: true,
        data: { url, isBiliPage: true, parsed, videoInfo: null, parseError: err.message },
      };
    }
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function handleParseVideoInfo(data: { url: string }): Promise<MessageResponse> {
  try {
    const parsed = parseUrl(data.url);
    if (parsed.pageType === 'unknown') {
      return { success: false, error: '无法解析URL，不是B站视频页' };
    }
    const videoInfo = await fetchVideoInfoByParsed(parsed);
    return { success: true, data: { parsed, videoInfo } };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function handleStartDownload(data: any): Promise<MessageResponse> {
  try {
    const settings = await getSettings();
    const { action, videoInfo, parsed, pageIndex, pageIndices, format, quality } = data;

    if (action === 'audio') {
      if (pageIndices && pageIndices.length > 1) {
        const tasks = await downloadBatchAudio({
          videoInfo,
          parsed,
          pageIndices,
          format: format || settings.defaultAudioFormat,
          preferredQuality: quality,
          settings,
        });
        return { success: true, data: { tasks } };
      } else {
        const task = await downloadAudio({
          videoInfo,
          parsed,
          pageIndex: pageIndex || 1,
          format: format || settings.defaultAudioFormat,
          preferredQuality: quality,
          settings,
        });
        return { success: true, data: { task } };
      }
    } else if (action === 'video') {
      if (pageIndices && pageIndices.length > 1) {
        const tasks = await downloadBatchVideo({
          videoInfo,
          parsed,
          pageIndices,
          preferredQuality: quality,
          includeAudio: true,
          settings,
        });
        return { success: true, data: { tasks } };
      } else {
        const tasks = await downloadVideo({
          videoInfo,
          parsed,
          pageIndex: pageIndex || 1,
          preferredQuality: quality,
          includeAudio: true,
          settings,
        });
        return { success: true, data: { tasks } };
      }
    }

    return { success: false, error: `未知下载操作: ${action}` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function handleGetTaskList(): Promise<MessageResponse> {
  try {
    const tasks = await getAllTasks();
    return { success: true, data: { tasks } };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function handleClearTasks(): Promise<MessageResponse> {
  try {
    const count = await clearCompletedTasks();
    return { success: true, data: { cleared: count } };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function handleGetSettings(): Promise<MessageResponse> {
  try {
    const settings = await getSettings();
    return { success: true, data: { settings } };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function handleSaveSettings(data: AppSettings): Promise<MessageResponse> {
  try {
    await chrome.storage.local.set({ settings: data });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function handleCheckNativeHost(): Promise<MessageResponse> {
  try {
    const result = await checkNativeHost();
    return { success: true, data: result };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function handleCopyToClipboard(data: { text: string }): Promise<MessageResponse> {
  return { success: true, data: { text: data.text } };
}

/**
 * 通过 chrome.scripting.executeScript 在 MAIN world 获取 CDN 文件数据 (base64)
 * 用于 popup 中的 MP3 转换
 *
 * 使用 MAIN world 执行 fetch，这样可以:
 * 1. 获得正确的 Referer (bilibili.com) → CDN 返回 200
 * 2. 绕过页面 CSP 对 inline script 的限制
 */
async function handleFetchCdnBlob(data: { url: string }): Promise<MessageResponse> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      return { success: false, error: '无法获取当前标签页' };
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: 'MAIN',
      func: async (cdnUrl: string) => {
        try {
          const r = await fetch(cdnUrl);
          if (!r.ok) return { success: false, error: `HTTP_${r.status}` };
          const b = await r.blob();
          const ab = await b.arrayBuffer();
          const bytes = new Uint8Array(ab);
          let binary = '';
          const chunkSize = 8192;
          for (let i = 0; i < bytes.length; i += chunkSize) {
            binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
          }
          return {
            success: true,
            blobData: btoa(binary),
            mimeType: b.type,
            size: b.size,
          };
        } catch (e: any) {
          return { success: false, error: e.message };
        }
      },
      args: [data.url],
    });

    const result: any = results[0]?.result;
    if (!result?.success) {
      return { success: false, error: result?.error || 'CDN 获取失败' };
    }

    return { success: true, data: result };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// -------- 辅助 --------

/**
 * 获取音频流 URL (供 popup 中 MP3 转换使用)
 */
async function handleGetAudioStreamUrl(data: {
  bvid: string;
  cid: number;
  quality?: number;
}): Promise<MessageResponse> {
  try {
    const playUrl = await getPlayUrl(data.bvid, data.cid, 80, 4048, false);
    const audioStream = data.quality
      ? getAudioStreamByQuality(playUrl, data.quality)
      : getBestAudioStream(playUrl);

    if (!audioStream) {
      return { success: false, error: '未找到可用的音频流' };
    }

    return {
      success: true,
      data: {
        audioUrl: audioStream.url,
        quality: audioStream.quality,
        qualityName: audioStream.audioQualityName,
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * 直接下载音频文件 (M4A)
 * 在 MAIN world fetch CDN → blob URL → chrome.downloads
 */
async function handleDownloadAudio(data: {
  audioUrl: string;
  filename: string;
}): Promise<MessageResponse> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      return { success: false, error: '无法获取当前标签页' };
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: 'MAIN',
      func: async (url: string) => {
        try {
          const r = await fetch(url);
          if (!r.ok) return { success: false, error: `HTTP_${r.status}` };
          const b = await r.blob();
          const u = URL.createObjectURL(b);
          return { success: true, blobUrl: u, size: b.size };
        } catch (e: any) {
          return { success: false, error: e.message };
        }
      },
      args: [data.audioUrl],
    });

    const result: any = results[0]?.result;
    if (!result?.success) {
      return { success: false, error: result?.error || 'CDN 获取失败' };
    }

    const blobUrl = result.blobUrl;
    const tabId = tab.id;

    try {
      const downloadId = await new Promise<number>((resolve, reject) => {
        chrome.downloads.download(
          { url: blobUrl, filename: data.filename, saveAs: true },
          (id) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message || '保存文件失败'));
            } else if (id === undefined) {
              reject(new Error('下载启动失败'));
            } else {
              resolve(id);
            }
          }
        );
      });

      // 延迟释放 blob URL
      setTimeout(async () => {
        try {
          await chrome.scripting.executeScript({
            target: { tabId },
            world: 'MAIN',
            func: (url: string) => { URL.revokeObjectURL(url); },
            args: [blobUrl],
          });
        } catch {}
      }, 120_000);

      return { success: true, data: { downloadId } };
    } catch (err: any) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          world: 'MAIN',
          func: (url: string) => { URL.revokeObjectURL(url); },
          args: [blobUrl],
        });
      } catch {}
      throw err;
    }
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * 获取 DASH 音视频流列表 (供 popup 展示)
 */
async function handleGetDashStreams(data: {
  bvid: string;
  cid: number;
}): Promise<MessageResponse> {
  try {
    const playUrl = await getPlayUrl(data.bvid, data.cid, 80, 4048, false);

    const audio = getAudioStreams(playUrl).map((s) => ({
      id: s.audioQuality,
      url: s.url,
      bandwidth: s.bandwidth,
      codecs: s.codecs,
      qualityName: s.audioQualityName,
      size: s.size,
    }));

    const video = getVideoStreams(playUrl).map((s) => ({
      id: s.videoQuality + s.codecs.charCodeAt(0),
      url: s.url,
      bandwidth: s.bandwidth,
      codecs: s.codecs,
      width: s.width,
      height: s.height,
      qualityName: s.videoQualityName,
      size: s.size,
    }));

    return { success: true, data: { audio, video } };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * 下载单个视频流 (M4S)
 */
async function handleDownloadVideoStream(data: {
  videoUrl: string;
  filename: string;
}): Promise<MessageResponse> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      return { success: false, error: '无法获取当前标签页' };
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: 'MAIN',
      func: async (url: string) => {
        try {
          const r = await fetch(url);
          if (!r.ok) return { success: false, error: `HTTP_${r.status}` };
          const b = await r.blob();
          const u = URL.createObjectURL(b);
          return { success: true, blobUrl: u, size: b.size };
        } catch (e: any) {
          return { success: false, error: e.message };
        }
      },
      args: [data.videoUrl],
    });

    const result: any = results[0]?.result;
    if (!result?.success) {
      return { success: false, error: result?.error || '视频获取失败' };
    }

    const blobUrl = result.blobUrl;
    const tabId = tab.id;

    try {
      const downloadId = await new Promise<number>((resolve, reject) => {
        chrome.downloads.download(
          { url: blobUrl, filename: data.filename, saveAs: true },
          (id) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message || '保存失败'));
            } else if (id === undefined) {
              reject(new Error('下载启动失败'));
            } else {
              resolve(id);
            }
          }
        );
      });

      setTimeout(async () => {
        try {
          await chrome.scripting.executeScript({
            target: { tabId },
            world: 'MAIN',
            func: (url: string) => { URL.revokeObjectURL(url); },
            args: [blobUrl],
          });
        } catch {}
      }, 120_000);

      return { success: true, data: { downloadId } };
    } catch (err: any) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          world: 'MAIN',
          func: (url: string) => { URL.revokeObjectURL(url); },
          args: [blobUrl],
        });
      } catch {}
      throw err;
    }
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function getSettings(): Promise<AppSettings> {
  const result = await chrome.storage.local.get('settings');
  return { ...DEFAULT_SETTINGS, ...result.settings };
}

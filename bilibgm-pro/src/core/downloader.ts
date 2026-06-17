// ============================================
// BiliBGM Pro - Downloader
// ============================================
//
// 下载策略 (经浏览器实测验证):
// - B站 CDN (bilivideo.com) 从 bilibili.com 页面 fetch 返回 200 ✅
// - Chrome 扩展 service worker 的 fetch 会被覆盖 Referer → 403 ❌
// - chrome.scripting.executeScript 注入函数 fetch → Failed to fetch ❌
// - 静态注入的 content script 通过消息通信 fetch → 200 ✅
//
// 最终方案:
// content script (已静态注入B站页面) 监听消息 → fetch CDN → 返回 blob URL
// service worker → chrome.downloads.download(blobUrl) → 保存文件

import type {
  VideoInfo,
  DownloadTask,
  OutputFormat,
  AppSettings,
  ParsedUrl,
  PlayUrlData,
  AudioStreamInfo,
  VideoStreamInfo,
} from '@/types';
import {
  getPlayUrl,
  getPageCid,
  fetchVideoInfoByParsed,
  formatBytes,
} from './bilibiliApi';
import {
  getBestAudioStream,
  getAudioStreamByQuality,
  getBestVideoStream,
} from './streamSelector';
import { generateFilename } from './filename';
import {
  addTask,
  updateTask,
  setTaskStatus,
  setTaskProgress,
  createAudioTask,
  createVideoTask,
} from './taskManager';
import { sendToNativeHost } from '@/native/nativeMessaging';

// -------- 下载音频 --------

export async function downloadAudio(params: {
  videoInfo: VideoInfo;
  parsed: ParsedUrl;
  pageIndex: number;
  format: 'mp3' | 'm4a';
  preferredQuality?: number;
  settings: AppSettings;
}): Promise<DownloadTask> {
  const { videoInfo, parsed, pageIndex, preferredQuality, settings } = params;
  let { format } = params;
  const isBangumi = parsed.pageType === 'bangumi';
  const cid = getPageCid(videoInfo, pageIndex);
  const pageData = videoInfo.pages.find((p) => p.page === pageIndex);
  const pageName = pageData?.part || '';

  // 如果选择 MP3 但未启用增强模式，自动回退为 M4A
  let fallbackNote = '';
  if (format === 'mp3' && !settings.enableEnhancedMode) {
    format = 'm4a';
    fallbackNote = ' (未启用增强模式，已自动切换为 M4A)';
  }

  const fileName = generateFilename(
    settings.filenameTemplate,
    videoInfo,
    format,
    pageIndex,
    pageName,
    preferredQuality ? String(preferredQuality) : 'best'
  );

  const task = createAudioTask({
    title: videoInfo.title,
    upName: videoInfo.owner.name,
    bvid: videoInfo.bvid,
    cid,
    pageIndex,
    pageName,
    cover: videoInfo.pic,
    format,
    quality: preferredQuality || 30280,
    qualityName: '',
    fileName,
  });

  await addTask(task);

  try {
    await setTaskStatus(task.id, 'parsing');

    const playUrl = await getPlayUrl(videoInfo.bvid, cid, 80, 4048, isBangumi);
    const audioStream = preferredQuality
      ? getAudioStreamByQuality(playUrl, preferredQuality)
      : getBestAudioStream(playUrl);

    if (!audioStream) {
      throw new Error('未找到可用的音频流，可能是视频需要登录或大会员权限');
    }

    task.qualityName = audioStream.audioQualityName;
    task.downloadUrl = audioStream.url;
    await updateTask(task.id, {
      qualityName: audioStream.audioQualityName,
      downloadUrl: audioStream.url,
      format,
      fileName,
    });

    if (format === 'mp3') {
      return await downloadAndConvertMp3(task, audioStream, settings);
    }

    // M4A: 通过 content script 消息通信下载
    await setTaskStatus(task.id, 'downloading');
    const downloadId = await downloadViaContentScript(audioStream.url, fileName);

    await updateTask(task.id, { chromeDownloadId: downloadId });
    await setTaskStatus(task.id, 'completed');

    return { ...task, status: 'completed', chromeDownloadId: downloadId };
  } catch (err: any) {
    const errorMsg = err.message || '下载失败';
    await setTaskStatus(task.id, 'failed', errorMsg + fallbackNote);
    return { ...task, status: 'failed', error: errorMsg + fallbackNote };
  }
}

// -------- 下载视频 --------

export async function downloadVideo(params: {
  videoInfo: VideoInfo;
  parsed: ParsedUrl;
  pageIndex: number;
  preferredQuality?: number;
  includeAudio: boolean;
  settings: AppSettings;
}): Promise<DownloadTask[]> {
  const { videoInfo, parsed, pageIndex, preferredQuality, includeAudio, settings } = params;
  const isBangumi = parsed.pageType === 'bangumi';
  const cid = getPageCid(videoInfo, pageIndex);
  const pageData = videoInfo.pages.find((p) => p.page === pageIndex);
  const pageName = pageData?.part || '';
  const tasks: DownloadTask[] = [];

  try {
    const playUrl = await getPlayUrl(videoInfo.bvid, cid, preferredQuality || 80, 4048, isBangumi);

    const videoStream = getBestVideoStream(playUrl, preferredQuality);
    if (!videoStream) {
      throw new Error('未找到可用的视频流');
    }

    if (settings.enableEnhancedMode && includeAudio) {
      const mergeTask = await downloadAndMergeVideo(null, videoStream, playUrl, videoInfo, settings, pageIndex, pageName);
      tasks.push(mergeTask);
      return tasks;
    }

    const videoFileName = generateFilename(
      settings.filenameTemplate,
      videoInfo,
      'm4s' as OutputFormat,
      pageIndex,
      pageName,
      videoStream.videoQualityName
    );

    const videoTask = createVideoTask({
      title: videoInfo.title,
      upName: videoInfo.owner.name,
      bvid: videoInfo.bvid,
      cid,
      pageIndex,
      pageName,
      cover: videoInfo.pic,
      format: 'm4s',
      quality: videoStream.quality,
      qualityName: videoStream.videoQualityName,
      fileName: videoFileName,
    });
    await addTask(videoTask);
    tasks.push(videoTask);

    await setTaskStatus(videoTask.id, 'downloading');
    const videoDlId = await downloadViaContentScript(videoStream.url, videoFileName);
    await updateTask(videoTask.id, { chromeDownloadId: videoDlId });
    await setTaskStatus(videoTask.id, 'completed');

    if (includeAudio) {
      const audioStream = getBestAudioStream(playUrl);
      if (audioStream) {
        const audioFileName = generateFilename(
          settings.filenameTemplate,
          videoInfo,
          'm4a',
          pageIndex,
          pageName,
          audioStream.audioQualityName
        );

        const audioTask = createAudioTask({
          title: videoInfo.title,
          upName: videoInfo.owner.name,
          bvid: videoInfo.bvid,
          cid,
          pageIndex,
          pageName,
          cover: videoInfo.pic,
          format: 'm4a',
          quality: audioStream.quality,
          qualityName: audioStream.audioQualityName,
          fileName: audioFileName,
        });
        await addTask(audioTask);
        tasks.push(audioTask);

        await setTaskStatus(audioTask.id, 'downloading');
        const audioDlId = await downloadViaContentScript(audioStream.url, audioFileName);
        await updateTask(audioTask.id, { chromeDownloadId: audioDlId });
        await setTaskStatus(audioTask.id, 'completed');
      }
    }

    return tasks;
  } catch (err: any) {
    const errorMsg = err.message || '视频下载失败';
    for (const t of tasks) {
      if (t.status !== 'completed') {
        await setTaskStatus(t.id, 'failed', errorMsg);
      }
    }
    if (tasks.length === 0) {
      const failTask = createVideoTask({
        title: videoInfo.title,
        upName: videoInfo.owner.name,
        bvid: videoInfo.bvid,
        cid: getPageCid(videoInfo, pageIndex),
        pageIndex,
        pageName,
        cover: videoInfo.pic,
        format: 'mp4',
        quality: preferredQuality || 80,
        qualityName: '',
        fileName: '',
      });
      failTask.status = 'failed';
      failTask.error = errorMsg;
      await addTask(failTask);
      tasks.push(failTask);
    }
    return tasks;
  }
}

// -------- MP3 转码 --------

async function downloadAndConvertMp3(
  task: DownloadTask,
  audioStream: AudioStreamInfo,
  settings: AppSettings
): Promise<DownloadTask> {
  try {
    await setTaskStatus(task.id, 'downloading');
    await setTaskStatus(task.id, 'converting');

    const result = await sendToNativeHost({
      action: 'convert',
      inputPath: audioStream.url,
      outputPath: task.fileName.replace(/\.mp3$/, ''),
      ffmpegPath: settings.ffmpegPath,
      format: 'mp3',
      quality: 2,
    });

    if (!result.success) {
      throw new Error(result.error || 'Native Host 转码失败');
    }

    await setTaskStatus(task.id, 'completed');
    return { ...task, status: 'completed' };
  } catch (err: any) {
    const errorMsg = err.message || 'MP3 转码失败';
    await setTaskStatus(task.id, 'failed', errorMsg);
    return { ...task, status: 'failed', error: errorMsg };
  }
}

// -------- 视频合并 --------

async function downloadAndMergeVideo(
  _task: any,
  videoStream: VideoStreamInfo,
  playUrl: PlayUrlData,
  videoInfo: VideoInfo,
  settings: AppSettings,
  pageIndex: number,
  pageName: string
): Promise<DownloadTask> {
  const fileName = generateFilename(
    settings.filenameTemplate,
    videoInfo,
    'mp4',
    pageIndex,
    pageName,
    videoStream.videoQualityName
  );

  const task = createVideoTask({
    title: videoInfo.title,
    upName: videoInfo.owner.name,
    bvid: videoInfo.bvid,
    cid: getPageCid(videoInfo, pageIndex),
    pageIndex,
    pageName,
    cover: videoInfo.pic,
    format: 'mp4',
    quality: videoStream.quality,
    qualityName: videoStream.videoQualityName,
    fileName,
  });

  await addTask(task);

  try {
    const audioStream = getBestAudioStream(playUrl);
    if (!audioStream) {
      throw new Error('未找到可用的音频流用于合并');
    }

    await setTaskStatus(task.id, 'downloading');
    await setTaskStatus(task.id, 'converting');

    const result = await sendToNativeHost({
      action: 'merge',
      inputPath: JSON.stringify({
        videoUrl: videoStream.url,
        audioUrl: audioStream.url,
        outputName: fileName.replace(/\.mp4$/, ''),
        ffmpegPath: settings.ffmpegPath,
      }),
      outputPath: '',
      ffmpegPath: settings.ffmpegPath,
      format: 'mp4' as any,
      quality: 0,
    });

    if (!result.success) {
      throw new Error(result.error || '视频合并失败');
    }

    await setTaskStatus(task.id, 'completed');
    return { ...task, status: 'completed' };
  } catch (err: any) {
    const errorMsg = err.message || '视频合并失败';
    await setTaskStatus(task.id, 'failed', errorMsg);
    return { ...task, status: 'failed', error: errorMsg };
  }
}

// -------- 核心: 通过 chrome.scripting.executeScript 下载 --------

/**
 * 通过 chrome.scripting.executeScript 在 MAIN world 下载 CDN 资源
 *
 * 流程:
 * 1. Service Worker → chrome.scripting.executeScript(world: 'MAIN')
 * 2. MAIN world 中 fetch CDN URL (Referer 正确 → 200 ✅)
 * 3. 创建 blob URL → 返回给 Service Worker
 * 4. Service Worker 用 chrome.downloads.download(blobUrl) 保存
 *
 * 使用 MAIN world 而非 content script 注入 inline script，
 * 因为 B站页面 CSP 禁止 inline script 执行。
 */
async function downloadViaContentScript(
  cdnUrl: string,
  filename: string
): Promise<number> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id) {
    throw new Error('无法获取当前标签页，请确保已打开B站视频页面');
  }

  if (!tab.url?.includes('bilibili.com')) {
    throw new Error('当前页面不是B站，请打开B站视频页面');
  }

  // 在 MAIN world 中 fetch CDN 并创建 blob URL
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
    args: [cdnUrl],
  });

  const response: any = results[0]?.result;
  if (!response?.success) {
    throw new Error(`CDN 获取失败: ${response?.error || '请刷新页面后重试'}`);
  }

  const blobUrl = response.blobUrl;

  // 用 chrome.downloads 保存
  try {
    const downloadId = await new Promise<number>((resolve, reject) => {
      chrome.downloads.download(
        { url: blobUrl, filename, saveAs: true },
        (downloadId) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message || '保存文件失败'));
          } else if (downloadId === undefined) {
            reject(new Error('下载启动失败'));
          } else {
            resolve(downloadId);
          }
        }
      );
    });

    // 延迟释放 blob URL (通过在 MAIN world 执行 revokeObjectURL)
    setTimeout(async () => {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id! },
          world: 'MAIN',
          func: (url: string) => { URL.revokeObjectURL(url); },
          args: [blobUrl],
        });
      } catch {}
    }, 120_000);

    return downloadId;
  } catch (err) {
    // 出错也尝试释放 blob URL
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id! },
        world: 'MAIN',
        func: (url: string) => { URL.revokeObjectURL(url); },
        args: [blobUrl],
      });
    } catch {}
    throw err;
  }
}

// -------- 批量下载多P --------

export async function downloadBatchAudio(params: {
  videoInfo: VideoInfo;
  parsed: ParsedUrl;
  pageIndices: number[];
  format: 'mp3' | 'm4a';
  preferredQuality?: number;
  settings: AppSettings;
  onProgress?: (completed: number, total: number) => void;
}): Promise<DownloadTask[]> {
  const { videoInfo, parsed, pageIndices, format, preferredQuality, settings, onProgress } = params;
  const tasks: DownloadTask[] = [];

  for (let i = 0; i < pageIndices.length; i++) {
    const task = await downloadAudio({
      videoInfo,
      parsed,
      pageIndex: pageIndices[i],
      format,
      preferredQuality,
      settings,
    });
    tasks.push(task);
    onProgress?.(i + 1, pageIndices.length);
  }

  return tasks;
}

export async function downloadBatchVideo(params: {
  videoInfo: VideoInfo;
  parsed: ParsedUrl;
  pageIndices: number[];
  preferredQuality?: number;
  includeAudio: boolean;
  settings: AppSettings;
  onProgress?: (completed: number, total: number) => void;
}): Promise<DownloadTask[]> {
  const { videoInfo, parsed, pageIndices, preferredQuality, includeAudio, settings, onProgress } = params;
  const allTasks: DownloadTask[] = [];

  for (let i = 0; i < pageIndices.length; i++) {
    const tasks = await downloadVideo({
      videoInfo,
      parsed,
      pageIndex: pageIndices[i],
      preferredQuality,
      includeAudio,
      settings,
    });
    allTasks.push(...tasks);
    onProgress?.(i + 1, pageIndices.length);
  }

  return allTasks;
}

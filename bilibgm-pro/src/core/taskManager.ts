// ============================================
// BiliBGM Pro - Task Manager
// ============================================

import type { DownloadTask, TaskStatus } from '@/types';

const TASKS_STORAGE_KEY = 'bilibgm_tasks';

// 生成唯一任务ID
export function generateTaskId(): string {
  return `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// -------- 存储操作 --------

/**
 * 获取所有任务
 */
export async function getAllTasks(): Promise<DownloadTask[]> {
  const result = await chrome.storage.local.get(TASKS_STORAGE_KEY);
  return result[TASKS_STORAGE_KEY] || [];
}

/**
 * 保存所有任务
 */
export async function saveAllTasks(tasks: DownloadTask[]): Promise<void> {
  await chrome.storage.local.set({ [TASKS_STORAGE_KEY]: tasks });
}

/**
 * 获取单个任务
 */
export async function getTask(taskId: string): Promise<DownloadTask | null> {
  const tasks = await getAllTasks();
  return tasks.find((t) => t.id === taskId) || null;
}

/**
 * 添加任务
 */
export async function addTask(task: DownloadTask): Promise<void> {
  const tasks = await getAllTasks();
  tasks.unshift(task); // 新任务放最前面
  // 限制最多保存 200 个任务
  if (tasks.length > 200) tasks.splice(200);
  await saveAllTasks(tasks);
}

/**
 * 更新任务
 */
export async function updateTask(
  taskId: string,
  updates: Partial<DownloadTask>
): Promise<DownloadTask | null> {
  const tasks = await getAllTasks();
  const idx = tasks.findIndex((t) => t.id === taskId);
  if (idx === -1) return null;

  tasks[idx] = { ...tasks[idx], ...updates, updatedAt: Date.now() };
  await saveAllTasks(tasks);
  return tasks[idx];
}

/**
 * 删除任务
 */
export async function removeTask(taskId: string): Promise<void> {
  const tasks = await getAllTasks();
  const filtered = tasks.filter((t) => t.id !== taskId);
  await saveAllTasks(filtered);
}

/**
 * 清理已完成/失败的任务
 */
export async function clearCompletedTasks(): Promise<number> {
  const tasks = await getAllTasks();
  const active = tasks.filter(
    (t) => t.status !== 'completed' && t.status !== 'failed' && t.status !== 'cancelled'
  );
  const removed = tasks.length - active.length;
  await saveAllTasks(active);
  return removed;
}

/**
 * 更新任务状态
 */
export async function setTaskStatus(
  taskId: string,
  status: TaskStatus,
  error?: string
): Promise<void> {
  await updateTask(taskId, { status, error });
}

/**
 * 更新任务进度
 */
export async function setTaskProgress(
  taskId: string,
  progress: number,
  speed?: string,
  downloaded?: number,
  total?: number
): Promise<void> {
  await updateTask(taskId, { progress, speed, downloaded, total });
}

// -------- 任务创建辅助 --------

export function createAudioTask(params: {
  title: string;
  upName: string;
  bvid: string;
  cid: number;
  pageIndex: number;
  pageName: string;
  cover: string;
  format: 'mp3' | 'm4a';
  quality: number;
  qualityName: string;
  fileName: string;
}): DownloadTask {
  return {
    id: generateTaskId(),
    type: 'audio',
    status: 'pending',
    title: params.title,
    upName: params.upName,
    bvid: params.bvid,
    cid: params.cid,
    pageIndex: params.pageIndex,
    pageName: params.pageName,
    cover: params.cover,
    format: params.format,
    quality: params.quality,
    qualityName: params.qualityName,
    progress: 0,
    speed: '',
    downloaded: 0,
    total: 0,
    fileName: params.fileName,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export function createVideoTask(params: {
  title: string;
  upName: string;
  bvid: string;
  cid: number;
  pageIndex: number;
  pageName: string;
  cover: string;
  format: 'mp4' | 'm4s';
  quality: number;
  qualityName: string;
  fileName: string;
}): DownloadTask {
  return {
    id: generateTaskId(),
    type: 'video',
    status: 'pending',
    title: params.title,
    upName: params.upName,
    bvid: params.bvid,
    cid: params.cid,
    pageIndex: params.pageIndex,
    pageName: params.pageName,
    cover: params.cover,
    format: params.format,
    quality: params.quality,
    qualityName: params.qualityName,
    progress: 0,
    speed: '',
    downloaded: 0,
    total: 0,
    fileName: params.fileName,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// -------- 状态工具 --------

export function getStatusText(status: TaskStatus): string {
  switch (status) {
    case 'pending': return '等待中';
    case 'parsing': return '解析中';
    case 'downloading': return '下载中';
    case 'converting': return '转码中';
    case 'completed': return '已完成';
    case 'failed': return '失败';
    case 'cancelled': return '已取消';
    default: return '未知';
  }
}

export function getStatusColor(status: TaskStatus): string {
  switch (status) {
    case 'pending': return 'text-gray-500';
    case 'parsing': return 'text-blue-500';
    case 'downloading': return 'text-bili-pink';
    case 'converting': return 'text-yellow-500';
    case 'completed': return 'text-green-500';
    case 'failed': return 'text-red-500';
    case 'cancelled': return 'text-gray-400';
    default: return 'text-gray-500';
  }
}

export function getStatusBgColor(status: TaskStatus): string {
  switch (status) {
    case 'pending': return 'bg-gray-100 dark:bg-gray-800';
    case 'parsing': return 'bg-blue-50 dark:bg-blue-900/20';
    case 'downloading': return 'bg-pink-50 dark:bg-pink-900/20';
    case 'converting': return 'bg-yellow-50 dark:bg-yellow-900/20';
    case 'completed': return 'bg-green-50 dark:bg-green-900/20';
    case 'failed': return 'bg-red-50 dark:bg-red-900/20';
    case 'cancelled': return 'bg-gray-50 dark:bg-gray-800';
    default: return 'bg-gray-100';
  }
}

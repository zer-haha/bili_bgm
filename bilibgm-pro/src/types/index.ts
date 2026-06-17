// ============================================
// BiliBGM Pro - Type Definitions
// ============================================

// -------- 页面类型 --------
export type PageType = 'video' | 'bangumi' | 'unknown';

export interface ParsedUrl {
  pageType: PageType;
  bvid?: string;
  aid?: number;
  epid?: number;
  ssid?: number;
  p?: number; // 分P号
}

// -------- 视频信息 --------
export interface VideoInfo {
  bvid: string;
  aid: number;
  cid: number;
  title: string;
  desc?: string;
  owner: {
    name: string;
    mid: number;
    face?: string;
  };
  pic: string; // 封面
  duration: number; // 秒
  pages: PageInfo[];
  stat?: {
    view: number;
    like: number;
    coin: number;
    favorite: number;
    share: number;
    danmaku: number;
  };
  // bangumi 特有
  seasonId?: number;
  episodeId?: number;
  seasonTitle?: string;
}

export interface PageInfo {
  cid: number;
  page: number;
  part: string;
  duration: number;
}

// -------- 音视频流 --------
export interface PlayUrlData {
  quality: number;
  format: string;
  timelength: number;
  accept_format: string;
  accept_description: string[];
  accept_quality: number[];
  durl?: Durl[];
  dash?: DashData;
}

export interface Durl {
  order: number;
  length: number;
  size: number;
  url: string;
  backup_url?: string[];
}

export interface DashData {
  duration: number;
  video: DashStream[];
  audio: DashStream[] | null;
  dolby?: any;
  flac?: any;
}

export interface DashStream {
  id: number; // quality id
  baseUrl: string;
  base_url: string; // alias
  backupUrl?: string[];
  backup_url?: string[];
  bandwidth: number;
  mimeType: string;
  mime_type: string;
  codecs: string;
  width?: number;
  height?: number;
  frameRate?: string;
  frame_rate?: string;
  sar?: string;
  startWithSap?: number;
  start_with_sap?: number;
  SegmentBase?: any;
  segment_base?: any;
  codecid?: number;
}

// -------- 质量枚举 --------
export const QualityMap: Record<number, string> = {
  6: '240P 极速',
  16: '360P 流畅',
  32: '480P 清晰',
  64: '720P 高清',
  74: '720P60 高帧率',
  80: '1080P 高清',
  112: '1080P+ 高码率',
  116: '1080P60 高帧率',
  120: '4K 超清',
  125: 'HDR 真彩色',
  126: '杜比视界',
  127: '8K 超高清',
  30120: 'AV1 8K',
  30112: 'AV1 1080P+',
  30080: 'AV1 1080P',
  30064: 'AV1 720P',
  30032: 'AV1 480P',
  30016: 'AV1 360P',
  // 音频
  30280: '192kbps',
  30232: '132kbps',
  30216: '64kbps',
  30250: 'Dolby',
  30251: 'Hi-Res',
};

export const AudioQualityMap: Record<number, string> = {
  30280: '高品质 192kbps',
  30232: '标准 132kbps',
  30216: '低品质 64kbps',
  30250: 'Dolby Atmos',
  30251: 'Hi-Res 无损',
};

export const VideoCodecMap: Record<number, string> = {
  7: 'AVC (H.264)',
  12: 'HEVC (H.265)',
  13: 'AV1',
};

// -------- Stream选择结果 --------
export interface StreamInfo {
  url: string;
  backupUrls: string[];
  quality: number;
  qualityName: string;
  bandwidth: number;
  codecs: string;
  codecName: string;
  width?: number;
  height?: number;
  size?: string;
}

export interface AudioStreamInfo extends StreamInfo {
  audioQuality: number;
  audioQualityName: string;
}

export interface VideoStreamInfo extends StreamInfo {
  videoQuality: number;
  videoQualityName: string;
}

// -------- 下载任务 --------
export type TaskStatus =
  | 'pending'
  | 'parsing'
  | 'downloading'
  | 'converting'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type TaskType = 'audio' | 'video' | 'audio+video';

export type OutputFormat = 'mp3' | 'm4a' | 'mp4' | 'm4s';

export interface DownloadTask {
  id: string;
  type: TaskType;
  status: TaskStatus;
  title: string;
  upName: string;
  bvid: string;
  cid: number;
  pageIndex: number;
  pageName: string;
  cover: string;
  // 下载参数
  format: OutputFormat;
  quality: number;
  qualityName: string;
  // 进度
  progress: number; // 0-100
  speed: string;
  downloaded: number; // bytes
  total: number; // bytes
  // 文件
  fileName: string;
  downloadUrl?: string;
  // 错误
  error?: string;
  // 时间
  createdAt: number;
  updatedAt: number;
  // chrome下载ID
  chromeDownloadId?: number;
  // native host相关
  nativeJobId?: string;
  tempFilePath?: string;
}

// -------- 设置 --------
export interface AppSettings {
  // 默认下载格式
  defaultAudioFormat: 'mp3' | 'm4a';
  defaultVideoFormat: 'mp4' | 'm4s';
  // 默认质量
  defaultAudioQuality: 'auto' | 'manual';
  defaultVideoQuality: 'auto' | 'manual';
  preferredVideoQualityId: number;
  preferredAudioQualityId: number;
  // 增强模式
  enableEnhancedMode: boolean;
  ffmpegPath: string;
  nativeHostInstalled: boolean;
  // 下载
  filenameTemplate: string;
  keepOriginalM4a: boolean;
  autoOpenDownloadDir: boolean;
  // UI
  showFloatButton: boolean;
  // 主题
  theme: 'light' | 'dark' | 'system';
}

export const DEFAULT_SETTINGS: AppSettings = {
  defaultAudioFormat: 'mp3',
  defaultVideoFormat: 'mp4',
  defaultAudioQuality: 'auto',
  defaultVideoQuality: 'auto',
  preferredVideoQualityId: 80,
  preferredAudioQualityId: 30280,
  enableEnhancedMode: false,
  ffmpegPath: 'ffmpeg',
  nativeHostInstalled: false,
  filenameTemplate: '[title] - [up] - [bvid]',
  keepOriginalM4a: false,
  autoOpenDownloadDir: true,
  showFloatButton: true,
  theme: 'system',
};

// -------- 消息通信 --------
export type MessageType =
  | 'GET_CURRENT_TAB_INFO'
  | 'PARSE_VIDEO_INFO'
  | 'START_DOWNLOAD'
  | 'CANCEL_DOWNLOAD'
  | 'GET_TASK_LIST'
  | 'CLEAR_TASKS'
  | 'GET_SETTINGS'
  | 'SAVE_SETTINGS'
  | 'CHECK_NATIVE_HOST'
  | 'NATIVE_CONVERT'
  | 'COPY_TO_CLIPBOARD'
  | 'FETCH_CDN_BLOB'
  | 'GET_AUDIO_STREAM_URL'
  | 'DOWNLOAD_AUDIO'
  | 'GET_DASH_STREAMS'
  | 'DOWNLOAD_VIDEO_STREAM'
  | 'FLOAT_BTN_CLICKED';

export interface Message<T = any> {
  type: MessageType;
  data?: T;
}

export interface MessageResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

// -------- Native Host --------
export interface NativeConvertRequest {
  action: 'convert';
  inputPath: string;
  outputPath: string;
  ffmpegPath: string;
  format: 'mp3';
  quality: number; // 0-9, lower is better
}

export interface NativeConvertResponse {
  success: boolean;
  outputPath?: string;
  error?: string;
}

// -------- API响应 --------
export interface BiliApiResponse<T = any> {
  code: number;
  message: string;
  ttl: number;
  data: T;
}

// -------- UI State --------
export type PageName = 'home' | 'tasks' | 'settings' | 'about';

export interface AppState {
  currentPage: PageName;
  videoInfo: VideoInfo | null;
  loading: boolean;
  error: string | null;
  tasks: DownloadTask[];
  settings: AppSettings;
  currentUrl: string;
  isBiliPage: boolean;
}

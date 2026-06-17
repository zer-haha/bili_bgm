// ============================================
// BiliBGM Pro - Native Messaging
// ============================================

const NATIVE_HOST_NAME = 'com.bilibgm.pro';

export interface NativeMessage {
  action: 'convert' | 'merge' | 'check' | 'ping';
  inputPath: string;
  outputPath: string;
  ffmpegPath: string;
  format: string;
  quality: number;
}

export interface NativeResponse {
  success: boolean;
  outputPath?: string;
  error?: string;
  version?: string;
  ffmpegAvailable?: boolean;
}

/**
 * 向 Native Host 发送消息
 */
export function sendToNativeHost(message: NativeMessage): Promise<NativeResponse> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendNativeMessage(
      NATIVE_HOST_NAME,
      message,
      (response) => {
        if (chrome.runtime.lastError) {
          const errorMsg = chrome.runtime.lastError.message || '';
          if (errorMsg.includes('not installed') || errorMsg.includes('Specified native messaging host not found')) {
            reject(new Error(
              'Native Host 未安装。请在设置中安装本地增强组件。\n' +
              '1. 下载 native-host 文件夹\n' +
              '2. 运行 install-host.reg 注册\n' +
              '3. 确保 FFmpeg 已安装'
            ));
          } else {
            reject(new Error(`Native Host 通信失败: ${errorMsg}`));
          }
          return;
        }
        if (!response) {
          reject(new Error('Native Host 未响应'));
          return;
        }
        resolve(response as NativeResponse);
      }
    );
  });
}

/**
 * 检查 Native Host 是否可用
 */
export async function checkNativeHost(): Promise<{
  available: boolean;
  version?: string;
  ffmpegAvailable?: boolean;
  error?: string;
}> {
  try {
    const response = await sendToNativeHost({
      action: 'ping',
      inputPath: '',
      outputPath: '',
      ffmpegPath: '',
      format: '',
      quality: 0,
    });
    return {
      available: response.success,
      version: response.version,
      ffmpegAvailable: response.ffmpegAvailable,
    };
  } catch (err: any) {
    return {
      available: false,
      error: err.message,
    };
  }
}

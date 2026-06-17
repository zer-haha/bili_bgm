#!/usr/bin/env node
/**
 * BiliBGM Pro - Native Messaging Host
 *
 * 处理来自 Chrome 插件的消息，调用 FFmpeg 进行音频转码和视频合并。
 *
 * 通信协议: Chrome Native Messaging
 * - 消息格式: 4字节 little-endian 长度 + JSON 字符串
 * - 输入: stdin
 * - 输出: stdout
 */

import { exec, execSync } from 'child_process';
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';

// -------- Native Messaging 协议 --------

function sendMessage(message: any): void {
  const json = JSON.stringify(message);
  const buffer = Buffer.from(json, 'utf-8');
  const header = Buffer.alloc(4);
  header.writeUInt32LE(buffer.length, 0);

  process.stdout.write(header);
  process.stdout.write(buffer);
}

function readMessages(): void {
  let chunks: Buffer[] = [];
  let messageLength = 0;

  process.stdin.on('readable', () => {
    let chunk: Buffer | null;
    while ((chunk = process.stdin.read() as Buffer | null) !== null) {
      chunks.push(chunk);
    }

    const combined = Buffer.concat(chunks);
    let offset = 0;

    while (offset + 4 <= combined.length) {
      messageLength = combined.readUInt32LE(offset);
      offset += 4;

      if (offset + messageLength > combined.length) {
        // 消息不完整，回退
        offset -= 4;
        break;
      }

      const messageBuffer = combined.subarray(offset, offset + messageLength);
      offset += messageLength;

      try {
        const message = JSON.parse(messageBuffer.toString('utf-8'));
        handleMessage(message);
      } catch (e) {
        sendMessage({ success: false, error: '消息解析失败' });
      }
    }

    // 保留未处理的数据
    if (offset < combined.length) {
      chunks = [combined.subarray(offset)];
    } else {
      chunks = [];
    }
  });

  process.stdin.on('end', () => {
    process.exit(0);
  });
}

// -------- 消息处理 --------

interface NativeMessage {
  action: 'ping' | 'check' | 'convert' | 'merge';
  inputPath: string;
  outputPath: string;
  ffmpegPath: string;
  format: string;
  quality: number;
}

async function handleMessage(msg: NativeMessage): Promise<void> {
  try {
    switch (msg.action) {
      case 'ping':
        const ffmpegOk = await checkFfmpeg(msg.ffmpegPath || 'ffmpeg');
        sendMessage({
          success: true,
          version: '1.0.0',
          ffmpegAvailable: ffmpegOk,
        });
        break;

      case 'check':
        const available = await checkFfmpeg(msg.ffmpegPath || 'ffmpeg');
        sendMessage({
          success: true,
          ffmpegAvailable: available,
        });
        break;

      case 'convert':
        await handleConvert(msg);
        break;

      case 'merge':
        await handleMerge(msg);
        break;

      default:
        sendMessage({ success: false, error: `未知操作: ${msg.action}` });
    }
  } catch (err: any) {
    sendMessage({ success: false, error: err.message || '操作失败' });
  }
}

// -------- FFmpeg 检查 --------

function checkFfmpeg(ffmpegPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    exec(`"${ffmpegPath}" -version`, (err) => {
      resolve(!err);
    });
  });
}

// -------- 音频转码 --------

async function handleConvert(msg: NativeMessage): Promise<void> {
  const ffmpegPath = msg.ffmpegPath || 'ffmpeg';
  const inputUrl = msg.inputPath;
  const outputName = msg.outputPath;

  // 验证 FFmpeg
  const ffmpegOk = await checkFfmpeg(ffmpegPath);
  if (!ffmpegOk) {
    sendMessage({
      success: false,
      error: `FFmpeg 不可用，请确保已安装 FFmpeg 并正确配置路径: ${ffmpegPath}`,
    });
    return;
  }

  // 准备临时目录
  const tempDir = join(tmpdir(), 'bilibgm-pro');
  if (!existsSync(tempDir)) {
    mkdirSync(tempDir, { recursive: true });
  }

  const tempId = randomBytes(8).toString('hex');
  const tempInput = join(tempDir, `input_${tempId}.m4a`);
  const tempOutput = join(tempDir, `${outputName || 'output'}_${tempId}.mp3`);

  try {
    // 下载音频
    sendMessage({ success: true, status: 'downloading' });
    await downloadFile(inputUrl, tempInput);

    // 转码
    const quality = msg.quality || 2;
    const cmd = `"${ffmpegPath}" -i "${tempInput}" -vn -codec:a libmp3lame -q:a ${quality} -y "${tempOutput}"`;

    await execPromise(cmd);

    // 清理临时输入文件
    try { unlinkSync(tempInput); } catch {}

    sendMessage({
      success: true,
      outputPath: tempOutput,
    });
  } catch (err: any) {
    // 清理
    try { unlinkSync(tempInput); } catch {}
    try { unlinkSync(tempOutput); } catch {}

    sendMessage({
      success: false,
      error: `转码失败: ${err.message}`,
    });
  }
}

// -------- 视频合并 --------

async function handleMerge(msg: NativeMessage): Promise<void> {
  const ffmpegPath = msg.ffmpegPath || 'ffmpeg';

  let urls: { videoUrl: string; audioUrl: string; outputName: string };
  try {
    urls = JSON.parse(msg.inputPath);
  } catch {
    sendMessage({ success: false, error: 'merge 参数解析失败' });
    return;
  }

  // 验证 FFmpeg
  const ffmpegOk = await checkFfmpeg(ffmpegPath);
  if (!ffmpegOk) {
    sendMessage({
      success: false,
      error: `FFmpeg 不可用: ${ffmpegPath}`,
    });
    return;
  }

  const tempDir = join(tmpdir(), 'bilibgm-pro');
  if (!existsSync(tempDir)) {
    mkdirSync(tempDir, { recursive: true });
  }

  const tempId = randomBytes(8).toString('hex');
  const tempVideo = join(tempDir, `video_${tempId}.m4s`);
  const tempAudio = join(tempDir, `audio_${tempId}.m4s`);
  const tempOutput = join(tempDir, `${urls.outputName || 'output'}_${tempId}.mp4`);

  try {
    // 下载视频和音频
    sendMessage({ success: true, status: 'downloading' });
    await Promise.all([
      downloadFile(urls.videoUrl, tempVideo),
      downloadFile(urls.audioUrl, tempAudio),
    ]);

    // 合并
    const cmd = `"${ffmpegPath}" -i "${tempVideo}" -i "${tempAudio}" -c copy -y "${tempOutput}"`;
    await execPromise(cmd);

    // 清理
    try { unlinkSync(tempVideo); } catch {}
    try { unlinkSync(tempAudio); } catch {}

    sendMessage({
      success: true,
      outputPath: tempOutput,
    });
  } catch (err: any) {
    try { unlinkSync(tempVideo); } catch {}
    try { unlinkSync(tempAudio); } catch {}
    try { unlinkSync(tempOutput); } catch {}

    sendMessage({
      success: false,
      error: `合并失败: ${err.message}`,
    });
  }
}

// -------- 辅助函数 --------

function downloadFile(url: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // 使用 PowerShell 下载 (Windows)
    const ps = `powershell -Command "Invoke-WebRequest -Uri '${url}' -OutFile '${outputPath}' -Headers @{'Referer'='https://www.bilibili.com'}"`;

    exec(ps, { timeout: 300000 }, (err) => {
      if (err) {
        // 尝试用 curl 作为备选
        const curl = `curl -L -o "${outputPath}" -H "Referer: https://www.bilibili.com" "${url}"`;
        exec(curl, { timeout: 300000 }, (err2) => {
          if (err2) reject(new Error(`文件下载失败: ${err2.message}`));
          else resolve();
        });
      } else {
        resolve();
      }
    });
  });
}

function execPromise(cmd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(cmd, { timeout: 600000 }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr || err.message));
      else resolve(stdout);
    });
  });
}

// -------- 启动 --------
readMessages();

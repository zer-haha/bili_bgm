import React, { useState, useEffect } from 'react';
import type { VideoInfo, Message } from '@/types';

interface Props {
  videoInfo: VideoInfo | null;
  loading: boolean;
  error: string | null;
  isBiliPage: boolean;
  sendMessage: <T = any>(msg: Message) => Promise<T>;
}

interface Stream {
  id: number;
  url: string;
  bandwidth: number;
  codecs: string;
  width?: number;
  height?: number;
  qualityName: string;
  size?: string;
}

export default function MainPanel({ videoInfo, loading, error, isBiliPage, sendMessage }: Props) {
  const [videoStreams, setVideoStreams] = useState<Stream[]>([]);
  const [audioStreams, setAudioStreams] = useState<Stream[]>([]);
  const [fetching, setFetching] = useState(false);
  const [dl, setDl] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    if (!videoInfo) return;
    (async () => {
      setFetching(true);
      try {
        const r: any = await sendMessage({ type: 'GET_DASH_STREAMS', data: { bvid: videoInfo.bvid, cid: videoInfo.cid } });
        if (r.success) {
          setVideoStreams(r.data.video || []);
          setAudioStreams(r.data.audio || []);
        }
      } catch {}
      setFetching(false);
    })();
  }, [videoInfo, sendMessage]);

  const download = async (s: Stream, ext: string) => {
    if (!videoInfo) return;
    const dlKey = `${ext}-${s.id}`;
    setDl(dlKey);
    setMsg(null);
    try {
      const resp = await fetch(s.url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);

      const name = `${videoInfo.title} [${s.qualityName}]`.replace(/[\\/:*?"<>|]/g, '_').substring(0, 150);
      await new Promise<void>((resolve, reject) => {
        chrome.downloads.download({ url: blobUrl, filename: `${name}.${ext}`, saveAs: true }, () => {
          if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
          else resolve();
        });
      });

      setMsg({ text: '下载已开始', ok: true });
      setTimeout(() => URL.revokeObjectURL(blobUrl), 120_000);
    } catch (e: any) {
      setMsg({ text: e.message || '下载失败', ok: false });
    }
    setDl(null);
  };

  if (loading) {
    return <div className="p-4 space-y-3"><div className="skeleton h-24 rounded-xl" /><div className="skeleton h-4 w-3/4 rounded" /><div className="skeleton h-10 rounded-xl" /></div>;
  }

  if (!isBiliPage) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-400"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center">请打开B站视频页面</p>
      </div>
    );
  }

  if (!videoInfo) {
    return <div className="flex flex-col items-center justify-center h-full p-6"><p className="text-sm text-red-500">{error || '无法获取视频信息'}</p></div>;
  }

  return (
    <div className="p-3 space-y-3 pb-4">
      <div className="card p-3">
        <div className="flex gap-3">
          <div className="w-28 h-18 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100 dark:bg-gray-700">
            <img src={videoInfo.pic} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold leading-snug line-clamp-2 text-gray-800 dark:text-gray-200">{videoInfo.title}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-gray-500 truncate">{videoInfo.owner.name}</span>
              <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-700 rounded px-1.5 py-0.5">{videoInfo.bvid}</span>
            </div>
            {videoInfo.stat && (
              <div className="flex gap-3 mt-1 text-[10px] text-gray-400">
                <span>{fmt(videoInfo.stat.view)}播放</span>
                <span>{videoInfo.stat.like}赞</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">BGM 音频</span>
          {fetching && <span className="text-[10px] text-gray-400">加载中...</span>}
        </div>
        {audioStreams.length > 0 ? (
          <div className="space-y-1.5">
            {audioStreams.map((s) => (
              <button
                key={`a-${s.id}`}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
                disabled={dl === `m4a-${s.id}`}
                onClick={() => download(s, 'm4a')}
              >
                <div>
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{s.qualityName}</span>
                  <span className="text-[10px] text-gray-400 ml-2">{s.codecs}</span>
                </div>
                <div className="flex items-center gap-2">
                  {s.size && <span className="text-[10px] text-gray-400">{s.size}</span>}
                  <span className="text-xs text-blue-500 font-medium">{dl === `m4a-${s.id}` ? '下载中...' : '下载'}</span>
                </div>
              </button>
            ))}
          </div>
        ) : !fetching ? <p className="text-xs text-gray-400">未找到音频流</p> : null}
      </div>

      <div className="card p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">视频</span>
        </div>
        {videoStreams.length > 0 ? (
          <div className="space-y-1.5">
            {videoStreams.map((s) => (
              <button
                key={`v-${s.id}`}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
                disabled={dl === `m4s-${s.id}`}
                onClick={() => download(s, 'm4s')}
              >
                <div>
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{s.qualityName}</span>
                  <span className="text-[10px] text-gray-400 ml-2">{s.codecs}</span>
                  {s.width && <span className="text-[10px] text-gray-400 ml-1">{s.width}x{s.height}</span>}
                </div>
                <div className="flex items-center gap-2">
                  {s.size && <span className="text-[10px] text-gray-400">{s.size}</span>}
                  <span className="text-xs text-blue-500 font-medium">{dl === `m4s-${s.id}` ? '下载中...' : '下载'}</span>
                </div>
              </button>
            ))}
          </div>
        ) : !fetching ? <p className="text-xs text-gray-400">未找到视频流</p> : null}
      </div>

      {msg && (
        <div className={`text-xs px-3 py-2 rounded-lg ${msg.ok ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'}`}>
          {msg.text}
        </div>
      )}
    </div>
  );
}

function fmt(n: number) {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`;
  return String(n);
}

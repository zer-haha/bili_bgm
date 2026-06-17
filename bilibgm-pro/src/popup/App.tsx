import React, { useState, useEffect, useCallback } from 'react';
import type { VideoInfo, ParsedUrl, AppSettings, Message } from '@/types';
import { DEFAULT_SETTINGS } from '@/types';
import MainPanel from './MainPanel';

export default function App() {
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [parsed, setParsed] = useState<ParsedUrl | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isBiliPage, setIsBiliPage] = useState(false);
  const [currentUrl, setCurrentUrl] = useState('');

  const sendMessage = useCallback(async <T = any>(msg: Message): Promise<T> => {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(msg, (resp) => {
        if (chrome.runtime.lastError) {
          resolve({ success: false, error: chrome.runtime.lastError.message } as any);
          return;
        }
        resolve(resp as T);
      });
    });
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const tabResp = await sendMessage<any>({ type: 'GET_CURRENT_TAB_INFO' });
        if (tabResp.success) {
          setCurrentUrl(tabResp.data.url || '');
          setIsBiliPage(tabResp.data.isBiliPage);
          setParsed(tabResp.data.parsed);
          if (tabResp.data.videoInfo) setVideoInfo(tabResp.data.videoInfo);
          if (tabResp.data.parseError) setError(tabResp.data.parseError);
        } else {
          setError(tabResp.error || '获取页面信息失败');
        }
      } catch (err: any) {
        setError(err.message || '初始化失败');
      } finally {
        setLoading(false);
      }
    })();
  }, [sendMessage]);

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-[#0f0f1a]">
      <header className="px-4 py-2.5 flex items-center gap-2.5 border-b border-gray-200/50 dark:border-gray-700/50 shrink-0">
        <div className="w-7 h-7 rounded-lg bili-gradient flex items-center justify-center shadow-sm">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
          </svg>
        </div>
        <div className="flex-1">
          <h1 className="text-sm font-bold text-gray-800 dark:text-gray-200">B站下载助手</h1>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <MainPanel
          videoInfo={videoInfo}
          loading={loading}
          error={error}
          isBiliPage={isBiliPage}
          sendMessage={sendMessage}
        />
      </main>
    </div>
  );
}

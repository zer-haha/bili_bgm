import React, { useState, useEffect } from 'react';
import type { AppSettings } from '@/types';
import { DEFAULT_SETTINGS } from '@/types';

export default function OptionsPage() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    chrome.storage.local.get('settings', (result) => {
      if (result.settings) {
        setSettings({ ...DEFAULT_SETTINGS, ...result.settings });
      }
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    chrome.storage.local.set({ settings }, () => {
      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  };

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0f0f1a] flex items-center justify-center">
        <div className="text-gray-400">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0f0f1a] py-8">
      <div className="max-w-2xl mx-auto px-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-2xl bili-gradient flex items-center justify-center shadow-lg shadow-bili-pink/20">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">BiliBGM Pro 设置</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">配置你的下载偏好</p>
          </div>
        </div>

        {/* Settings Sections */}
        <div className="space-y-6">
          {/* 增强模式 */}
          <Section title="增强模式">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-5 space-y-4 border border-gray-100 dark:border-gray-700/50">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300">启用增强模式</div>
                  <div className="text-xs text-gray-500 mt-0.5">使用本地 FFmpeg 进行 MP3 转码和 MP4 合并</div>
                </div>
                <Toggle value={settings.enableEnhancedMode} onChange={(v) => updateSetting('enableEnhancedMode', v)} />
              </div>

              {settings.enableEnhancedMode && (
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">
                    FFmpeg 路径
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 rounded-lg text-sm bg-gray-100 dark:bg-gray-700 border border-transparent focus:border-bili-pink/50 focus:outline-none text-gray-800 dark:text-gray-200"
                    value={settings.ffmpegPath}
                    onChange={(e) => updateSetting('ffmpegPath', e.target.value)}
                    placeholder="ffmpeg"
                  />
                </div>
              )}
            </div>
          </Section>

          {/* 下载设置 */}
          <Section title="下载设置">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-5 space-y-4 border border-gray-100 dark:border-gray-700/50">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">默认音频格式</label>
                  <select
                    className="w-full px-3 py-2 rounded-lg text-sm bg-gray-100 dark:bg-gray-700 border border-transparent focus:outline-none text-gray-800 dark:text-gray-200"
                    value={settings.defaultAudioFormat}
                    onChange={(e) => updateSetting('defaultAudioFormat', e.target.value as any)}
                  >
                    <option value="mp3">MP3 (需增强模式)</option>
                    <option value="m4a">M4A (纯浏览器)</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">默认视频格式</label>
                  <select
                    className="w-full px-3 py-2 rounded-lg text-sm bg-gray-100 dark:bg-gray-700 border border-transparent focus:outline-none text-gray-800 dark:text-gray-200"
                    value={settings.defaultVideoFormat}
                    onChange={(e) => updateSetting('defaultVideoFormat', e.target.value as any)}
                  >
                    <option value="mp4">MP4</option>
                    <option value="m4s">M4S</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">文件命名模板</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 rounded-lg text-sm bg-gray-100 dark:bg-gray-700 border border-transparent focus:border-bili-pink/50 focus:outline-none text-gray-800 dark:text-gray-200"
                  value={settings.filenameTemplate}
                  onChange={(e) => updateSetting('filenameTemplate', e.target.value)}
                />
                <p className="text-xs text-gray-400 mt-1">
                  变量: [title] [up] [bvid] [aid] [page] [pageName] [quality]
                </p>
              </div>
            </div>
          </Section>

          {/* 其他 */}
          <Section title="其他">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-5 space-y-4 border border-gray-100 dark:border-gray-700/50">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300">悬浮下载按钮</div>
                  <div className="text-xs text-gray-500">在B站视频页显示悬浮快捷按钮</div>
                </div>
                <Toggle value={settings.showFloatButton} onChange={(v) => updateSetting('showFloatButton', v)} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300">保留原始 M4A</div>
                  <div className="text-xs text-gray-500">转码后保留原始 m4a 文件</div>
                </div>
                <Toggle value={settings.keepOriginalM4a} onChange={(v) => updateSetting('keepOriginalM4a', v)} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300">自动打开下载目录</div>
                  <div className="text-xs text-gray-500">下载完成后自动打开保存位置</div>
                </div>
                <Toggle value={settings.autoOpenDownloadDir} onChange={(v) => updateSetting('autoOpenDownloadDir', v)} />
              </div>
            </div>
          </Section>
        </div>

        {/* Save Button */}
        <div className="mt-8">
          <button
            className={`w-full py-3 rounded-xl font-medium text-sm transition-all duration-200 ${
              saved ? 'bg-green-500 text-white' : 'btn-primary'
            }`}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? '保存中...' : saved ? '✓ 已保存' : '保存设置'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2 px-1">{title}</h2>
      {children}
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      className={`relative w-11 h-6 rounded-full transition-all duration-200 ${
        value ? 'bg-bili-pink' : 'bg-gray-300 dark:bg-gray-600'
      }`}
      onClick={() => onChange(!value)}
    >
      <div
        className="absolute top-0.5 rounded-full bg-white shadow-sm transition-all duration-200"
        style={{
          width: '20px',
          height: '20px',
          left: value ? '22px' : '2px',
        }}
      />
    </button>
  );
}

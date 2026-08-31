import {
  Bot,
  Check,
  ChevronRight,
  CircleCheckBig,
  Cpu,
  FolderOpen,
  Gamepad2,
  HardDrive,
  Image,
  Moon,
  RefreshCw,
  Save,
  Settings2,
  Sparkles,
  Sun,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import type {
  AppSettings,
  ProjectRecord,
  RuntimeStatus,
} from '../../shared/contracts';
import { formatRelative, runtimeLabel, toMessage } from '../ui';
import { FrameRateControl } from './FrameRateControl';

interface PersonalPageProps {
  settings: AppSettings;
  runtime: RuntimeStatus;
  projects: readonly ProjectRecord[];
  onSaved: (settings: AppSettings) => void;
  onRuntime: (runtime: RuntimeStatus) => void;
  onOpenAdvanced: () => void;
}

export function PersonalPage({
  settings,
  runtime,
  projects,
  onSaved,
  onRuntime,
  onOpenAdvanced,
}: PersonalPageProps) {
  const [draft, setDraft] = useState(settings);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => setDraft(settings), [settings]);

  const selectedModel = useMemo(
    () => runtime.models.find((item) => item.model === draft.defaultModel),
    [draft.defaultModel, runtime.models],
  );
  const efforts = selectedModel?.efforts.length
    ? selectedModel.efforts
    : ['minimal', 'low', 'medium', 'high', 'xhigh'];
  const completedProjects = projects.filter((project) => project.status === 'completed').length;
  const activeProjects = projects.filter((project) => (
    project.status === 'running' || project.status === 'waiting'
  )).length;
  const accountLabel = runtime.account?.email ?? '本地创作者';
  const creatorName = runtime.account?.email?.split('@')[0] || 'LoopSeed Creator';
  const creatorInitial = creatorName.trim().charAt(0).toUpperCase() || 'L';
  const dirty = settings.defaultWorkspace !== draft.defaultWorkspace
    || settings.defaultModel !== draft.defaultModel
    || settings.defaultEffort !== draft.defaultEffort
    || settings.defaultTargetFrameRate !== draft.defaultTargetFrameRate
    || settings.theme !== draft.theme;

  async function chooseDirectory() {
    const directory = await window.loopseed.chooseDirectory();
    if (directory) {
      setDraft((current) => ({ ...current, defaultWorkspace: directory }));
      setMessage('已选择新的默认保存位置，保存后生效。');
    }
  }

  async function refreshRuntime() {
    setRefreshing(true);
    setMessage('');
    try {
      onRuntime(await window.loopseed.refreshRuntime());
      setMessage('Codex 连接状态已刷新。');
    } catch (error) {
      setMessage(toMessage(error));
    } finally {
      setRefreshing(false);
    }
  }

  async function save() {
    setBusy(true);
    setMessage('');
    try {
      const saved = await window.loopseed.saveSettings(draft);
      setDraft(saved);
      onSaved(saved);
      setMessage('个人偏好已保存，后续新建游戏会使用这些默认值。');
    } catch (error) {
      setMessage(toMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="personal-page" aria-labelledby="personal-title">
      <header className="personal-heading">
        <div>
          <span>LOCAL CREATOR PROFILE</span>
          <h1 id="personal-title">我的 LoopSeed</h1>
          <p>管理这台设备上的创作者身份、Codex 连接和游戏制作默认值。</p>
        </div>
        <button className="secondary-button personal-advanced-button" type="button" onClick={onOpenAdvanced}>
          <Settings2 size={15} /> 高级设置
        </button>
      </header>

      <div className="personal-overview">
        <article className="creator-profile-card">
          <div className="creator-avatar" aria-hidden="true">
            <span>{creatorInitial}</span>
            <Sparkles size={18} />
          </div>
          <div className="creator-copy">
            <span>LOCAL PROFILE</span>
            <h2>{creatorName}</h2>
            <p>{accountLabel}</p>
          </div>
          <div className="creator-local-badge">
            <HardDrive size={13} /> 仅保存在本机
          </div>
          <dl className="creator-stats">
            <div><dt>游戏</dt><dd>{projects.length}</dd></div>
            <div><dt>制作中</dt><dd>{activeProjects}</dd></div>
            <div><dt>已完成</dt><dd>{completedProjects}</dd></div>
          </dl>
        </article>

        <article className={`personal-runtime-card state-${runtime.state}`}>
          <div className="personal-card-heading">
            <div className="personal-card-icon"><Bot size={18} /></div>
            <div>
              <span>CODEX CONNECTION</span>
              <h2>制作引擎</h2>
            </div>
            <span className={`runtime-dot state-${runtime.state}`} />
          </div>
          <strong className="runtime-summary">{runtimeLabel(runtime)}</strong>
          <p>{runtime.version ?? '等待读取 Codex 版本'}</p>
          <div className="runtime-capabilities" aria-label="运行时能力">
            <span className={runtime.models.length ? 'is-ready' : ''}>
              <Cpu size={12} /> {runtime.models.length} 个模型
            </span>
            <span className={runtime.capabilities.imageGeneration || runtime.capabilities.externalImageGeneration ? 'is-ready' : ''}>
              <Image size={12} /> 图像生成
            </span>
          </div>
          <button className="secondary-button compact" type="button" disabled={refreshing} onClick={() => void refreshRuntime()}>
            <RefreshCw size={13} className={refreshing ? 'spin' : ''} />
            {refreshing ? '刷新中…' : '刷新连接'}
          </button>
        </article>
      </div>

      <div className="personal-content-grid">
        <section className="personal-preferences" aria-labelledby="preferences-title">
          <header className="personal-section-heading">
            <div>
              <span>CREATION DEFAULTS</span>
              <h2 id="preferences-title">制作默认值</h2>
              <p>这些设置会成为每个新游戏的起点，项目内仍然可以单独调整。</p>
            </div>
            {dirty ? <span className="unsaved-badge">未保存</span> : <span className="saved-badge"><Check size={12} /> 已同步</span>}
          </header>

          <div className="personal-form-grid">
            <label className="personal-field personal-field-wide">
              <span>默认保存位置</span>
              <div className="personal-path-control">
                <input
                  value={draft.defaultWorkspace}
                  onChange={(event) => setDraft((current) => ({
                    ...current,
                    defaultWorkspace: event.target.value,
                  }))}
                />
                <button type="button" onClick={() => void chooseDirectory()}>
                  <FolderOpen size={14} /> 选择文件夹
                </button>
              </div>
            </label>

            <label className="personal-field">
              <span>默认模型</span>
              <select
                value={draft.defaultModel ?? ''}
                onChange={(event) => {
                  const model = runtime.models.find((item) => item.model === event.target.value);
                  setDraft((current) => ({
                    ...current,
                    defaultModel: event.target.value || null,
                    defaultEffort: model?.defaultEffort ?? current.defaultEffort,
                  }));
                }}
              >
                <option value="">使用 Codex 默认模型</option>
                {runtime.models.map((item) => (
                  <option value={item.model} key={item.id}>{item.displayName}</option>
                ))}
              </select>
            </label>

            <label className="personal-field">
              <span>默认推理强度</span>
              <select
                value={draft.defaultEffort}
                onChange={(event) => setDraft((current) => ({
                  ...current,
                  defaultEffort: event.target.value,
                }))}
              >
                {efforts.map((effort) => (
                  <option value={effort} key={effort}>{effort.toUpperCase()}</option>
                ))}
              </select>
            </label>
          </div>

          <FrameRateControl
            value={draft.defaultTargetFrameRate}
            onChange={(defaultTargetFrameRate) => setDraft((current) => ({
              ...current,
              defaultTargetFrameRate,
            }))}
          />

          <div className="personal-theme-setting">
            <div>
              <span>界面主题</span>
              <p>选择适合当前工作环境的界面对比度。</p>
            </div>
            <div className="personal-theme-options" role="radiogroup" aria-label="界面主题">
              <button
                type="button"
                role="radio"
                aria-checked={draft.theme === 'light'}
                className={draft.theme === 'light' ? 'is-active' : ''}
                onClick={() => setDraft((current) => ({ ...current, theme: 'light' }))}
              >
                <Sun size={15} /> 浅色
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={draft.theme === 'dark'}
                className={draft.theme === 'dark' ? 'is-active' : ''}
                onClick={() => setDraft((current) => ({ ...current, theme: 'dark' }))}
              >
                <Moon size={15} /> 深色
              </button>
            </div>
          </div>

          <footer className="personal-save-row">
            <span role="status">{message}</span>
            <button className="primary-button" type="button" disabled={busy || !dirty} onClick={() => void save()}>
              <Save size={15} /> {busy ? '保存中…' : '保存个人偏好'}
            </button>
          </footer>
        </section>

        <aside className="personal-side-stack">
          <section className="personal-side-panel">
            <div className="personal-card-heading">
              <div className="personal-card-icon"><Gamepad2 size={18} /></div>
              <div>
                <span>LOCAL LIBRARY</span>
                <h2>本地游戏</h2>
              </div>
            </div>
            {projects[0] ? (
              <div className="personal-recent-project">
                <div className="recent-project-mark"><CircleCheckBig size={16} /></div>
                <div>
                  <strong>{projects[0].name}</strong>
                  <span>最近编辑 · {formatRelative(projects[0].updatedAt)}</span>
                </div>
              </div>
            ) : (
              <p className="personal-panel-empty">第一个游戏会出现在这里。</p>
            )}
            <dl className="personal-library-facts">
              <div><dt>工作区</dt><dd>{draft.defaultWorkspace}</dd></div>
              <div><dt>默认帧率</dt><dd>{draft.defaultTargetFrameRate} FPS</dd></div>
            </dl>
          </section>

          <button className="personal-advanced-panel" type="button" onClick={onOpenAdvanced}>
            <div>
              <Settings2 size={18} />
              <span>
                <strong>扩展与高级设置</strong>
                <small>媒体 API、Skills、MCP 和提示词</small>
              </span>
            </div>
            <ChevronRight size={17} />
          </button>
        </aside>
      </div>
    </section>
  );
}

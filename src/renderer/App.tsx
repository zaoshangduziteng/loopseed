import {
  FolderOpen,
  Menu,
  Moon,
  Settings,
  Sun,
  X,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import type {
  AgentEvent,
  AppSettings,
  ApprovalAnswers,
  ApprovalDecision,
  ApprovalRequest,
  BootstrapPayload,
  CreateProjectInput,
  ProjectRecord,
  RuntimeStatus,
  TargetFrameRate,
} from '../shared/contracts';
import { ApprovalModal } from './components/ApprovalModal';
import { BrandMark } from './components/BrandMark';
import { Composer } from './components/Composer';
import { DashboardHome } from './components/DashboardHome';
import { EventStream } from './components/EventStream';
import { Inspector } from './components/Inspector';
import { NewProjectModal } from './components/NewProjectModal';
import { PersonalPage } from './components/PersonalPage';
import { Pipeline } from './components/Pipeline';
import { ProjectLibrary } from './components/ProjectLibrary';
import { ProjectRail } from './components/ProjectRail';
import { SettingsModal } from './components/SettingsModal';
import { getBuildBlockReason, WorkbenchNotice } from './components/WorkbenchNotice';
import { PROJECT_STATUS_LABELS, runtimeLabel, toMessage } from './ui';

type EventMap = Record<string, AgentEvent[]>;
type AppView = 'home' | 'projects' | 'personal' | 'project';

export function App() {
  const [bootstrap, setBootstrap] = useState<BootstrapPayload | null>(null);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [runtime, setRuntime] = useState<RuntimeStatus | null>(null);
  const [activeView, setActiveView] = useState<AppView>('home');
  const [selectedId, setSelectedId] = useState<string>();
  const [events, setEvents] = useState<EventMap>({});
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newProjectIdea, setNewProjectIdea] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [railOpen, setRailOpen] = useState(false);
  const [railCollapsed, setRailCollapsed] = useState(
    () => window.localStorage.getItem('loopseed:rail-collapsed') === 'true',
  );
  const [error, setError] = useState('');
  const [refreshSignal, setRefreshSignal] = useState(0);
  const [refreshingRuntime, setRefreshingRuntime] = useState(false);
  const [loadingError, setLoadingError] = useState('');

  const selected = useMemo(
    () => projects.find((project) => project.id === selectedId),
    [projects, selectedId],
  );
  const imageGenerationAvailable = Boolean(
    runtime?.capabilities.imageGeneration || runtime?.capabilities.externalImageGeneration,
  );
  const autoStartAvailable = Boolean(
    runtime?.state === 'ready'
      && runtime.account
      && runtime.models.length > 0
      && imageGenerationAvailable,
  );
  const autoStartMessage = !runtime || runtime.state !== 'ready'
    ? runtime?.error ?? '本地 Codex 运行时尚未就绪，可以先创建工作区。'
    : !runtime.account
      ? '本地 Codex 尚未连接账户，可以先创建工作区。'
      : runtime.models.length === 0
        ? '本地 Codex 尚未返回可用模型，可以先创建工作区。'
        : !imageGenerationAvailable
          ? '图片生成能力尚未就绪，可以先创建工作区。'
          : `${runtime.account.email ?? 'Codex 已连接'} · 图片素材能力已就绪`;
  const buildBlockReason = runtime
    ? getBuildBlockReason(runtime, imageGenerationAvailable)
    : '本地 Codex 状态尚未载入。';
  const approvalPending = Boolean(
    selected && approvals.some((approval) => approval.projectId === selected.id),
  );

  const loadBootstrap = useCallback(async () => {
    setLoadingError('');
    try {
      const state = await window.loopseed.bootstrap();
      setBootstrap(state);
      setProjects(state.projects);
      setSettings(state.settings);
      setRuntime(state.runtime);
      setEvents(state.events ?? {});
      setSelectedId((current) =>
        current && state.projects.some((project) => project.id === current)
          ? current
          : undefined,
      );
    } catch (reason) {
      setLoadingError(toMessage(reason));
    }
  }, []);

  useEffect(() => {
    void loadBootstrap();

    const stopAgentEvents = window.loopseed.onAgentEvent((event) => {
      setEvents((current) => ({
        ...current,
        [event.projectId]: mergeEvent(current[event.projectId] ?? [], event),
      }));
      if (event.kind === 'file' || event.kind === 'lifecycle') {
        setRefreshSignal((value) => value + 1);
      }
    });

    const stopProjects = window.loopseed.onProjectChanged((project) => {
      setProjects((current) => upsertProject(current, project));
    });

    const stopRuntime = window.loopseed.onRuntimeChanged((status) => {
      setRuntime(status);
    });

    const stopApprovals = window.loopseed.onApproval((approval) => {
      setApprovals((current) =>
        current.some((item) => item.token === approval.token)
          ? current
          : [...current, approval],
      );
    });
    const stopApprovalClosed = window.loopseed.onApprovalClosed((token) => {
      setApprovals((current) => current.filter((item) => item.token !== token));
    });

    return () => {
      stopAgentEvents();
      stopProjects();
      stopRuntime();
      stopApprovals();
      stopApprovalClosed();
    };
  }, [loadBootstrap]);

  useEffect(() => {
    if (!settings) return;
    document.documentElement.dataset.theme = settings.theme;
    document.documentElement.style.colorScheme = settings.theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', settings.theme === 'dark' ? '#181818' : '#f7f7f8');
  }, [settings]);

  useEffect(() => {
    window.localStorage.setItem('loopseed:rail-collapsed', String(railCollapsed));
  }, [railCollapsed]);

  async function createProject(input: CreateProjectInput, startAgent: boolean) {
    const project = await window.loopseed.createProject(input);
    setProjects((current) => upsertProject(current, project));
    setSelectedId(project.id);
    setActiveView('project');
    setRailOpen(false);

    if (startAgent && runtime && settings) {
      const selectedModel = runtime.models.find((item) => item.model === input.model);
      try {
        const running = await window.loopseed.runProject({
          projectId: project.id,
          prompt: input.idea,
          model: input.model ?? null,
          effort: selectedModel?.defaultEffort ?? settings.defaultEffort,
          targetFrameRate: input.targetFrameRate ?? settings.defaultTargetFrameRate,
        });
        setProjects((current) => upsertProject(current, running));
      } catch (reason) {
        setError(`项目已创建，但首次制作没有启动：${toMessage(reason)}`);
      }
    }

    setShowCreate(false);
    setNewProjectIdea('');
  }

  function openCreate(idea = '') {
    setNewProjectIdea(idea);
    setShowCreate(true);
  }

  function openProject(project: ProjectRecord) {
    setSelectedId(project.id);
    setActiveView('project');
    setRailOpen(false);
  }

  async function runProject(
    prompt: string,
    model: string | null,
    effort: string | null,
    targetFrameRate: TargetFrameRate,
  ) {
    if (!selected || !runtime) return;
    setError('');
    if (runtime.state !== 'ready') {
      setError('Codex App Server 尚未就绪，请先检查运行时或完成登录。');
      setShowSettings(true);
      return;
    }
    if (!runtime.account) {
      setError('请先登录 ChatGPT，再启动游戏 Agent。');
      setShowSettings(true);
      return;
    }
    if (!runtime.capabilities.imageGeneration && !runtime.capabilities.externalImageGeneration) {
      setError('图像 API 与 Codex ImageGen 均不可用，请先在设置中配置图像服务或修复运行时。');
      setShowSettings(true);
      return;
    }
    try {
      const project = await window.loopseed.runProject({
        projectId: selected.id,
        prompt,
        model,
        effort,
        targetFrameRate,
      });
      setProjects((current) => upsertProject(current, project));
    } catch (reason) {
      setError(toMessage(reason));
    }
  }

  async function stopProject() {
    if (!selected) return;
    try {
      const project = await window.loopseed.stopProject(selected.id);
      setProjects((current) => upsertProject(current, project));
    } catch (reason) {
      setError(toMessage(reason));
    }
  }

  async function toggleTheme() {
    if (!settings) return;
    const theme = settings.theme === 'dark' ? 'light' : 'dark';
    setSettings((current) => (current ? { ...current, theme } : current));
    try {
      setSettings(await window.loopseed.saveSettings({ theme }));
    } catch (reason) {
      setError(toMessage(reason));
    }
  }

  async function refreshRuntimeStatus() {
    setRefreshingRuntime(true);
    try {
      setRuntime(await window.loopseed.refreshRuntime());
    } catch (reason) {
      setError(`无法重新检测本地 Codex：${toMessage(reason)}`);
    } finally {
      setRefreshingRuntime(false);
    }
  }

  async function resolveApproval(
    token: string,
    decision: ApprovalDecision,
    answers?: ApprovalAnswers,
  ) {
    await window.loopseed.resolveApproval(token, decision, answers);
    setApprovals((current) => current.filter((item) => item.token !== token));
  }

  if (!bootstrap || !settings || !runtime) {
    return (
      <main className="loading-screen">
        <div className="loading-brand">
          <BrandMark />
          <div><strong>LoopSeed</strong><small>PLAYABLE WORLD STUDIO</small></div>
        </div>
        {loadingError ? (
          <div className="loading-error" role="alert">
            <strong>无法连接桌面运行时</strong>
            <p>{loadingError}</p>
            <button className="primary-button" type="button" onClick={() => void loadBootstrap()}>
              重试连接
            </button>
          </div>
        ) : (
          <div className="loading-progress"><span /> 正在连接 Codex App Server…</div>
        )}
      </main>
    );
  }

  return (
    <div className={`app-shell${activeView === 'project' ? ' is-project-view' : ''}${railCollapsed ? ' is-rail-collapsed' : ''}`}>
      <ProjectRail
        activeView={activeView}
        projects={projects}
        selectedId={selectedId}
        runtime={runtime}
        open={railOpen}
        collapsed={railCollapsed}
        onClose={() => setRailOpen(false)}
        onToggleCollapsed={() => setRailCollapsed((current) => !current)}
        onHome={() => {
          setActiveView('home');
          setRailOpen(false);
        }}
        onProjects={() => {
          setActiveView('projects');
          setRailOpen(false);
        }}
        onPersonal={() => {
          setActiveView('personal');
          setRailOpen(false);
        }}
        onSelect={openProject}
        onCreate={() => openCreate()}
        onSettings={() => {
          setShowSettings(true);
          setRailOpen(false);
        }}
      />

      <main className="workspace">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            type="button"
            aria-label="打开项目导航"
            onClick={() => setRailOpen(true)}
          >
            <Menu size={18} />
          </button>
          <button
            className="runtime-status"
            type="button"
            title={runtime.error ?? runtimeLabel(runtime)}
            onClick={() => setShowSettings(true)}
          >
            <span className={`runtime-dot state-${runtime.state}`} />
            <span>{runtimeLabel(runtime)}</span>
          </button>

          <div className="topbar-project">
            <strong>
              {activeView === 'projects'
                ? '我的游戏'
                : activeView === 'personal'
                  ? '我的 LoopSeed'
                  : activeView === 'project' && selected
                    ? selected.name
                    : 'LoopSeed Studio'}
            </strong>
            {activeView === 'project' && selected ? (
              <span className={`status-chip status-${selected.status}`}>
                {PROJECT_STATUS_LABELS[selected.status]}
              </span>
            ) : null}
          </div>

          <div className="topbar-actions">
            <button
              className="icon-button"
              type="button"
              aria-label="在 Finder 中打开项目"
              title="在 Finder 中打开项目"
              disabled={activeView !== 'project' || !selected}
              onClick={() => activeView === 'project' && selected && void window.loopseed.revealProject(selected.id)}
            >
              <FolderOpen size={15} />
            </button>
            <button
              className="icon-button"
              type="button"
              aria-label="切换主题"
              title="切换主题"
              onClick={() => void toggleTheme()}
            >
              {settings.theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            <button
              className="icon-button"
              type="button"
              aria-label="打开设置"
              title="打开设置"
              onClick={() => setShowSettings(true)}
            >
              <Settings size={15} />
            </button>
          </div>
        </header>

        {activeView === 'project' && selected ? (
          <div className="production-layout">
            <section className="production-center">
              <Pipeline stage={selected.stage} status={selected.status} />
              <WorkbenchNotice
                project={selected}
                runtime={runtime}
                buildBlockReason={buildBlockReason}
                approvalPending={approvalPending}
                refreshingRuntime={refreshingRuntime}
                onFocusComposer={() => {
                  document.getElementById('agent-composer-input')?.focus();
                }}
                onOpenSettings={() => setShowSettings(true)}
                onRefreshRuntime={refreshRuntimeStatus}
              />
              <EventStream project={selected} events={events[selected.id] ?? []} />
              <Composer
                project={selected}
                models={runtime.models}
                settings={settings}
                imageGenerationAvailable={imageGenerationAvailable}
                disabled={Boolean(buildBlockReason)}
                disabledReason={buildBlockReason}
                onRun={runProject}
                onStop={stopProject}
              />
            </section>
            <Inspector
              project={selected}
              refreshSignal={refreshSignal}
              onError={setError}
            />
          </div>
        ) : activeView === 'projects' ? (
          <ProjectLibrary
            projects={projects}
            onCreate={() => openCreate()}
            onOpen={openProject}
            onReveal={(project) => void window.loopseed.revealProject(project.id)}
          />
        ) : activeView === 'personal' ? (
          <PersonalPage
            settings={settings}
            runtime={runtime}
            projects={projects}
            onSaved={setSettings}
            onRuntime={setRuntime}
            onOpenAdvanced={() => setShowSettings(true)}
          />
        ) : (
          <DashboardHome
            runtime={runtime}
            projects={projects}
            onCreate={openCreate}
            onSelect={openProject}
            onSettings={() => setShowSettings(true)}
          />
        )}
      </main>

      {showCreate ? (
        <NewProjectModal
          defaultDirectory={settings.defaultWorkspace}
          defaultModel={settings.defaultModel}
          defaultFrameRate={settings.defaultTargetFrameRate}
          initialIdea={newProjectIdea}
          imageGenerationAvailable={imageGenerationAvailable}
          autoStartAvailable={autoStartAvailable}
          autoStartMessage={autoStartMessage}
          models={runtime.models}
          onClose={() => {
            setShowCreate(false);
            setNewProjectIdea('');
          }}
          onCreate={createProject}
        />
      ) : null}

      {showSettings ? (
        <SettingsModal
          value={settings}
          runtime={runtime}
          onClose={() => setShowSettings(false)}
          onSaved={setSettings}
          onRuntime={setRuntime}
        />
      ) : null}

      {approvals[0] ? (
        <ApprovalModal
          key={approvals[0].token}
          approval={approvals[0]}
          pendingCount={approvals.length}
          onResolve={resolveApproval}
        />
      ) : null}

      {error ? (
        <div className="error-toast" role="alert">
          <span>{error}</span>
          <button type="button" aria-label="关闭错误提示" onClick={() => setError('')}>
            <X size={14} />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function upsertProject(
  projects: readonly ProjectRecord[],
  project: ProjectRecord,
): ProjectRecord[] {
  const next = projects.some((item) => item.id === project.id)
    ? projects.map((item) => (item.id === project.id ? project : item))
    : [project, ...projects];
  return [...next].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function mergeEvent(events: readonly AgentEvent[], incoming: AgentEvent): AgentEvent[] {
  const index = events.findIndex((event) => event.id === incoming.id);
  const next = [...events];
  if (index >= 0) {
    const previous = next[index]!;
    next[index] = {
      ...previous,
      ...incoming,
      message: incoming.isDelta
        ? `${previous.message}${incoming.message}`.slice(-120_000)
        : incoming.message,
    };
  } else {
    next.push(incoming);
  }
  return next
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    .slice(-500);
}

import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type {
  AgentEvent,
  AppSettings,
  ApprovalAnswers,
  ApprovalDecision,
  ApprovalRequest,
  BootstrapPayload,
  CreateProjectInput,
  FileReadResult,
  GameAssetRecord,
  ExtensionSettingsSnapshot,
  LoginStartResult,
  McpServerSetting,
  MediaCapability,
  MediaProviderSetting,
  MediaProviderTestResult,
  LoopSeedApi,
  PromptTemplateId,
  PromptTemplateSetting,
  ProjectInspectorPayload,
  ProjectRecord,
  RunProjectInput,
  RuntimeStatus,
  SaveMcpServerInput,
  SaveMediaProviderInput,
  SkillSetting,
} from '../shared/contracts.js';

function subscribe<T>(channel: string, listener: (payload: T) => void): () => void {
  const wrapped = (_event: Electron.IpcRendererEvent, payload: T) => listener(payload);
  ipcRenderer.on(channel, wrapped);
  return () => ipcRenderer.removeListener(channel, wrapped);
}

const api: LoopSeedApi = {
  bootstrap: () => ipcRenderer.invoke('loopseed:bootstrap') as Promise<BootstrapPayload>,
  refreshRuntime: () => ipcRenderer.invoke('loopseed:runtime:refresh') as Promise<RuntimeStatus>,
  startLogin: () => ipcRenderer.invoke('loopseed:runtime:login') as Promise<LoginStartResult>,
  logout: () => ipcRenderer.invoke('loopseed:runtime:logout') as Promise<RuntimeStatus>,
  chooseDirectory: () => ipcRenderer.invoke('loopseed:dialog:directory') as Promise<string | null>,
  createProject: (input: CreateProjectInput) =>
    ipcRenderer.invoke('loopseed:project:create', input) as Promise<ProjectRecord>,
  runProject: (input: RunProjectInput) =>
    ipcRenderer.invoke('loopseed:project:run', input) as Promise<ProjectRecord>,
  stopProject: (projectId: string) =>
    ipcRenderer.invoke('loopseed:project:stop', projectId) as Promise<ProjectRecord>,
  revealProject: (projectId: string) =>
    ipcRenderer.invoke('loopseed:project:reveal', projectId) as Promise<void>,
  importProjectAssets: (projectId: string) =>
    ipcRenderer.invoke('loopseed:project:assets:import', projectId) as Promise<GameAssetRecord[]>,
  importDroppedProjectAssets: (projectId: string, files: readonly unknown[]) => {
    if (!Array.isArray(files) || files.length === 0 || files.length > 50) {
      return Promise.reject(new Error('一次只能拖入 1–50 张图片'));
    }
    let paths: string[];
    try {
      paths = files.map((file) => webUtils.getPathForFile(file as File)).filter(Boolean);
    } catch {
      return Promise.reject(new Error('无法读取拖入文件的本地路径'));
    }
    if (paths.length !== files.length) return Promise.reject(new Error('拖入文件缺少本地路径'));
    return ipcRenderer.invoke('loopseed:project:assets:import-paths', projectId, paths) as Promise<GameAssetRecord[]>;
  },
  inspectProject: (projectId: string) =>
    ipcRenderer.invoke('loopseed:project:inspect', projectId) as Promise<ProjectInspectorPayload>,
  readProjectFile: (projectId: string, relativePath: string) =>
    ipcRenderer.invoke('loopseed:project:read', projectId, relativePath) as Promise<FileReadResult>,
  saveSettings: (patch: Partial<AppSettings>) =>
    ipcRenderer.invoke('loopseed:settings:save', patch) as Promise<AppSettings>,
  getExtensionSettings: () =>
    ipcRenderer.invoke('loopseed:extensions:get') as Promise<ExtensionSettingsSnapshot>,
  saveMediaProvider: (input: SaveMediaProviderInput) =>
    ipcRenderer.invoke('loopseed:media-provider:save', input) as Promise<MediaProviderSetting>,
  testMediaProvider: (capability: MediaCapability) =>
    ipcRenderer.invoke('loopseed:media-provider:test', capability) as Promise<MediaProviderTestResult>,
  listSkills: () => ipcRenderer.invoke('loopseed:skills:list') as Promise<SkillSetting[]>,
  setSkillEnabled: (input: { id: string; enabled: boolean }) =>
    ipcRenderer.invoke('loopseed:skills:set-enabled', input) as Promise<SkillSetting>,
  listMcpServers: () => ipcRenderer.invoke('loopseed:mcp:list') as Promise<McpServerSetting[]>,
  saveMcpServer: (input: SaveMcpServerInput) =>
    ipcRenderer.invoke('loopseed:mcp:save', input) as Promise<McpServerSetting>,
  removeMcpServer: (id: string) => ipcRenderer.invoke('loopseed:mcp:remove', id) as Promise<void>,
  listPromptTemplates: () =>
    ipcRenderer.invoke('loopseed:prompts:list') as Promise<PromptTemplateSetting[]>,
  savePromptTemplate: (input: { id: PromptTemplateId; content: string; enabled: boolean }) =>
    ipcRenderer.invoke('loopseed:prompts:save', input) as Promise<PromptTemplateSetting>,
  resetPromptTemplate: (id: PromptTemplateId) =>
    ipcRenderer.invoke('loopseed:prompts:reset', id) as Promise<PromptTemplateSetting>,
  resolveApproval: (token: string, decision: ApprovalDecision, answers?: ApprovalAnswers) =>
    ipcRenderer.invoke('loopseed:approval:resolve', token, decision, answers) as Promise<void>,
  onAgentEvent: (listener: (event: AgentEvent) => void) =>
    subscribe('loopseed:event:agent', listener),
  onProjectChanged: (listener: (project: ProjectRecord) => void) =>
    subscribe('loopseed:event:project', listener),
  onRuntimeChanged: (listener: (status: RuntimeStatus) => void) =>
    subscribe('loopseed:event:runtime', listener),
  onApproval: (listener: (approval: ApprovalRequest) => void) =>
    subscribe('loopseed:event:approval', listener),
  onApprovalClosed: (listener: (token: string) => void) =>
    subscribe('loopseed:event:approval-closed', listener),
  onAssetsChanged: (listener: (payload: { projectId: string; assets: GameAssetRecord[] }) => void) =>
    subscribe('loopseed:event:assets', listener),
};

contextBridge.exposeInMainWorld('loopseed', Object.freeze(api));

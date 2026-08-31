import {
  ArrowLeft,
  ArrowRight,
  Check,
  FolderOpen,
  Play,
  Sprout,
  Settings2,
  Sparkles,
} from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';

import type {
  CreateProjectInput,
  ModelOption,
  TargetFrameRate,
} from '../../shared/contracts';
import { DEFAULT_TARGET_FRAME_RATE } from '../../shared/contracts';
import { toMessage } from '../ui';
import { AssetRequirement } from './AssetRequirement';
import { FrameRateControl } from './FrameRateControl';
import { Modal } from './Modal';

interface NewProjectModalProps {
  defaultDirectory: string;
  defaultModel: string | null;
  defaultFrameRate: TargetFrameRate;
  initialIdea?: string;
  imageGenerationAvailable: boolean;
  autoStartAvailable: boolean;
  autoStartMessage: string;
  models: readonly ModelOption[];
  onClose: () => void;
  onCreate: (input: CreateProjectInput, startAgent: boolean) => Promise<void>;
}

const EXAMPLES = [
  {
    label: '末日生存',
    idea: '制作一个俯视角末日生存游戏，三种枪械，敌人会随波次进化。',
  },
  {
    label: '像素动作',
    idea: '制作一个横版像素动作游戏，包含二段跳、冲刺和三阶段 Boss。',
  },
  {
    label: '轻量塔防',
    idea: '制作一个轻量塔防游戏，三类防御塔、元素克制和十波敌人。',
  },
] as const;

type WizardStep = 'idea' | 'setup';
type PendingAction = 'create' | 'start' | null;

export function NewProjectModal({
  defaultDirectory,
  defaultModel,
  defaultFrameRate,
  initialIdea = '',
  imageGenerationAvailable,
  autoStartAvailable,
  autoStartMessage,
  models,
  onClose,
  onCreate,
}: NewProjectModalProps) {
  const [step, setStep] = useState<WizardStep>('idea');
  const [name, setName] = useState(() => suggestProjectName(initialIdea));
  const [idea, setIdea] = useState(initialIdea);
  const [parentDirectory, setParentDirectory] = useState(defaultDirectory);
  const [model, setModel] = useState(
    defaultModel ?? models.find((item) => item.isDefault)?.model ?? models[0]?.model ?? '',
  );
  const [targetFrameRate, setTargetFrameRate] = useState<TargetFrameRate>(
    defaultFrameRate ?? DEFAULT_TARGET_FRAME_RATE,
  );
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [error, setError] = useState('');
  const busy = pendingAction !== null;
  const activeModel = useMemo(
    () => models.find((item) => item.model === model),
    [model, models],
  );

  async function chooseDirectory() {
    const directory = await window.loopseed.chooseDirectory();
    if (directory) setParentDirectory(directory);
  }

  function continueToSetup() {
    if (!name.trim() || !idea.trim()) {
      setError('先为项目命名，并写下一句清晰的游戏创意。');
      return;
    }
    setError('');
    setStep('setup');
  }

  async function create(startAgent: boolean) {
    if (!name.trim() || !idea.trim() || !parentDirectory.trim()) {
      setError('请填写项目名称、游戏创意和保存位置。');
      return;
    }
    setPendingAction(startAgent ? 'start' : 'create');
    setError('');
    try {
      await onCreate({
        name: name.trim(),
        idea: idea.trim(),
        parentDirectory: parentDirectory.trim(),
        model: model || null,
        targetFrameRate,
      }, startAgent);
    } catch (reason) {
      setError(toMessage(reason));
    } finally {
      setPendingAction(null);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (step === 'idea') {
      continueToSetup();
      return;
    }
    void create(autoStartAvailable);
  }

  function chooseExample(example: (typeof EXAMPLES)[number]) {
    setIdea(example.idea);
    if (!name.trim()) setName(example.label);
  }

  return (
    <Modal
      eyebrow="NEW / PLAYABLE WORLD"
      title="种下一个新项目"
      description="两步确认创意和制作设置；LoopSeed 只会在你选择的独立目录中工作。"
      className="new-project-modal create-wizard-modal"
      initialFocusSelector="[data-create-autofocus]"
      onClose={busy ? undefined : onClose}
    >
      <div className="create-progress" aria-label="创建进度">
        <div className={step === 'idea' ? 'is-active' : 'is-complete'}>
          <span>{step === 'setup' ? <Check size={13} /> : '01'}</span>
          <p><strong>创意种子</strong><small>要做什么</small></p>
        </div>
        <i aria-hidden="true" />
        <div className={step === 'setup' ? 'is-active' : ''}>
          <span>02</span>
          <p><strong>制作设置</strong><small>在哪里开始</small></p>
        </div>
        <i aria-hidden="true" />
        <div>
          <span>03</span>
          <p><strong>Agent 启动</strong><small>进入工作台</small></p>
        </div>
      </div>

      <form className="create-wizard" onSubmit={submit}>
        {step === 'idea' ? (
          <section className="create-step create-idea-step" aria-labelledby="create-idea-heading">
            <header className="create-step-heading">
              <span><Sprout size={18} /></span>
              <div>
                <small>STEP 01 / CREATIVE BRIEF</small>
                <h3 id="create-idea-heading">先说清楚你想做什么</h3>
                <p>不用写完整策划。玩法、视角和最重要的体验足以让 Agent 开始。</p>
              </div>
            </header>

            <div className="create-idea-fields">
              <label className="create-field create-name-field">
                <span>项目名称</span>
                <input
                  value={name}
                  autoFocus
                  data-create-autofocus
                  maxLength={80}
                  placeholder="例如：Hearthvale"
                  onChange={(event) => setName(event.target.value)}
                />
                <small>用于工作区名称，之后仍可在项目文件中修改。</small>
              </label>

              <label className="create-field create-brief-field">
                <span>游戏创意</span>
                <textarea
                  value={idea}
                  rows={8}
                  maxLength={12_000}
                  placeholder="例如：一个忍者猫收集寿司、躲避机关的平台跳跃游戏。操作要轻快，关卡在三分钟内完成……"
                  onChange={(event) => setIdea(event.target.value)}
                  onKeyDown={(event) => {
                    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                      event.preventDefault();
                      continueToSetup();
                    }
                  }}
                />
                <small>{idea.length.toLocaleString()} / 12,000</small>
              </label>
            </div>

            <div className="create-starters" aria-label="创意示例">
              <span>不知道怎么写？从一个方向开始</span>
              <div>
                {EXAMPLES.map((example) => (
                  <button
                    type="button"
                    key={example.label}
                    onClick={() => chooseExample(example)}
                  >
                    {example.label}
                  </button>
                ))}
              </div>
            </div>
          </section>
        ) : (
          <section className="create-step create-setup-step" aria-labelledby="create-setup-heading">
            <header className="create-step-heading">
              <span><Settings2 size={18} /></span>
              <div>
                <small>STEP 02 / BUILD SETUP</small>
                <h3 id="create-setup-heading">确认工作区与制作方式</h3>
                <p>默认值已经可以直接开始；只有保存位置需要你确认。</p>
              </div>
            </header>

            <div className="create-project-summary">
              <span><Sprout size={18} /></span>
              <div>
                <small>即将创建</small>
                <strong>{name}</strong>
                <p>{idea}</p>
              </div>
              <button type="button" onClick={() => setStep('idea')}>修改创意</button>
            </div>

            <div className="create-setup-layout">
              <div className="create-setup-fields">
                <label className="create-field">
                  <span>保存位置</span>
                  <div className="path-control">
                    <input
                      value={parentDirectory}
                      placeholder="选择父目录"
                      onChange={(event) => setParentDirectory(event.target.value)}
                    />
                    <button type="button" onClick={() => void chooseDirectory()}>
                      <FolderOpen size={15} /> 选择
                    </button>
                  </div>
                  <small>将自动新建“{name || '项目名称'}”文件夹，不会修改其他工作区。</small>
                </label>

                <label className="create-field">
                  <span>Agent 模型</span>
                  <select
                    value={model}
                    disabled={models.length === 0}
                    onChange={(event) => setModel(event.target.value)}
                  >
                    {models.length === 0 ? <option value="">等待本地运行时提供模型</option> : null}
                    {models.map((item) => (
                      <option value={item.model} key={item.id}>
                        {item.displayName} · {item.defaultEffort.toUpperCase()}
                      </option>
                    ))}
                  </select>
                  <small>{activeModel?.description ?? 'LoopSeed 会使用当前本地运行时的默认模型。'}</small>
                </label>

                <FrameRateControl value={targetFrameRate} onChange={setTargetFrameRate} />
              </div>

              <aside className="create-launch-card" aria-label="创建后流程">
                <span>AFTER CREATE</span>
                <h4>从空目录到可玩版本</h4>
                <ol>
                  <li><i>01</i><p><strong>建立独立工作区</strong><small>写入项目规则与基础结构</small></p></li>
                  <li><i>02</i><p><strong>启动制作 Agent</strong><small>拆解、实现并持续验证</small></p></li>
                  <li><i>03</i><p><strong>进入实时工作台</strong><small>观察过程并试玩结果</small></p></li>
                </ol>
                <AssetRequirement imageGenerationAvailable={imageGenerationAvailable} />
                <div className={`create-runtime-note ${autoStartAvailable ? 'is-ready' : 'is-blocked'}`}>
                  <span className={`runtime-dot ${autoStartAvailable ? 'state-ready' : 'state-error'}`} />
                  <p><strong>{autoStartAvailable ? '可以立即启动' : '将仅创建项目'}</strong><small>{autoStartMessage}</small></p>
                </div>
              </aside>
            </div>
          </section>
        )}

        {error ? <div className="form-error create-form-error" role="alert">{error}</div> : null}

        <footer className="form-actions create-actions">
          {step === 'idea' ? (
            <>
              <p>快捷键：⌘ / Ctrl + Enter 继续确认</p>
              <button className="primary-button" type="submit">
                继续确认 <ArrowRight size={15} />
              </button>
            </>
          ) : (
            <>
              <button className="create-back-button" type="button" disabled={busy} onClick={() => setStep('idea')}>
                <ArrowLeft size={15} /> 返回修改
              </button>
              <div className="create-submit-actions">
                {autoStartAvailable ? (
                  <button type="button" disabled={busy} onClick={() => void create(false)}>
                    {pendingAction === 'create' ? '正在创建…' : '仅创建项目'}
                  </button>
                ) : null}
                <button className="primary-button" type="submit" disabled={busy}>
                  {pendingAction ? (
                    <><Sparkles size={15} /> {pendingAction === 'start' ? '正在启动 Agent…' : '正在创建项目…'}</>
                  ) : autoStartAvailable ? (
                    <><Play size={14} fill="currentColor" /> 创建并开始制作</>
                  ) : (
                    <><Sparkles size={15} /> 创建项目</>
                  )}
                </button>
              </div>
            </>
          )}
        </footer>
      </form>
    </Modal>
  );
}

function suggestProjectName(idea: string): string {
  return idea
    .trim()
    .replace(/^(请|帮我|我想|想要|制作|做)(一个|一款|个|款)?/u, '')
    .split(/[，。！？：:,.!?\n]/u)[0]
    ?.trim()
    .slice(0, 24) ?? '';
}

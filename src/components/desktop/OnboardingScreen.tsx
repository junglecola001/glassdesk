import { useState } from 'react';
import {
  CircleNotch,
  FolderSimple,
  LockSimple,
  Monitor,
  Sparkle,
  WarningCircle,
} from '@phosphor-icons/react';
import type { FolderCandidate } from '../../types/bookmark';
import {
  completeOnboarding,
  dismissOnboarding,
  useWorkspace,
} from '../../stores/desktop-store';

function chooseVisibleFolders(folders: FolderCandidate[]): FolderCandidate[] {
  const nested = folders.filter((folder) => folder.depth === 2);
  if (nested.length > 0) return nested;
  return folders.filter((folder) => folder.depth === 1);
}

function defaultSelection(folders: FolderCandidate[]): string[] {
  return chooseVisibleFolders(folders)
    .slice(0, 6)
    .map((folder) => folder.id);
}

function pathLabel(folder: FolderCandidate): string {
  const parents = folder.path.slice(0, -1).filter((part) => part && part !== '书签');
  return parents.join(' / ');
}

export function OnboardingScreen() {
  const { bookmarkFolders, hasBookmarkPermission, isDemo } = useWorkspace();
  const visibleFolders = chooseVisibleFolders(bookmarkFolders);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(defaultSelection(bookmarkFolders)),
  );
  const [busy, setBusy] = useState(false);

  const permissionMissing = !hasBookmarkPermission && !isDemo;
  const selectedCount = selected.size;
  const hasChoices = visibleFolders.length > 0;
  const blankIsPrimary = permissionMissing || !hasChoices;

  function toggle(folderId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  }

  async function createDesktops() {
    if (busy) return;
    setBusy(true);
    try {
      await completeOnboarding(Array.from(selected));
    } finally {
      setBusy(false);
    }
  }

  async function createBlank() {
    if (busy) return;
    setBusy(true);
    try {
      await dismissOnboarding();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="onboarding">
      <header className="onboarding__bar">
        <div className="onboarding__brand">
          <img src="/icons/icon-32.png" alt="" width={26} height={26} />
          <span>GlassDesk</span>
        </div>
        <span className="onboarding__bar-note">本地运行 · 无需账号</span>
      </header>

      <div className="onboarding__stage">
        <section className="onboarding__card glass" aria-label="欢迎使用 GlassDesk">
          <div className="onboarding__intro">
            <img className="onboarding__mark" src="/icons/icon-128.png" alt="" width={58} height={58} />
            <h1 className="onboarding__title">
              把书签，
              <br />
              摆成一张<em>桌面</em>。
            </h1>
            <p className="onboarding__subtitle">
              每个书签文件夹都可以变成一个桌面，左右切换，像整理一张真正的工作台。布局保存在本机，
              随时回来都还在。
            </p>
            <div className="onboarding__features">
              <div className="feature-line">
                <span className="feature-line__icon">
                  <Monitor size={15} />
                </span>
                <div>
                  <h4>文件夹就是桌面</h4>
                  <p>书签文件夹自动映射，拖拽就能整理。</p>
                </div>
              </div>
              <div className="feature-line">
                <span className="feature-line__icon">
                  <LockSimple size={15} />
                </span>
                <div>
                  <h4>本地优先</h4>
                  <p>布局、便签和倒计时只保存在这台电脑上。</p>
                </div>
              </div>
              <div className="feature-line">
                <span className="feature-line__icon">
                  <Sparkle size={15} />
                </span>
                <div>
                  <h4>离线可用</h4>
                  <p>没有网络时，桌面和小组件照常打开。</p>
                </div>
              </div>
            </div>
          </div>

          <div className="onboarding__picker">
            <h2>选择要放上桌面的文件夹</h2>
            <p>勾选后点击创建。之后可以在设置里添加、重命名或调整顺序。</p>

            {permissionMissing ? (
              <div className="onboarding__empty">
                <span className="onboarding__empty-icon">
                  <WarningCircle size={20} weight="fill" />
                </span>
                <strong>还没有书签权限</strong>
                <p>
                  请在浏览器扩展管理页确认 GlassDesk 拥有书签权限，然后重新打开新标签页。
                  你也可以先创建一个空白桌面，使用便签、倒计时和搜索。
                </p>
              </div>
            ) : visibleFolders.length > 0 ? (
              <>
                <div className="onboarding__select-all">
                  <span>已选择 {selectedCount} 个文件夹</span>
                  <span style={{ display: 'flex', gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => setSelected(new Set(visibleFolders.map((folder) => folder.id)))}
                    >
                      全选
                    </button>
                    <button type="button" onClick={() => setSelected(new Set())}>
                      清空
                    </button>
                  </span>
                </div>
                <div className="folder-list scroll-area">
                  {visibleFolders.map((folder) => {
                    const checked = selected.has(folder.id);
                    return (
                      <label
                        key={folder.id}
                        className="folder-option"
                        data-selected={checked}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(folder.id)}
                        />
                        <span className="folder-option__icon" aria-hidden="true">
                          <FolderSimple size={14} weight="fill" />
                        </span>
                        <span className="folder-option__text">
                          <span className="folder-option__title">{folder.title}</span>
                          <span className="folder-option__path">{pathLabel(folder) || '书签栏'}</span>
                        </span>
                        <span className="folder-option__count">{folder.count} 个</span>
                      </label>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="onboarding__empty">
                <span className="onboarding__empty-icon">
                  <FolderSimple size={20} weight="fill" />
                </span>
                <strong>暂时没有可映射的文件夹</strong>
                <p>
                  在浏览器书签栏里创建文件夹并放入书签，或者先创建一个空白桌面。
                  你随时可以在设置里重新导入。
                </p>
              </div>
            )}

            <div className="onboarding__hint">
              <LockSimple size={11} style={{ display: 'inline', marginRight: 5, verticalAlign: -1 }} />
              浏览器书签不会被修改，GlassDesk 只读取文件夹结构。
            </div>

            <div className="onboarding__actions">
              <button
                type="button"
                className="btn btn--primary"
                disabled={busy || (!blankIsPrimary && selectedCount === 0)}
                onClick={() => void (blankIsPrimary ? createBlank() : createDesktops())}
              >
                {busy ? <CircleNotch size={15} className="spin" /> : null}
                {blankIsPrimary
                  ? '创建空白桌面'
                  : selectedCount > 0
                    ? `创建 ${selectedCount} 个桌面`
                    : '选择文件夹'}
              </button>
              {!blankIsPrimary ? (
                <button
                  type="button"
                  className="btn btn--glass"
                  disabled={busy}
                  onClick={() => void createBlank()}
                >
                  创建空白桌面
                </button>
              ) : null}
            </div>
            {permissionMissing ? (
              <div className="onboarding__hint" style={{ display: 'flex', gap: 6 }}>
                <WarningCircle size={12} weight="fill" />
                没有书签权限时，桌面会先以空白状态创建。
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}

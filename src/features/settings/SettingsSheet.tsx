import { useEffect, useRef, useState } from 'react';
import {
  ArrowClockwise,
  ArrowDown,
  ArrowUp,
  CircleNotch,
  DownloadSimple,
  Globe,
  HardDrive,
  Info,
  Keyboard,
  LockSimple,
  MagnifyingGlass,
  Monitor,
  Plus,
  Sparkle,
  Trash,
  UploadSimple,
  WarningCircle,
  X,
} from '@phosphor-icons/react';
import type { Desktop } from '../../types/desktop';
import type { BookmarkColumns } from '../../types/settings';
import type { SettingsSection } from '../../stores/ui-store';
import { getWallpaper, WALLPAPERS } from '../../features/layout/wallpapers';
import { SEARCH_ENGINES } from '../../features/search/search';
import { BOOKMARK_COLUMNS } from '../../utils/defaults';
import { downloadBackup, importBackupFile } from '../../features/settings/backup';
import { storageService } from '../../services/storage-service';
import {
  addBlankDesktop,
  addDesktopFromFolder,
  cleanupMissingBookmarks,
  deleteDesktop,
  reimportBookmarks,
  renameDesktop,
  reorderDesktop,
  setActiveDesktop,
  setDesktopWallpaper,
  useWorkspace,
} from '../../stores/desktop-store';
import { patchSettings, useSettings } from '../../stores/settings-store';
import {
  setSettingsOpen,
  useUiState,
  pushToast,
} from '../../stores/ui-store';
import { APP_VERSION, SCHEMA_VERSION } from '../../utils/constants';
import { modifierLabel } from '../../utils/events';
import { ConfirmDialog, Modal } from '../../components/ui/Modal';
import { Segmented, SettingRow, Switch } from '../../components/ui/Controls';

const SECTIONS: Array<{ id: SettingsSection; label: string; icon: typeof Monitor }> = [
  { id: 'appearance', label: '外观', icon: Sparkle },
  { id: 'desktops', label: '桌面与书签', icon: Monitor },
  { id: 'search', label: '搜索与快捷键', icon: MagnifyingGlass },
  { id: 'data', label: '数据与备份', icon: HardDrive },
  { id: 'about', label: '关于', icon: Info },
];

const SECTION_COPY: Record<SettingsSection, { title: string; description: string }> = {
  appearance: { title: '外观', description: '壁纸、书签列数、玻璃质感和细微的动效偏好。' },
  desktops: { title: '桌面与书签', description: '管理桌面、文件夹映射和书签同步。' },
  search: { title: '搜索与快捷键', description: '默认搜索引擎与键盘操作。' },
  data: { title: '数据与备份', description: '所有数据都保存在这台电脑上。' },
  about: { title: '关于 GlassDesk', description: '版本、权限和实现边界。' },
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function SettingsSheet() {
  const { settingsOpen, settingsSection } = useUiState();
  const workspace = useWorkspace();
  const [section, setSection] = useState<SettingsSection>(settingsSection);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (settingsOpen) setSection(settingsSection);
  }, [settingsOpen, settingsSection]);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, [section]);

  const activeDesktop =
    workspace.desktops.find((desktop) => desktop.id === workspace.activeDesktopId) ?? null;

  return (
    <Modal
      open={settingsOpen}
      onClose={() => setSettingsOpen(false)}
      label="GlassDesk 设置"
      className="settings-sheet"
    >
      <div className="settings-windowbar">
        <div className="traffic-lights">
          <button
            type="button"
            className="traffic-light traffic-light--close"
            aria-label="关闭设置"
            onClick={() => setSettingsOpen(false)}
          />
          <span className="traffic-light traffic-light--min" aria-hidden="true" />
          <span className="traffic-light traffic-light--max" aria-hidden="true" />
        </div>
        <span className="settings-windowbar__title">设置</span>
      </div>
      <aside className="settings-nav">
        <div className="settings-brand">
          <img src="/icons/icon-48.png" alt="" width={30} height={30} />
          <div>
            <div className="settings-brand__name">GlassDesk</div>
            <div className="settings-brand__meta">v{APP_VERSION}</div>
          </div>
        </div>
        {SECTIONS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              className="settings-nav__item"
              aria-current={section === item.id ? 'page' : undefined}
              onClick={() => setSection(item.id)}
            >
              <Icon size={15} />
              {item.label}
            </button>
          );
        })}
        <div className="settings-nav__footer">
          全部数据保存在本机。
          <br />
          浏览器书签不会被修改。
        </div>
      </aside>

      <div className="settings-main">
        <header className="settings-head">
          <div>
            <h2>{SECTION_COPY[section].title}</h2>
            <p>{SECTION_COPY[section].description}</p>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="关闭设置"
            onClick={() => setSettingsOpen(false)}
          >
            <X size={15} />
          </button>
        </header>
        <div className="settings-body scroll-area" ref={bodyRef}>
          {section === 'appearance' ? (
            <AppearanceSection activeDesktop={activeDesktop} />
          ) : null}
          {section === 'desktops' ? <DesktopsSection /> : null}
          {section === 'search' ? <SearchSection /> : null}
          {section === 'data' ? <DataSection /> : null}
          {section === 'about' ? <AboutSection /> : null}
        </div>
      </div>
    </Modal>
  );
}

function AppearanceSection({ activeDesktop }: { activeDesktop: Desktop | null }) {
  const settings = useSettings();
  const wallpaperId = activeDesktop?.wallpaper ?? settings.defaultWallpaper;

  return (
    <div className="settings-section">
      <div className="settings-group">
        <div className="settings-group__title">桌面壁纸</div>
        <div className="wallpaper-grid" role="group" aria-label="当前桌面壁纸">
          {WALLPAPERS.map((wallpaper) => (
            <button
              key={wallpaper.id}
              type="button"
              className="wallpaper-swatch"
              data-active={wallpaperId === wallpaper.id}
              style={{ background: wallpaper.thumbnail }}
              aria-label={wallpaper.name}
              title={`${wallpaper.name} · ${wallpaper.description}`}
              disabled={!activeDesktop}
              onClick={() => {
                if (activeDesktop) setDesktopWallpaper(activeDesktop.id, wallpaper.id);
              }}
            >
              <span className="wallpaper-swatch__label">{wallpaper.name}</span>
            </button>
          ))}
        </div>
        <div className="settings-row" style={{ borderBottom: 0 }}>
          <div className="settings-row__text">
            <h3>当前桌面</h3>
            <p>每个桌面可以有自己的壁纸。切换桌面后，这里会显示对应的设置。</p>
          </div>
          <span className="chip">{activeDesktop?.name ?? '没有桌面'}</span>
        </div>
      </div>

      <div className="settings-group">
        <div className="settings-group__title">桌面书签</div>
        <SettingRow
          title="每行显示数量"
          description="调整右侧书签区域的列数。窄屏会自动收敛到 3–4 列。"
        >
          <Segmented
            label="每行书签数量"
            value={String(settings.bookmarkColumns ?? 2)}
            options={BOOKMARK_COLUMNS.map((count) => ({
              value: String(count),
              label: String(count),
            }))}
            onChange={(value) =>
              patchSettings({ bookmarkColumns: Number(value) as BookmarkColumns })
            }
          />
        </SettingRow>
      </div>

      <div className="settings-group">
        <div className="settings-group__title">玻璃质感</div>
        <SettingRow
          title="玻璃强度"
          description="强度越高，backdrop blur 越明显，对性能的要求也越高。低强度会使用更实的底色。"
        >
          <Segmented
            label="玻璃强度"
            value={settings.glassIntensity}
            options={[
              { value: 'low', label: '低' },
              { value: 'medium', label: '中' },
              { value: 'high', label: '高' },
            ]}
            onChange={(value) => patchSettings({ glassIntensity: value })}
          />
        </SettingRow>
        <SettingRow
          title="减少动态效果"
          description="关闭桌面切换、胶囊展开和 Dock 的非必要动画。"
        >
          <Switch
            label="减少动态效果"
            checked={settings.reducedMotion}
            onChange={(checked) => patchSettings({ reducedMotion: checked })}
          />
        </SettingRow>
      </div>

      <div className="settings-group">
        <div className="settings-group__title">Dock 与导航</div>
        <SettingRow title="自动隐藏 Dock" description="只有把指针移到屏幕底部时才显示 Dock。">
          <Switch
            label="自动隐藏 Dock"
            checked={settings.dockAutoHide}
            onChange={(checked) => patchSettings({ dockAutoHide: checked })}
          />
        </SettingRow>
        <SettingRow title="显示桌面指示点" description="在 Dock 上方显示用于切换桌面的小圆点。">
          <Switch
            label="显示桌面指示点"
            checked={settings.showDesktopDots}
            onChange={(checked) => patchSettings({ showDesktopDots: checked })}
          />
        </SettingRow>
        <SettingRow
          title="切换桌面"
          description="在桌面空白处滚动滚轮，或使用触控板/触摸屏左右滑动。内容需要滚动时先滚动，到达边界后切换。"
        >
          <span className="chip">滚轮 / 滑动</span>
        </SettingRow>
      </div>
    </div>
  );
}

function DesktopsSection() {
  const settings = useSettings();
  const workspace = useWorkspace();
  const [deleteTarget, setDeleteTarget] = useState<Desktop | null>(null);
  const [folderToAdd, setFolderToAdd] = useState('');
  const [addingFolder, setAddingFolder] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const orderedDesktops = workspace.desktopOrder
    .map((id) => workspace.desktops.find((desktop) => desktop.id === id))
    .filter((desktop): desktop is Desktop => Boolean(desktop));
  const mappedFolders = new Set(
    workspace.desktops
      .map((desktop) => desktop.sourceFolderId)
      .filter((id): id is string => Boolean(id)),
  );
  const availableFolders = workspace.bookmarkFolders.filter(
    (folder) => !mappedFolders.has(folder.id),
  );
  const permissionMissing = !workspace.hasBookmarkPermission && !workspace.isDemo;

  async function handleRefresh() {
    setRefreshing(true);
    await reimportBookmarks();
    setRefreshing(false);
  }

  async function handleAddFolder() {
    if (!folderToAdd) return;
    setAddingFolder(true);
    const id = await addDesktopFromFolder(folderToAdd);
    setAddingFolder(false);
    if (id) setFolderToAdd('');
  }

  return (
    <div className="settings-section">
      {permissionMissing ? (
        <div className="notice notice--warning">
          <WarningCircle size={15} weight="fill" />
          <span>
            当前没有书签权限。桌面和小组件仍可使用，但无法读取新的书签。请在浏览器扩展管理页确认权限。
          </span>
        </div>
      ) : null}

      <div className="settings-group">
        <div className="settings-group__title">书签同步</div>
        <SettingRow
          title="同步方式"
          description="「手动导入」只在你点击重新导入时更新。「跟随更新」会监听书签的新增、移动和删除。"
        >
          <Segmented
            label="书签同步方式"
            value={settings.bookmarkSyncMode}
            options={[
              { value: 'import', label: '手动导入' },
              { value: 'follow', label: '跟随更新' },
            ]}
            onChange={(value) => patchSettings({ bookmarkSyncMode: value })}
          />
        </SettingRow>
        <SettingRow
          title="重新导入书签"
          description="把新增书签加入对应桌面，同时刷新网站图标。优先使用本地缓存；未访问过的站点会向网站请求 favicon。不会修改浏览器书签。"
        >
          <button
            type="button"
            className="btn btn--glass btn--small"
            disabled={refreshing || permissionMissing}
            onClick={() => void handleRefresh()}
          >
            {refreshing ? <CircleNotch size={13} className="spin" /> : <ArrowClockwise size={13} />}
            重新导入
          </button>
        </SettingRow>
        <SettingRow
          title="清理失效书签"
          description="移除那些已从浏览器删除、但仍以占位形式留在桌面上的书签记录。"
        >
          <button
            type="button"
            className="btn btn--glass btn--small"
            onClick={() => cleanupMissingBookmarks()}
          >
            清理
          </button>
        </SettingRow>
      </div>

      <div className="settings-group">
        <div className="settings-group__title">桌面列表</div>
        <div className="desktop-admin">
          {orderedDesktops.map((desktop, index) => (
            <DesktopAdminRow
              key={desktop.id}
              desktop={desktop}
              index={index}
              total={orderedDesktops.length}
              isActive={desktop.id === workspace.activeDesktopId}
              wallpaperName={getWallpaper(desktop.wallpaper ?? settings.defaultWallpaper).name}
              wallpaperBackground={getWallpaper(desktop.wallpaper ?? settings.defaultWallpaper).background}
              sourceLabel={
                desktop.sourceFolderId
                  ? workspace.bookmarkFolders.find((folder) => folder.id === desktop.sourceFolderId)
                      ?.title ?? '书签文件夹'
                  : '自定义桌面'
              }
              onDelete={() => setDeleteTarget(desktop)}
            />
          ))}
        </div>
        <div className="desktop-add-row">
          <button
            type="button"
            className="btn btn--glass btn--small"
            onClick={() => {
              const id = addBlankDesktop();
              if (id) pushToast('已创建空白桌面。', 'success');
            }}
          >
            <Plus size={13} />
            空白桌面
          </button>
          {availableFolders.length > 0 ? (
            <>
              <select
                className="select"
                value={folderToAdd}
                aria-label="选择书签文件夹"
                onChange={(event) => setFolderToAdd(event.target.value)}
              >
                <option value="">选择书签文件夹…</option>
                {availableFolders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.path.filter((part) => part && part !== '书签').join(' / ') || folder.title}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn--primary btn--small"
                disabled={!folderToAdd || addingFolder}
                onClick={() => void handleAddFolder()}
              >
                {addingFolder ? <CircleNotch size={13} className="spin" /> : null}
                添加
              </button>
            </>
          ) : (
            <span className="faint" style={{ fontSize: 10.5 }}>
              所有书签文件夹都已经映射为桌面。
            </span>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={`删除桌面「${deleteTarget?.name ?? ''}」？`}
        body="只会删除这个桌面的布局、小组件和排列。浏览器里的书签不会被删除，之后可以重新导入。"
        confirmLabel="删除桌面"
        danger
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteDesktop(deleteTarget.id);
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}

interface DesktopAdminRowProps {
  desktop: Desktop;
  index: number;
  total: number;
  isActive: boolean;
  wallpaperName: string;
  wallpaperBackground: string;
  sourceLabel: string;
  onDelete: () => void;
}

function DesktopAdminRow({
  desktop,
  index,
  total,
  isActive,
  wallpaperName,
  wallpaperBackground,
  sourceLabel,
  onDelete,
}: DesktopAdminRowProps) {
  const [name, setName] = useState(desktop.name);

  useEffect(() => {
    setName(desktop.name);
  }, [desktop.name]);

  function commit() {
    const next = name.trim();
    if (!next) {
      setName(desktop.name);
      return;
    }
    if (next !== desktop.name) renameDesktop(desktop.id, next);
  }

  return (
    <div className="desktop-admin__row">
      <span
        className="desktop-admin__swatch"
        style={{ background: wallpaperBackground }}
        title={`壁纸：${wallpaperName}`}
        aria-hidden="true"
      />
      <div className="desktop-admin__name">
        <input
          value={name}
          aria-label={`重命名${desktop.name}`}
          maxLength={60}
          onChange={(event) => setName(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
            if (event.key === 'Escape') {
              setName(desktop.name);
              event.currentTarget.blur();
            }
          }}
        />
        <div className="desktop-admin__meta">
          <span>{desktop.bookmarkIds.length} 个书签</span>
          <span>·</span>
          <span>{sourceLabel}</span>
          {desktop.missingSource ? <span className="warn">来源已失效</span> : null}
          {isActive ? <span>当前</span> : null}
        </div>
      </div>
      <div className="desktop-admin__actions">
        <button
          type="button"
          className="icon-button"
          aria-label="上移桌面"
          disabled={index === 0}
          onClick={() => reorderDesktop(desktop.id, -1)}
        >
          <ArrowUp size={13} />
        </button>
        <button
          type="button"
          className="icon-button"
          aria-label="下移桌面"
          disabled={index === total - 1}
          onClick={() => reorderDesktop(desktop.id, 1)}
        >
          <ArrowDown size={13} />
        </button>
        <button
          type="button"
          className="icon-button"
          aria-label={`切换到${desktop.name}`}
          onClick={() => {
            setActiveDesktop(desktop.id);
            setSettingsOpen(false);
          }}
        >
          <Monitor size={13} />
        </button>
        <button
          type="button"
          className="icon-button"
          aria-label={`删除${desktop.name}`}
          onClick={onDelete}
        >
          <Trash size={13} />
        </button>
      </div>
    </div>
  );
}

function SearchSection() {
  const settings = useSettings();
  return (
    <div className="settings-section">
      <div className="settings-group">
        <div className="settings-group__title">默认搜索引擎</div>
        <div className="engine-grid">
          {SEARCH_ENGINES.map((engine) => (
            <button
              key={engine.id}
              type="button"
              className="engine-option"
              data-active={settings.searchEngine === engine.id}
              onClick={() => patchSettings({ searchEngine: engine.id })}
            >
              <span className="engine-option__icon">
                <Globe size={15} />
              </span>
              <span className="engine-option__text">
                <span className="engine-option__name">{engine.name}</span>
                <span className="engine-option__hint">
                  {engine.hint || '搜索网页'}
                </span>
              </span>
            </button>
          ))}
        </div>
        <p className="settings-note">
          书签搜索完全在本地进行，不需要联网。只有把查询发送给搜索引擎时才需要网络。
        </p>
      </div>

      <div className="settings-group">
        <div className="settings-group__title">键盘快捷键</div>
        <div className="shortcut-list">
          <Shortcut keys={[modifierLabel(), 'K']} label="打开或关闭搜索" />
          <Shortcut keys={['[']} label="上一个桌面" />
          <Shortcut keys={[']']} label="下一个桌面" />
          <Shortcut keys={['Esc']} label="关闭当前浮层" />
          <Shortcut keys={[modifierLabel(), 'Enter']} label="在新标签页打开搜索结果" />
        </div>
        <p className="settings-note">
          <Keyboard size={12} style={{ display: 'inline', verticalAlign: -1, marginRight: 5 }} />
          在输入框内输入时，桌面切换快捷键不会触发。
        </p>
      </div>
    </div>
  );
}

function Shortcut({ keys, label }: { keys: string[]; label: string }) {
  return (
    <div className="shortcut-row">
      <span>{label}</span>
      <span>
        {keys.map((key) => (
          <span className="kbd" key={key}>
            {key}
          </span>
        ))}
      </span>
    </div>
  );
}

function DataSection() {
  const workspace = useWorkspace();
  const [bytes, setBytes] = useState(0);
  const [busy, setBusy] = useState(false);
  const [pendingImport, setPendingImport] = useState<File | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    void storageService.bytesInUse().then((value) => {
      if (!cancelled) setBytes(value);
    });
    return () => {
      cancelled = true;
    };
  }, [workspace.desktops, workspace.notes, workspace.countdowns]);

  async function refreshUsage() {
    setBytes(await storageService.bytesInUse());
  }

  async function handleExport() {
    setBusy(true);
    try {
      await downloadBackup();
      pushToast('备份已导出。', 'success');
    } catch (error) {
      console.error('[GlassDesk] Backup export failed', error);
      pushToast(error instanceof Error ? error.message : '导出失败。', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleImport(file: File) {
    setBusy(true);
    try {
      const result = await importBackupFile(file);
      pushToast(`已导入 ${result.desktops} 个桌面，正在重新载入。`, 'success');
      window.setTimeout(() => window.location.reload(), 700);
    } catch (error) {
      console.error('[GlassDesk] Backup import failed', error);
      pushToast(error instanceof Error ? error.message : '导入失败。', 'error');
      setBusy(false);
    }
  }

  const percent = Math.min(100, (bytes / (10 * 1024 * 1024)) * 100);
  const dataParts = [
    `${workspace.desktops.length} 个桌面`,
    `${workspace.notes.length} 张便签`,
    `${workspace.countdowns.length} 个倒计时`,
  ];

  return (
    <div className="settings-section">
      {workspace.isDemo ? (
        <div className="notice">
          <Info size={15} weight="fill" />
          <span>当前正在显示开发环境的演示数据。安装为扩展后，这里会使用你真实的书签。</span>
        </div>
      ) : null}

      <div className="settings-group">
        <div className="settings-group__title">本地存储</div>
        <div className="settings-row">
          <div className="settings-row__text">
            <h3>已使用 {formatBytes(bytes)}</h3>
            <p>{dataParts.join(' · ')}。chrome.storage.local 的默认配额约为 10MB。</p>
            <div className="storage-meter" aria-hidden="true">
              <i style={{ width: `${percent}%` }} />
            </div>
          </div>
          <div className="settings-row__control">
            <button type="button" className="btn btn--glass btn--small" onClick={() => void refreshUsage()}>
              <ArrowClockwise size={13} />
              刷新
            </button>
          </div>
        </div>
      </div>

      <div className="settings-group">
        <div className="settings-group__title">备份与恢复</div>
        <SettingRow
          title="导出备份"
          description="下载当前布局、便签、倒计时和设置。备份不包含浏览器书签本身。"
        >
          <button
            type="button"
            className="btn btn--glass btn--small"
            disabled={busy}
            onClick={() => void handleExport()}
          >
            <DownloadSimple size={13} />
            导出 JSON
          </button>
        </SettingRow>
        <SettingRow
          title="导入备份"
          description="导入会用备份覆盖当前布局。书签会尽量按网址重新匹配。"
        >
          <button
            type="button"
            className="btn btn--glass btn--small"
            disabled={busy}
            onClick={() => fileInputRef.current?.click()}
          >
            <UploadSimple size={13} />
            选择文件
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="visually-hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) setPendingImport(file);
            }}
          />
        </SettingRow>
        <SettingRow
          title="重置所有数据"
          description="删除 GlassDesk 保存的布局、便签、倒计时和设置。浏览器书签不受影响。"
        >
          <button
            type="button"
            className="btn btn--danger btn--small"
            onClick={() => setResetOpen(true)}
          >
            <Trash size={13} />
            重置
          </button>
        </SettingRow>
      </div>

      <ConfirmDialog
        open={Boolean(pendingImport)}
        title="导入这份备份？"
        body={`将使用「${pendingImport?.name ?? '备份文件'}」覆盖当前桌面布局、便签、倒计时和设置。导入后会重新载入新标签页。`}
        confirmLabel="导入并覆盖"
        danger
        onCancel={() => setPendingImport(null)}
        onConfirm={() => {
          const file = pendingImport;
          setPendingImport(null);
          if (file) void handleImport(file);
        }}
      />
      <ConfirmDialog
        open={resetOpen}
        title="重置所有数据？"
        body="GlassDesk 的桌面布局、便签、倒计时和设置会被删除。浏览器书签不会被删除。此操作无法撤销。"
        confirmLabel="确认重置"
        danger
        onCancel={() => setResetOpen(false)}
        onConfirm={() => {
          setResetOpen(false);
          void storageService.resetAll().then(() => window.location.reload());
        }}
      />
    </div>
  );
}

function AboutSection() {
  return (
    <div className="settings-section">
      <div className="settings-group">
        <div className="settings-group__title">GlassDesk v{APP_VERSION}</div>
        <p className="settings-note" style={{ marginTop: 0 }}>
          一个浅色液态玻璃风格的新标签页。浏览器书签是真实数据源，桌面布局是独立的本地配置。
          移动或删除桌面上的书签不会改写浏览器里的原始文件夹。
        </p>
        <div className="about-grid" style={{ marginTop: 12 }}>
          <div className="about-card">
            <h4>技术栈</h4>
            <p>React、TypeScript、Vite、Manifest V3。</p>
          </div>
          <div className="about-card">
            <h4>存储</h4>
            <p>chrome.storage.local，schema v{SCHEMA_VERSION}，写入前提供迁移备份。</p>
          </div>
          <div className="about-card">
            <h4>权限</h4>
            <p>只申请书签和存储。不读取标签页、历史记录或网页内容。</p>
          </div>
          <div className="about-card">
            <h4>离线</h4>
            <p>桌面、便签、倒计时和书签搜索无需联网。搜索引擎本身需要网络。</p>
          </div>
        </div>
      </div>

      <div className="settings-group">
        <div className="settings-group__title">关于液态玻璃</div>
        <p className="settings-note" style={{ marginTop: 0 }}>
          网页无法调用 Apple 的系统级 Liquid Glass。本扩展使用半透明背景、单层
          backdrop-filter、内边框高光和多层阴影来近似这种材质，并在低玻璃强度或系统要求减少动态效果时降级。
        </p>
      </div>

      <div className="settings-group">
        <div className="settings-group__title">书签与图标</div>
        <p className="settings-note" style={{ marginTop: 0 }}>
          为避免额外权限和网络请求，书签图标使用本地生成的首字母与色相。没有网址的失效书签会以虚线占位保留，
          你可以随时清理。
        </p>
        <div className="backup-actions" style={{ marginTop: 12 }}>
          <span className="chip">
            <LockSimple size={12} />
            完全本地
          </span>
          <span className="chip">无远程脚本</span>
          <span className="chip">书签只读</span>
        </div>
      </div>
    </div>
  );
}

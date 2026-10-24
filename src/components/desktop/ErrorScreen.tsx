import { useState } from 'react';
import { WarningCircle } from '@phosphor-icons/react';
import { storageService } from '../../services/storage-service';
import { useWorkspace } from '../../stores/desktop-store';
import { ConfirmDialog } from '../ui/Modal';

export function ErrorScreen() {
  const workspace = useWorkspace();
  const [resetOpen, setResetOpen] = useState(false);

  return (
    <div className="error-screen">
      <div className="error-card glass glass--strong">
        <div className="error-card__icon">
          <WarningCircle size={22} weight="fill" />
        </div>
        <h1>桌面暂时打不开</h1>
        <p>{workspace.error ?? '读取本地数据时遇到了问题。'}</p>
        <p style={{ marginTop: 6, color: 'var(--ink-3)', fontSize: 11 }}>
          旧数据不会在迁移失败时被覆盖。重试通常能恢复；重置会删除本地布局和设置。
        </p>
        <div className="error-card__actions">
          <button type="button" className="btn btn--primary" onClick={() => window.location.reload()}>
            重新加载
          </button>
          <button type="button" className="btn btn--glass" onClick={() => setResetOpen(true)}>
            重置本地数据
          </button>
        </div>
      </div>
      <ConfirmDialog
        open={resetOpen}
        title="重置本地数据？"
        body="这会删除 GlassDesk 保存的桌面布局、便签、倒计时、设置和迁移备份。浏览器书签不会被删除。此操作无法撤销。"
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

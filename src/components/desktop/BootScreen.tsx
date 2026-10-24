export function BootScreen() {
  return (
    <div className="boot-screen" role="status" aria-live="polite">
      <div className="boot-inner">
        <img className="boot-mark" src="/icons/icon-128.png" alt="" width={56} height={56} />
        <div className="boot-title">正在摆好桌面</div>
        <div className="boot-skeleton" aria-hidden="true" />
        <div className="boot-hint">读取本地布局与书签</div>
      </div>
    </div>
  );
}

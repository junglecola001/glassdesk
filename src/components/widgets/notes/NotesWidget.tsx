import { useEffect, useRef, useState } from 'react';
import { NotePencil, Plus } from '@phosphor-icons/react';
import type { NoteColor, WidgetInstance } from '../../../types/widget';
import { useConfirmAction } from '../../../hooks/use-confirm-action';
import {
  addNote,
  deleteNote,
  updateNote,
  updateWidget,
  useNotes,
} from '../../../stores/desktop-store';
import { WidgetFrame } from '../common/WidgetFrame';

const COLORS: Array<{ id: NoteColor; label: string }> = [
  { id: 'paper', label: '纸白' },
  { id: 'apricot', label: '杏仁' },
  { id: 'mint', label: '薄荷' },
  { id: 'lilac', label: '丁香' },
];

interface NotesWidgetProps {
  widget: WidgetInstance;
  compact: boolean;
  canvasWidth: number;
  canvasHeight: number;
}

export function NotesWidget({ widget, compact, canvasWidth, canvasHeight }: NotesWidgetProps) {
  const notes = useNotes();
  const activeNote =
    notes.find((note) => note.id === (widget.type === 'note' ? widget.settings.noteId : null)) ??
    notes[0] ??
    null;
  const [draft, setDraft] = useState({
    title: activeNote?.title ?? '',
    content: activeNote?.content ?? '',
  });
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const activeNoteRef = useRef(activeNote);
  activeNoteRef.current = activeNote;
  const dirtyRef = useRef(false);

  useEffect(() => {
    if (activeNote) {
      setDraft({ title: activeNote.title, content: activeNote.content });
      setSaveState('idle');
    } else {
      setDraft({ title: '', content: '' });
    }
    dirtyRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeNote?.id]);

  const flushRef = useRef<() => void>(() => undefined);
  flushRef.current = () => {
    const note = activeNoteRef.current;
    const currentDraft = draftRef.current;
    if (!note || !dirtyRef.current) return;
    if (note.title === currentDraft.title && note.content === currentDraft.content) {
      dirtyRef.current = false;
      return;
    }
    updateNote(note.id, { title: currentDraft.title, content: currentDraft.content });
    dirtyRef.current = false;
  };

  useEffect(() => {
    return () => flushRef.current();
  }, []);

  useEffect(() => {
    if (!activeNote || !dirtyRef.current) return;
    if (draft.title === activeNote.title && draft.content === activeNote.content) return;
    setSaveState('saving');
    const timer = window.setTimeout(() => {
      updateNote(activeNote.id, { title: draft.title, content: draft.content });
      dirtyRef.current = false;
      setSaveState('saved');
    }, 500);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.title, draft.content, activeNote?.id]);

  const deletion = useConfirmAction(() => {
    if (activeNote) deleteNote(activeNote.id);
  });

  function selectNote(noteId: string) {
    updateWidget(widget.id, (current) =>
      current.type === 'note' ? { ...current, settings: { noteId } } : current,
    );
  }

  function handleAddNote() {
    flushRef.current();
    const id = addNote();
    selectNote(id);
  }

  const frameData = { 'data-note-color': activeNote?.color ?? 'paper' };

  return (
    <WidgetFrame
      widget={widget}
      title="便签"
      icon={<NotePencil size={13} />}
      compact={compact}
      canvasWidth={canvasWidth}
      canvasHeight={canvasHeight}
      className="widget--note"
      dataAttributes={frameData}
    >
      {activeNote ? (
        <div className="note-widget">
          <div className="note-toolbar">
            <div className="note-tabs" role="tablist" aria-label="便签列表">
              {notes.map((note) => (
                <button
                  key={note.id}
                  type="button"
                  role="tab"
                  aria-selected={note.id === activeNote.id}
                  className="note-tab"
                  data-active={note.id === activeNote.id}
                  onClick={() => {
                    flushRef.current();
                    selectNote(note.id);
                  }}
                  title={note.title || '无标题便签'}
                >
                  <span className="note-tab__dot" aria-hidden="true" />
                  <span>{note.title || '无标题'}</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              className="note-add"
              aria-label="新建便签"
              title="新建便签"
              onClick={handleAddNote}
            >
              <Plus size={14} />
            </button>
          </div>

          <input
            className="note-title"
            value={draft.title}
            placeholder="无标题便签"
            aria-label="便签标题"
            maxLength={120}
            onChange={(event) => {
              dirtyRef.current = true;
              setDraft((current) => ({ ...current, title: event.target.value }));
            }}
            onBlur={() => flushRef.current()}
          />
          <textarea
            className="note-body scroll-area"
            value={draft.content}
            placeholder="写点什么…"
            aria-label="便签内容"
            onChange={(event) => {
              dirtyRef.current = true;
              setDraft((current) => ({ ...current, content: event.target.value }));
            }}
            onBlur={() => flushRef.current()}
          />

          <div className="note-footer">
            <span className="note-status">
              {saveState === 'saving' ? '保存中…' : saveState === 'saved' ? '已保存' : '自动保存'}
            </span>
            <div className="note-footer__actions">
              <div className="note-colors" role="group" aria-label="便签颜色">
                {COLORS.map((color) => (
                  <button
                    key={color.id}
                    type="button"
                    className="note-color"
                    data-swatch={color.id}
                    data-active={activeNote.color === color.id}
                    aria-label={`使用${color.label}色`}
                    title={color.label}
                    onClick={() => updateNote(activeNote.id, { color: color.id })}
                  />
                ))}
              </div>
              <button
                type="button"
                className="note-action"
                data-armed={deletion.armed}
                onClick={deletion.trigger}
              >
                {deletion.armed ? '确认删除' : '删除'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="note-empty">
          <span>这个桌面还没有便签。</span>
          <button type="button" className="btn btn--glass btn--small" onClick={handleAddNote}>
            <Plus size={13} />
            新建第一张便签
          </button>
        </div>
      )}
    </WidgetFrame>
  );
}

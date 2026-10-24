import { useState } from 'react';
import type { FormEvent } from 'react';
import { MagnifyingGlass } from '@phosphor-icons/react';
import type { WidgetInstance } from '../../../types/widget';
import { SEARCH_ENGINES, resolveQuery } from '../../../features/search/search';
import { openUrl } from '../../../services/browser-api';
import { patchSettings, useSettings } from '../../../stores/settings-store';
import { WidgetFrame } from '../common/WidgetFrame';

interface SearchWidgetProps {
  widget: WidgetInstance;
  compact: boolean;
  canvasWidth: number;
  canvasHeight: number;
}

export function SearchWidget({ widget, compact, canvasWidth, canvasHeight }: SearchWidgetProps) {
  const settings = useSettings();
  const [query, setQuery] = useState('');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!query.trim()) return;
    const resolution = resolveQuery(settings.searchEngine, query);
    openUrl(resolution.url);
  }

  return (
    <WidgetFrame
      widget={widget}
      title="快速搜索"
      icon={<MagnifyingGlass size={13} />}
      compact={compact}
      canvasWidth={canvasWidth}
      canvasHeight={canvasHeight}
    >
      <form className="search-widget" onSubmit={handleSubmit}>
        <div className="search-widget__row">
          <input
            className="input"
            value={query}
            placeholder="搜索或输入网址"
            aria-label="快速搜索"
            onChange={(event) => setQuery(event.target.value)}
          />
          <select
            className="select search-widget__engine"
            value={settings.searchEngine}
            aria-label="搜索引擎"
            onChange={(event) =>
              patchSettings({
                searchEngine: event.target.value as (typeof SEARCH_ENGINES)[number]['id'],
              })
            }
          >
            {SEARCH_ENGINES.map((engine) => (
              <option key={engine.id} value={engine.id}>
                {engine.name}
              </option>
            ))}
          </select>
        </div>
        <span className="search-widget__hint">回车打开，网址会直接跳转。</span>
      </form>
    </WidgetFrame>
  );
}

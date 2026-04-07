import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';

import 'fuzionkit/inputs/button';
import 'fuzionkit/panel';

const DBG = '[display-media-picker]';

type PickerSource = {
  id: string;
  name: string;
  kind: 'screen' | 'window';
  thumbnailDataUrl: string;
};

declare global {
  interface Window {
    displayMediaPicker: {
      onSources: (callback: (sources: PickerSource[]) => void) => void;
      offSources: (callback: (sources: PickerSource[]) => void) => void;
      selectSource: (sourceId: string) => void;
      cancel: () => void;
    };
  }
}

@customElement('fzn-display-media-picker-app')
export class DisplayMediaPickerApp extends LitElement {
  static styles = [
    css`
      :host
      {
        display: flex;
        flex-direction: column;
        height: 100vh;
        box-sizing: border-box;
        padding: .5rem;
        gap: .5rem;
        overflow: hidden;
      }

      fzn-panel
      {
        flex: 1 1 0%;
        min-height: 0;
        display: flex;
        flex-direction: column;
      }

      /* Let the panel body shrink so .scroll can scroll inside short windows */
      fzn-panel fzn-panel-body
      {
        flex: 1 1 0%;
        min-height: 0;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      .scroll
      {
        flex: 1 1 0%;
        min-height: 0;
        max-height: 100%;
        overflow-y: auto;
        overflow-x: hidden;
        -webkit-overflow-scrolling: touch;
        display: flex;
        flex-direction: column;
        gap: .75rem;
        padding: .75rem;
        box-sizing: border-box;
        scrollbar-width: thin;
        scrollbar-color: rgba(255, 255, 255, .22) rgba(0, 0, 0, .45);
      }

      .scroll::-webkit-scrollbar
      {
        width: 8px;
      }

      .scroll::-webkit-scrollbar-track
      {
        background: rgba(0, 0, 0, .45);
        border-radius: 4px;
      }

      .scroll::-webkit-scrollbar-thumb
      {
        background: rgba(255, 255, 255, .2);
        border-radius: 4px;
      }

      .scroll::-webkit-scrollbar-thumb:hover
      {
        background: rgba(255, 255, 255, .32);
      }

      .section-title
      {
        font-size: .75rem;
        text-transform: uppercase;
        letter-spacing: .04em;
        opacity: .5;
        margin: .25rem 0 0;
      }

      .grid
      {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(10.5rem, 1fr));
        gap: .5rem;
      }

      .card
      {
        display: flex;
        flex-direction: column;
        gap: .375rem;
        padding: .375rem;
        border-radius: 6px;
        border: 1px solid rgba(255, 255, 255, .12);
        background: rgba(0, 0, 0, .2);
        cursor: pointer;
        text-align: left;
        color: inherit;
        font: inherit;
        transition: border-color .12s ease, background .12s ease;
      }

      .card:hover
      {
        border-color: rgba(255, 255, 255, .28);
        background: rgba(255, 255, 255, .04);
      }

      .card:focus-visible
      {
        outline: 2px solid rgba(100, 149, 237, .9);
        outline-offset: 2px;
      }

      .thumb-wrap
      {
        aspect-ratio: 16 / 10;
        border-radius: 4px;
        overflow: hidden;
        background: rgba(0, 0, 0, .35);
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .thumb-wrap img
      {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .placeholder
      {
        font-size: .7rem;
        opacity: .45;
        padding: .5rem;
        text-align: center;
      }

      .label
      {
        font-size: .75rem;
        line-height: 1.25;
        word-break: break-word;
        max-height: 2.5rem;
        overflow: hidden;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
      }

      .actions
      {
        display: flex;
        flex-direction: column;
        gap: .5rem;
      }

      .actions fzn-button
      {
        width: 100%;
      }

      .error-banner
      {
        margin: 0;
        padding: .75rem;
        border-radius: 6px;
        background: rgba(180, 40, 40, .25);
        border: 1px solid rgba(255, 100, 100, .35);
        font-size: .8rem;
        line-height: 1.35;
      }
    `,
  ];

  @state()
  sources: PickerSource[] = [];

  private boundReceiveSources = (incoming: PickerSource[]) => {
    console.log(DBG, 'boundReceiveSources', { count: incoming?.length ?? 0 });
    this.sources = incoming ?? [];
  };

  connectedCallback (): void {
    super.connectedCallback();

    window.displayMediaPicker?.onSources(this.boundReceiveSources);
    console.log(DBG, 'connectedCallback (after onSources)');
  }

  disconnectedCallback (): void {
    super.disconnectedCallback();

    window.displayMediaPicker?.offSources(this.boundReceiveSources);
  }

  private handlePick = (id: string) => {
    console.log(DBG, 'handlePick (bind handler for card)', id);
    return () => {
      console.log(DBG, 'handlePick (click)', id);
      window.displayMediaPicker?.selectSource(id);
    };
  };

  private handleCancel = () => {
    window.displayMediaPicker?.cancel();
  };

  private screens (): PickerSource[] {
    console.log(DBG, 'screens');
    return this.sources.filter((s) => s.kind === 'screen');
  }

  private windows (): PickerSource[] {
    console.log(DBG, 'windows');
    return this.sources.filter((s) => s.kind === 'window');
  }

  private renderGrid (items: PickerSource[]): unknown {
    return html`
      <div class="grid">
        ${
          items.map(
            (s) => html`
              <button
                type="button"
                class="card"
                @click=${this.handlePick(s.id)}
              >
                <div class="thumb-wrap">
                  ${
                    s.thumbnailDataUrl
                      ? html`<img alt="" src=${s.thumbnailDataUrl} />`
                      : html`<span class="placeholder">No preview</span>`
                  }
                </div>
                <div class="label" title=${s.name}>
                  ${s.name.trim() || s.id}
                </div>
              </button>
            `,
          )
        }
      </div>
    `;
  }

  render (): unknown {
    const { handleCancel } = this;
    const bridge = window.displayMediaPicker;

    if (!bridge?.onSources) {
      return html`
        <p class="error-banner">
          Screen sharing UI failed to load.
        </p>
      `;
    }

    const scr = this.screens();
    const win = this.windows();

    return html`
      <fzn-panel>
        <fzn-panel-body>
          <div class="scroll">
            ${
              scr.length
                ? html`
                    <div class="section-title">Screens</div>
                    ${this.renderGrid(scr)}
                  `
                : null
            }
            ${
              win.length
                ? html`
                    <div class="section-title">Windows</div>
                    ${this.renderGrid(win)}
                  `
                : null
            }
            ${
              !scr.length && !win.length
                ? html`<p class="section-title">No captures available.</p>`
                : null
            }
          </div>
        </fzn-panel-body>
      </fzn-panel>

      <div class="actions">
        <fzn-button
          @click=${handleCancel}
          size="s"
          variant="danger"
        >
          Cancel
        </fzn-button>
      </div>
    `;
  }
}

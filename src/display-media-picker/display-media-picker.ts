import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';

import 'fuzionkit/inputs/button';
import 'fuzionkit/panel';

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
      :host {
        display: flex;
        flex-direction: column;
        height: 100vh;
        box-sizing: border-box;
        padding: 0.5rem;
        gap: 0.5rem;
        overflow: hidden;
      }

      .scroll {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }

      .section-title {
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        opacity: 0.5;
        margin: 0.25rem 0 0;
      }

      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(10.5rem, 1fr));
        gap: 0.5rem;
      }

      .card {
        display: flex;
        flex-direction: column;
        gap: 0.375rem;
        padding: 0.375rem;
        border-radius: 6px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        background: rgba(0, 0, 0, 0.2);
        cursor: pointer;
        text-align: left;
        color: inherit;
        font: inherit;
        transition: border-color 0.12s ease, background 0.12s ease;
      }

      .card:hover {
        border-color: rgba(255, 255, 255, 0.28);
        background: rgba(255, 255, 255, 0.04);
      }

      .card:focus-visible {
        outline: 2px solid rgba(100, 149, 237, 0.9);
        outline-offset: 2px;
      }

      .thumb-wrap {
        aspect-ratio: 16 / 10;
        border-radius: 4px;
        overflow: hidden;
        background: rgba(0, 0, 0, 0.35);
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .thumb-wrap img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .placeholder {
        font-size: 0.7rem;
        opacity: 0.45;
        padding: 0.5rem;
        text-align: center;
      }

      .label {
        font-size: 0.75rem;
        line-height: 1.25;
        word-break: break-word;
        max-height: 2.5rem;
        overflow: hidden;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
      }

      .actions {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .actions fzn-button {
        width: 100%;
      }
    `,
  ];

  @state()
  sources: PickerSource[] = [];

  private boundReceiveSources = (incoming: PickerSource[]) => {
    this.sources = incoming ?? [];
  };

  connectedCallback (): void {
    super.connectedCallback();
    window.displayMediaPicker.onSources(this.boundReceiveSources);
  }

  disconnectedCallback (): void {
    super.disconnectedCallback();
    window.displayMediaPicker.offSources(this.boundReceiveSources);
  }

  private handlePick = (id: string) => () => {
    window.displayMediaPicker.selectSource(id);
  };

  private handleCancel = () => {
    window.displayMediaPicker.cancel();
  };

  private screens (): PickerSource[] {
    return this.sources.filter((s) => s.kind === 'screen');
  }

  private windows (): PickerSource[] {
    return this.sources.filter((s) => s.kind === 'window');
  }

  private renderGrid (items: PickerSource[]): unknown {
    return html`
      <div class="grid">
        ${items.map(
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
        )}
      </div>
    `;
  }

  render (): unknown {
    const { handleCancel, screens, windows } = this;
    const scr = screens();
    const win = windows();

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

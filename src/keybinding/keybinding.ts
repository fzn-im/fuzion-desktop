import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { keyEnumToDisplay } from 'keycode-enums';

import 'fuzionkit/inputs/button';
import 'fuzionkit/panel';

declare global {
  interface Window {
    keybindings: any;
  }
}

@customElement('fzn-keybinding-app')
export class Keybinding extends LitElement {
  static styles = [
    css`
      :host
      {
        display: flex;
        flex-direction: column;
        height: 100%;
        padding: .5rem;
        gap: .5rem;
      }

      :host > :first-child
      {
        display: flex;
        flex-direction: column;
        flex-grow: 1;
      }

      :host > :first-child > fzn-panel-body :first-child
      {
        display: flex;
        flex-direction: column;
      }

      :host > :first-child > fzn-panel-body :first-child .title,
      :host > :first-child > fzn-panel-body :first-child .keybind
      {
        font-size: .875rem;
        text-align: center;
      }

      :host > :first-child fzn-panel-body
      {
        display: flex;
        flex-direction: column;
        flex-grow: 1;
        gap: .3125rem;
      }

      :host > :first-child *
      {
        user-select: none;
      }

      :host > :first-child .title
      {
        opacity: .5;
      }

      :host > :first-child .keybind
      {
        font-weight: bold;
      }

      :host > :first-child .keys
      {
        display: flex;
        flex-grow: 1;
        align-items: center;
        justify-content: center;
        word-wrap: break-word;
        word-break: break-world;
        max-width: 100%;
        text-align: center;
        border: 1px solid rgba(255, 255, 255, .12);
        border-radius: 5px;
        padding: 1rem;
      }

      :host > :last-child
      {
        display: flex;
        flex-direction: column;
        gap: .5rem;
      }

      :host > :last-child fzn-button
      {
        width: 100%;
      }
    `,
  ];

  @state()
  lastKeys: string[] = [];

  @state()
  keybinding: string = '-';

  keysUp = true;

  connectedCallback (): void {
    super.connectedCallback();
    const { handleKeysActive } = this;

    window.keybindings.onKeysActive(handleKeysActive);

    window.keybindings.getCurrentKeybinding()
      .then((binding: any) => {
        const { keybinding, keys } = binding;

        this.keybinding = keybinding;
        this.lastKeys = keys;
      });
  }

  disconnectedCallback (): void {
    super.disconnectedCallback();
    const { handleKeysActive } = this;

    window.keybindings.offKeysActive(handleKeysActive);
  }

  handleKeysActive = ({ keysActive: keysDown }: any) => {
    if (!keysDown.length || keysDown?.[0] === 'MOUSE_BUTTON1') {
      this.keysUp = true;
      return;
    }

    const keysActive = keysDown
      .filter((key: string) => key !== 'MOUSE_BUTTON1')

    if (
      this.lastKeys.length < keysActive.length ||
      (this.keysUp && keysActive.length === 1 && keysActive?.[0] !== 'MOUSE_BUTTON1')
    ) {
      this.keysUp = false;
      this.lastKeys = keysActive;
    }
  };

  handleSetKeybinding = () => {
    const { keybinding, lastKeys } = this;

    window.keybindings.setKeybinding(keybinding, lastKeys);
  };

  handleClearKeybinding = () => {
    this.lastKeys = [];
  };

  render (): unknown {
    const { handleClearKeybinding, handleSetKeybinding, keybinding, lastKeys } = this;

    return html`
      <fzn-panel>
        <fzn-panel-body>
          <div>
            <div class="title">
              Keybind
            </div>

            <div class="keybind">
              ${keybinding}
            </div>
          </div>

          <div class="keys">
            ${
              lastKeys.length
                ? lastKeys
                    .map((keyEnum) => keyEnumToDisplay(keyEnum) ?? keyEnum)
                    .join(' + ')
                : '*'
            }
          </div>
        </fzn-panel-body>
      </fzn-panel>

      <div>
        <fzn-button
          @click=${handleSetKeybinding}
          size="s"
          variant="success"
        >
          Set Keybind
        </fzn-button>

        <fzn-button
          @click=${handleClearKeybinding}
          size="s"
          variant="danger"
        >
          Unset Keybind
        </fzn-button>
      </div>
    `;
  }
}

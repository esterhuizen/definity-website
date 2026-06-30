// Standalone embed entry. A validator drops this script + a
// <div data-definity-direct-stake data-vote="..."> on their site; this mounts
// the direct-stake widget into a shadow root (so the host page's CSS can't
// touch it), locked to their validator. 100% on their domain — wallet connect,
// signing and submission all happen here; no Definity page is ever loaded.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { StakeProviders } from '@/components/stake/StakeProviders';
import { setRpcBaseOrigin } from '@/lib/solana/rpc';
import { EmbedWidget, type EmbedConfig } from './EmbedWidget';
import { EMBED_CSS } from './styles';

const DEFAULT_ORIGIN = 'https://definity.finance';

function mountOne(el: HTMLElement) {
  if (el.dataset.dfyMounted) return;
  const vote = el.getAttribute('data-vote')?.trim();
  if (!vote) {
    // eslint-disable-next-line no-console
    console.error('[definity] data-vote is required on the direct-stake widget element');
    return;
  }
  el.dataset.dfyMounted = '1';

  const cfg: EmbedConfig = {
    vote,
    ref: el.getAttribute('data-ref')?.trim() || null,
    name: el.getAttribute('data-name')?.trim() || null,
    image: el.getAttribute('data-image')?.trim() || null,
    apiOrigin: (el.getAttribute('data-api')?.trim() || DEFAULT_ORIGIN).replace(/\/+$/, ''),
  };
  setRpcBaseOrigin(cfg.apiOrigin);

  const shadow = el.shadowRoot ?? el.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = EMBED_CSS;
  shadow.appendChild(style);
  const host = document.createElement('div');
  shadow.appendChild(host);

  createRoot(host).render(
    <StrictMode>
      <StakeProviders>
        <EmbedWidget cfg={cfg} />
      </StakeProviders>
    </StrictMode>,
  );
}

function init() {
  document.querySelectorAll<HTMLElement>('[data-definity-direct-stake]').forEach(mountOne);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Expose a manual mount for SPAs that inject the element after load.
declare global {
  interface Window {
    DefinityDirectStake?: { mount: () => void };
  }
}
window.DefinityDirectStake = { mount: init };

// Self-contained styles injected into the widget's shadow root, so the host
// page's CSS can't touch the widget and vice-versa. Plain CSS, .dfy-* scoped.
export const EMBED_CSS = `
.dfy { font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; width: 100%; max-width: 400px; }
.dfy *, .dfy *::before, .dfy *::after { box-sizing: border-box; }
.dfy-card { background: #0a0f1c; color: #e7ecf6; border: 1px solid #1d2942; border-radius: 18px; padding: 20px; }
.dfy-eyebrow { font-size: 11px; text-transform: uppercase; letter-spacing: .16em; color: #6b7894; }
.dfy-val { display: flex; align-items: center; gap: 10px; margin-top: 10px; padding-bottom: 14px; border-bottom: 1px solid #16203a; }
.dfy-ava { width: 34px; height: 34px; border-radius: 50%; background: #1d2942; object-fit: cover; flex: none; display: inline-block; }
.dfy-name { font-weight: 600; font-size: 15px; line-height: 1.25; }
.dfy-mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; color: #6b7894; }
.dfy-label { font-size: 11px; text-transform: uppercase; letter-spacing: .16em; color: #6b7894; margin: 16px 0 6px; }
.dfy-amt { display: flex; align-items: center; gap: 8px; background: #060a14; border: 1px solid #1d2942; border-radius: 12px; padding: 12px 14px; }
.dfy-amt input { flex: 1; min-width: 0; background: transparent; border: none; outline: none; color: #e7ecf6; font-size: 26px; font-weight: 600; font-family: inherit; }
.dfy-amt input::placeholder { color: #3a4660; }
.dfy-amt span { color: #9aa6bf; font-weight: 500; }
.dfy-btn { width: 100%; border: none; border-radius: 12px; padding: 13px; font-size: 15px; font-weight: 600; font-family: inherit; cursor: pointer; margin-top: 14px; background: #2f6bff; color: #fff; transition: opacity .15s; }
.dfy-btn:hover { opacity: .92; }
.dfy-btn:disabled { opacity: .45; cursor: not-allowed; }
.dfy-wbtn { display: flex; align-items: center; gap: 10px; width: 100%; text-align: left; background: #060a14; border: 1px solid #1d2942; border-radius: 12px; padding: 12px 14px; color: #e7ecf6; font-size: 14px; font-weight: 500; font-family: inherit; cursor: pointer; margin-top: 8px; }
.dfy-wbtn:hover { border-color: #2f6bff; }
.dfy-wbtn img { width: 22px; height: 22px; border-radius: 5px; }
.dfy-note { font-size: 12px; color: #6b7894; margin-top: 12px; line-height: 1.55; }
.dfy-foot { font-size: 11px; color: #4a5573; margin-top: 14px; text-align: center; }
.dfy-link { color: #8aa3ff; text-decoration: none; }
.dfy-link:hover { text-decoration: underline; }
.dfy-row { display: flex; align-items: center; justify-content: space-between; margin: 14px 0 0; }
.dfy-dot { width: 7px; height: 7px; border-radius: 50%; background: #34d399; display: inline-block; margin-right: 6px; }
.dfy-x { background: none; border: none; color: #6b7894; cursor: pointer; font-size: 13px; font-family: inherit; padding: 0; }
.dfy-x:hover { color: #e7ecf6; }
.dfy-ok { text-align: center; padding-top: 6px; }
.dfy-oki { width: 46px; height: 46px; border-radius: 50%; background: rgba(52,211,153,.15); color: #34d399; display: inline-flex; align-items: center; justify-content: center; font-size: 22px; margin-bottom: 10px; }
.dfy-err { color: #fb7185; font-size: 13px; text-align: center; margin-top: 10px; word-break: break-word; }
`;

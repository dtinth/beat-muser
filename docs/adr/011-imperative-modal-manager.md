# Imperative Promise-Based Modal Manager

Instead of the typical React pattern of context-based or hook-based modals, we use an imperative singleton `ModalManager` that exposes `input({ title, value?, validate? })` returning `Promise<string | undefined>`. The UI layer renders a `<ModalHost>` component that subscribes to the manager's `$stack` atom and displays modals sequentially.

This matches VS Code's `window.showInputBox` UX, which our target audience (chart authors familiar with code editors) already understands. It also lets any code path — command handlers, click handlers, keyboard shortcuts — await user input inline without threading callbacks through React props or context. Multiple concurrent requests are queued and shown one at a time.

import type {Page} from '@playwright/test';
/** Preset-path specs must not depend on whether a real ComfyUI answers on this machine: offline drops the P1 photo step. */
export const comfyOffline=({page}:{page:Page})=>page.route(url=>url.pathname.startsWith('/comfy/'),route=>route.fulfill({status:502}));

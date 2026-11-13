import { Context } from "@deepseek-ai/cordis";
//#region src/index.d.ts
declare const inject: string[];
/**
 * 挂上 `ctx.webServer` 的路由。卸载时 Cordis 自动摘除。
 *
 * 工具与角色的注册走宿主的工具注册表；宿主没提供时只挂面板，
 * 不报错 —— 面板本身是可用的。
 */
declare function apply(ctx: Context): void;
//#endregion
export { apply, inject };
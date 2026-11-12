import { defineWebServer } from "dsh-h3";
import { createError, defineEventHandler, getQuery, getRouterParam, readBody } from "h3";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { NodeSqliteDialect } from "@fileshed/kysely-node-sqlite";
import { Kysely } from "kysely";
import { Model } from "kysely-model";
//#region src/database/models/channel.ts
/** 渠道。`host` 只有 gitlab 用。 */
var Channel = class extends Model {
	constructor(db) {
		super(db, "channel", "id");
	}
	/** 概览页的渠道卡片：监听状态 + 在线账号数 + 话题数。 */
	async summary() {
		const [rows, accounts, threads] = await Promise.all([
			this.db.selectFrom("channel").selectAll().execute(),
			this.db.selectFrom("channel_account").select(["channelId", "status"]).execute(),
			this.db.selectFrom("thread").select(["id", "channelId"]).execute()
		]);
		return rows.map((row) => ({
			id: row.id,
			name: row.name,
			enabled: row.enabled === 1,
			accounts: accounts.filter((account) => account.channelId === row.id && account.status === "online").length,
			threads: threads.filter((thread) => thread.channelId === row.id).length
		}));
	}
	/** 渠道页：账号、项目数、读取游标一次取齐。 */
	async detail() {
		const [rows, accounts, projects, threads, states] = await Promise.all([
			this.db.selectFrom("channel").selectAll().execute(),
			this.db.selectFrom("channel_account").selectAll().execute(),
			this.db.selectFrom("project").select(["id", "channelId"]).execute(),
			this.db.selectFrom("thread").select(["id", "channelId"]).execute(),
			this.db.selectFrom("source_state").selectAll().execute()
		]);
		return rows.map((row) => {
			const ownStates = states.filter((state) => state.channelId === row.id);
			const lastReadAt = ownStates.map((state) => state.updatedAt).sort().at(-1);
			return {
				id: row.id,
				name: row.name,
				enabled: row.enabled === 1,
				...row.host ? { host: row.host } : {},
				accounts: accounts.filter((account) => account.channelId === row.id).map((account) => ({
					id: account.id,
					role: account.role,
					name: account.name,
					...account.avatar ? { avatar: account.avatar } : {},
					status: account.status
				})),
				projects: projects.filter((project) => project.channelId === row.id).length,
				threads: threads.filter((thread) => thread.channelId === row.id).length,
				...lastReadAt ? { lastReadAt } : {},
				cursors: ownStates.map((state) => state.name)
			};
		});
	}
	/** 开关监听。关掉之后不会再产生触发。 */
	async setEnabled(id, enabled) {
		await this.db.updateTable("channel").set({ enabled: enabled ? 1 : 0 }).where("id", "=", id).execute();
	}
};
/** 渠道下的账号。`bot` 在渠道里说话，`admin` 是允许派活的人。 */
var ChannelAccount = class extends Model {
	constructor(db) {
		super(db, "channel_account", "id");
	}
};
/**
* CI 观察点。**每个被观察的目标一行**，记录上次的指纹。
*
* 一次 CI 运行会产生几十次状态变化，只有「和上次比变了」才发触发；
* 没有这份记忆就没法比。
*/
var CiWatch = class extends Model {
	constructor(db) {
		super(db, "ci_watch", "id");
	}
};
/**
* 渠道读到哪了。进程重启后靠它接着读，不从头重读历史。
*
* 这是运行状态，不是配置 —— 所以不放进 `setting`。
*/
var SourceState = class extends Model {
	constructor(db) {
		super(db, "source_state", "channelId");
	}
};
//#endregion
//#region src/constants.ts
/**
* 收件箱此刻轮到谁。
*
* **没有 worker** —— Worker 没有收件箱：它短命、被动、等的时候是阻塞的，
* 上级的话直接 prompt 进会话，不能进队列等它来取。
*/
const INBOX_TARGETS = [
	"user",
	"main",
	"project",
	"supervisor"
];
const TICKET_STATUSES = [
	"waiting",
	"queued",
	"running",
	"review",
	"done",
	"cancelled"
];
/** 设置里所有可调的键，与 `Setting` 字段一一对应。 */
const SETTING_KEYS = [
	"maxWorkers",
	"backgroundLimitMinutes",
	"autoMerge",
	"autoMergeMaxLines",
	"proxyDecide",
	"askDeadlineMinutes",
	"deliveryMaxAttempts",
	"deliveryRetryCeilingSeconds"
];
//#endregion
//#region src/database/models/inbox.ts
/**
* 一条投给某个代理——或者人类——的消息。
*
* 三个状态：`pending` 还没轮到、`done` 处理完、`stalled` 投递卡住。
* **只有 `pending` 进「你有 N 条未处理」**，`stalled` 是「送不到」，要人看。
*/
var Inbox = class extends Model {
	constructor(db) {
		super(db, "inbox", "id");
	}
	/** 面板条目。时间戳、投递信息、ask 字段全在这里收口。 */
	brief(row) {
		return {
			id: row.id,
			type: row.type,
			origin: row.origin,
			kind: row.kind,
			status: row.status,
			...row.title ? { title: row.title } : {},
			message: row.message,
			createdAt: row.createdAt,
			seq: String(row.seq),
			deliveryAttempts: row.deliveryAttempts,
			...row.deliveryError ? { deliveryError: row.deliveryError } : {},
			...row.nextRetryAt ? { nextRetryAt: row.nextRetryAt } : {},
			...row.readAt ? { readAt: row.readAt } : {},
			...row.deadline ? { deadline: row.deadline } : {},
			escalations: row.escalations,
			...row.answer ? { answer: row.answer } : {},
			...row.answeredBy ? { answeredBy: row.answeredBy } : {}
		};
	}
	/** 收件箱页：全部条目 + 每个 type 的未读数 + 卡住的条数。 */
	async page(type) {
		const rows = await this.db.selectFrom("inbox").selectAll().orderBy("seq", "desc").limit(200).execute();
		const counts = {
			user: 0,
			main: 0,
			project: 0,
			supervisor: 0
		};
		for (const row of rows) if (row.status === "pending") counts[row.type] += 1;
		const stalled = rows.filter((row) => row.status === "stalled").length;
		const visible = type ? rows.filter((row) => row.type === type) : rows;
		const [projects, tickets, threads, workers] = await Promise.all([
			this.db.selectFrom("project").select(["id", "name"]).execute(),
			this.db.selectFrom("ticket").select(["id", "title"]).execute(),
			this.db.selectFrom("thread").select(["id", "title"]).execute(),
			this.db.selectFrom("worker").select(["id", "ticketId"]).execute()
		]);
		const projectMap = new Map(projects.map((row) => [row.id, row.name]));
		const ticketMap = new Map(tickets.map((row) => [row.id, row.title]));
		const threadMap = new Map(threads.map((row) => [row.id, row.title]));
		const workerMap = new Map(workers.map((row) => [row.id, row.ticketId]));
		return {
			items: visible.map((row) => ({
				id: row.id,
				type: row.type,
				origin: row.origin,
				kind: row.kind,
				status: row.status,
				...row.title ? { title: row.title } : {},
				message: row.message,
				createdAt: row.createdAt,
				seq: String(row.seq),
				deliveryAttempts: row.deliveryAttempts,
				...row.deliveryError ? { deliveryError: row.deliveryError } : {},
				...row.nextRetryAt ? { nextRetryAt: row.nextRetryAt } : {},
				...row.readAt ? { readAt: row.readAt } : {},
				...row.deadline ? { deadline: row.deadline } : {},
				escalations: row.escalations,
				...row.answer ? { answer: row.answer } : {},
				...row.answeredBy ? { answeredBy: row.answeredBy } : {},
				...row.projectId ? { projectId: row.projectId } : {},
				...row.projectId ? { project: projectMap.get(row.projectId) ?? row.projectId } : {},
				...row.ticketId ? { ticketId: row.ticketId } : {},
				...row.ticketId ? { ticket: ticketMap.get(row.ticketId) ?? row.ticketId } : {},
				...row.threadId ? { thread: threadMap.get(row.threadId) ?? row.threadId } : {},
				...row.workerId ? { worker: workerMap.get(row.workerId) ?? row.workerId } : {}
			})),
			counts,
			stalled
		};
	}
	/** 某个代理名下还有几条未处理。会话结束时用它提示「你有 N 条消息未处理」。 */
	async pendingCount(target, projectId) {
		let query = this.db.selectFrom("inbox").select((eb) => eb.fn.countAll().as("total")).where("type", "=", target).where("status", "=", "pending");
		if (projectId) query = query.where("projectId", "=", projectId);
		const row = await query.executeTakeFirst();
		return Number(row?.total ?? 0);
	}
	/** 批量标掉。不需要先读 —— 代理处理完顺手清掉就行。 */
	async kill(ids) {
		if (!ids.length) return 0;
		await this.db.updateTable("inbox").set({
			status: "done",
			doneAt: (/* @__PURE__ */ new Date()).toISOString()
		}).where("id", "in", ids).execute();
		return ids.length;
	}
	/** 记一次投递失败；到次数上限转 `stalled`。 */
	async failDelivery(id, error, maxAttempts, ceilingSeconds) {
		const attempts = ((await this.db.selectFrom("inbox").select(["deliveryAttempts"]).where("id", "=", id).executeTakeFirst())?.deliveryAttempts ?? 0) + 1;
		const stalled = attempts >= maxAttempts;
		const delay = Math.min(2 ** attempts, ceilingSeconds);
		await this.db.updateTable("inbox").set({
			deliveryAttempts: attempts,
			deliveryError: error,
			nextRetryAt: stalled ? null : new Date(Date.now() + delay * 1e3).toISOString(),
			...stalled ? { status: "stalled" } : {}
		}).where("id", "=", id).execute();
		return stalled ? "stalled" : "pending";
	}
	/** 投递成功：清零重试计数。 */
	async delivered(id) {
		await this.db.updateTable("inbox").set({
			deliveryAttempts: 0,
			deliveryError: null,
			nextRetryAt: null,
			readAt: (/* @__PURE__ */ new Date()).toISOString()
		}).where("id", "=", id).execute();
	}
	/** 记一条 ask 的回答。填上它就把状态置为 `done`。 */
	async answer(id, text, by) {
		await this.db.updateTable("inbox").set({
			answer: text,
			answeredBy: by,
			answeredAt: (/* @__PURE__ */ new Date()).toISOString(),
			status: "done",
			doneAt: (/* @__PURE__ */ new Date()).toISOString()
		}).where("id", "=", id).execute();
	}
	/** 升级：就地改 type，不新建行。一个问题从头到尾只有一条记录、一个身份。 */
	async escalate(id, to) {
		const row = await this.db.selectFrom("inbox").select(["escalations"]).where("id", "=", id).executeTakeFirst();
		await this.db.updateTable("inbox").set({
			type: to,
			escalations: (row?.escalations ?? 0) + 1,
			lastEscalatedAt: (/* @__PURE__ */ new Date()).toISOString(),
			deadline: null
		}).where("id", "=", id).execute();
	}
	/** 投一条新消息。`seq` 自增，同票同地址靠它保序。 */
	async push(input) {
		const last = await this.db.selectFrom("inbox").select("seq").orderBy("seq", "desc").limit(1).executeTakeFirst();
		const seq = BigInt(last?.seq ?? 0) + 1n;
		const id = `inbox_${seq}_${Date.now().toString(36)}`;
		await this.db.insertInto("inbox").values({
			id,
			seq,
			type: input.type,
			origin: input.origin,
			kind: input.kind,
			message: input.message,
			status: "pending",
			createdAt: (/* @__PURE__ */ new Date()).toISOString(),
			...input.title ? { title: input.title } : {},
			...input.projectId ? { projectId: input.projectId } : {},
			...input.supervisorId ? { supervisorId: input.supervisorId } : {},
			...input.ticketId ? { ticketId: input.ticketId } : {},
			...input.threadId ? { threadId: input.threadId } : {},
			...input.triggerId ? { triggerId: input.triggerId } : {},
			...input.workerId ? { workerId: input.workerId } : {},
			...input.deadline ? { deadline: input.deadline } : {}
		}).execute();
		return id;
	}
	/** 扫超时的 ask。不靠后台定时器，和「你有 N 条未处理」共用同一次会话钩子。 */
	async overdue(now = (/* @__PURE__ */ new Date()).toISOString()) {
		return this.db.selectFrom("inbox").selectAll().where("kind", "=", "ask").where("status", "=", "pending").where("deadline", "is not", null).where("deadline", "<", now).execute();
	}
	/** 各 type 未读数，供面板侧边栏与总览用。 */
	async counts() {
		const rows = await this.db.selectFrom("inbox").select("type").where("status", "=", "pending").select((eb) => eb.fn.countAll().as("total")).groupBy("type").execute();
		const found = new Map(rows.map((row) => [row.type, Number(row.total)]));
		return Object.fromEntries(INBOX_TARGETS.map((type) => [type, found.get(type) ?? 0]));
	}
};
//#endregion
//#region src/database/models/project.ts
/** 一个项目 = 一个 git 仓库 + 一个 DSH 工作区。项目编排会话挂在它上面。 */
var Project = class extends Model {
	constructor(db) {
		super(db, "project", "id");
	}
	/** 项目 id → 展示名。各视图组装时都要用，集中在这里查。 */
	async nameMap() {
		const rows = await this.db.selectFrom("project").select(["id", "name"]).execute();
		return new Map(rows.map((row) => [row.id, row.name]));
	}
	/** 按工作区查项目。一个工作区只能绑一个项目。 */
	async byWorkspace(workspaceId) {
		return this.db.selectFrom("project").selectAll().where("workspaceId", "=", workspaceId).executeTakeFirst();
	}
	/** 已经被项目占用的工作区 id。`list_unbound_workspaces` 靠它做差集。 */
	async boundWorkspaceIds() {
		const rows = await this.db.selectFrom("project").select("workspaceId").execute();
		return new Set(rows.map((row) => row.workspaceId));
	}
	/** 新建项目并**新开**一个工作区。 */
	async createStandalone(input) {
		return this.insert({
			...input,
			workspaceId: `ws_${Date.now().toString(36)}`
		});
	}
	/** 新建项目并**绑定已有**工作区。 */
	async createBound(input) {
		return this.insert(input);
	}
	/** 落库前统一检查：工作区不能已被占用，id 不能重名。 */
	async insert(input) {
		const occupied = await this.byWorkspace(input.workspaceId);
		if (occupied) throw new Error(`工作区已被项目 ${occupied.name} 占用`);
		const id = input.name.replace(/\//g, "-");
		if (await this.findUnique(id).catch(() => void 0)) throw new Error(`项目 ${id} 已存在`);
		const now = (/* @__PURE__ */ new Date()).toISOString();
		const row = {
			id,
			channelId: input.channelId,
			name: input.name,
			workspaceId: input.workspaceId,
			directory: input.directory,
			orchestratorSessionId: null,
			createdAt: now,
			updatedAt: now
		};
		await this.create(row);
		return {
			id,
			workspaceId: input.workspaceId
		};
	}
};
//#endregion
//#region src/database/models/setting.ts
/** 每个键的默认值，与 `prisma/schema/setting.prisma` 的 `@default` 一一对应。 */
const FALLBACK = {
	maxWorkers: 4,
	backgroundLimitMinutes: 30,
	autoMerge: false,
	autoMergeMaxLines: 200,
	proxyDecide: false,
	askDeadlineMinutes: 30,
	deliveryMaxAttempts: 3,
	deliveryRetryCeilingSeconds: 60
};
/** 哪个键是布尔，写库时靠它决定怎么转。 */
const BOOLEAN_KEYS = /* @__PURE__ */ new Set(["autoMerge", "proxyDecide"]);
/**
* 全局配置。**只有一行**，`id = 'global'`。
*
* 库表从 Prisma 生成，布尔落成 `number`（0/1），所以读写都要在这一层转一次 ——
* 上层拿到的永远是真正的 boolean，不用到处散 `=== 1`。
*/
var Setting = class extends Model {
	constructor(db) {
		super(db, "setting", "id");
	}
	/** 读配置；没有那一行时回落到代码里的默认值，面板永远有东西显示。 */
	async read() {
		const row = await this.db.selectFrom("setting").selectAll().where("id", "=", "global").executeTakeFirst();
		return {
			values: Object.fromEntries(SETTING_KEYS.map((key) => [key, row ? toValue(key, row[key]) : FALLBACK[key]])),
			updatedAt: row?.updatedAt ?? ""
		};
	}
	/** 局部更新；只写传进来的键。返回最终生效的值。 */
	async save(patch) {
		const next = {};
		for (const key of SETTING_KEYS) {
			const value = patch[key];
			if (value === void 0) continue;
			next[key] = BOOLEAN_KEYS.has(key) ? value === true ? 1 : 0 : clamp(key, Number(value));
		}
		if (!Object.keys(next).length) return this.read();
		next.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
		if (await this.db.selectFrom("setting").select("id").where("id", "=", "global").executeTakeFirst()) await this.db.updateTable("setting").set(next).where("id", "=", "global").execute();
		else await this.db.insertInto("setting").values({
			id: "global",
			...next
		}).execute();
		return this.read();
	}
	/** 并发上限。槽位判断要用它，单独取一次比整行快。 */
	async maxWorkers() {
		return (await this.db.selectFrom("setting").select("maxWorkers").where("id", "=", "global").executeTakeFirst())?.maxWorkers ?? FALLBACK.maxWorkers;
	}
};
/** 库里的 0/1 或数字 → 上层要的值。 */
function toValue(key, raw) {
	if (BOOLEAN_KEYS.has(key)) return raw === 1 || raw === true;
	const value = Number(raw);
	const fallback = FALLBACK[key];
	return Number.isFinite(value) ? value : typeof fallback === "number" ? fallback : 0;
}
/** 数值键夹到合理范围，避免面板填出 0 或负数把系统卡死。 */
function clamp(key, value) {
	const fallback = FALLBACK[key];
	if (!Number.isFinite(value)) return typeof fallback === "number" ? fallback : 0;
	switch (key) {
		case "maxWorkers": return Math.min(16, Math.max(1, Math.round(value)));
		case "backgroundLimitMinutes": return Math.min(240, Math.max(1, Math.round(value)));
		case "autoMergeMaxLines": return Math.max(0, Math.round(value));
		case "askDeadlineMinutes": return Math.min(1440, Math.max(1, Math.round(value)));
		case "deliveryMaxAttempts": return Math.min(10, Math.max(1, Math.round(value)));
		case "deliveryRetryCeilingSeconds": return Math.min(600, Math.max(5, Math.round(value)));
		default: return Math.round(value);
	}
}
//#endregion
//#region src/database/models/supervisor.ts
/**
* 临时 Supervisor。一件工作跨两个以上项目时，主编排拉起来的协调者。
*
* 用完即弃：关联工单全部落地后 `status = closed`，从界面消失但行不删 ——
* 那几张工单还指着它说明自己当初为什么存在。
*/
var Supervisor = class extends Model {
	constructor(db) {
		super(db, "supervisor", "id");
	}
	/** 在协调的 Supervisor。 */
	async active() {
		return this.db.selectFrom("supervisor").selectAll().where("status", "=", "active").execute();
	}
	/** 某张票属于哪个 Supervisor。`report` / `ask` 带 `supervisorId` 前先查它。 */
	async ofTicket(ticketId) {
		return (await this.db.selectFrom("supervisor_ticket").innerJoin("supervisor", "supervisor.id", "supervisor_ticket.supervisorId").select("supervisor.id").where("supervisor_ticket.ticketId", "=", ticketId).where("supervisor.status", "=", "active").executeTakeFirst())?.id;
	}
	/** 这个 Supervisor 关注的票全部到终态了吗。收工条件。 */
	async settled(id) {
		const rows = await this.db.selectFrom("supervisor_ticket").innerJoin("ticket", "ticket.id", "supervisor_ticket.ticketId").select("ticket.status").where("supervisor_ticket.supervisorId", "=", id).execute();
		return rows.length > 0 && rows.every((row) => row.status === "done" || row.status === "cancelled");
	}
	/** 这个 Supervisor 现在管着哪几张票。每次醒来先看它，不能只信收件箱那一条。 */
	async ticketsOf(id) {
		return this.db.selectFrom("supervisor_ticket").innerJoin("ticket", "ticket.id", "supervisor_ticket.ticketId").select([
			"ticket.id",
			"ticket.title",
			"ticket.status",
			"ticket.prUrl",
			"ticket.prState"
		]).where("supervisor_ticket.supervisorId", "=", id).execute();
	}
	/** 收工。 */
	async close(id) {
		await this.db.updateTable("supervisor").set({
			status: "closed",
			closedAt: (/* @__PURE__ */ new Date()).toISOString()
		}).where("id", "=", id).execute();
	}
};
/** Supervisor 关联了哪些工单。全部分到终态，Supervisor 就该收工。 */
var SupervisorTicket = class extends Model {
	constructor(db) {
		super(db, "supervisor_ticket", "supervisorId");
	}
	/** 解除一张票的关联。票退回原项目编排，不取消。 */
	async detach(supervisorId, ticketId) {
		await this.db.deleteFrom("supervisor_ticket").where("supervisorId", "=", supervisorId).where("ticketId", "=", ticketId).execute();
	}
	/** 记一条关联。 */
	async attach(supervisorId, ticketId) {
		await this.db.insertInto("supervisor_ticket").values({
			supervisorId,
			ticketId,
			createdAt: (/* @__PURE__ */ new Date()).toISOString()
		}).execute();
	}
};
//#endregion
//#region src/database/models/thread.ts
/**
* 一个话题：issue、PR、分支 CI、或飞书话题串。
*
* `triage` 是主编排的判断结论，只写一次 —— 它既是「已经认领过」的凭据，
* 也是不让主编排被同一条话题反复叫醒的东西。
*/
var Thread = class extends Model {
	constructor(db) {
		super(db, "thread", "id");
	}
	/** 触发页的话题列表，按最近活动倒序。 */
	async brief(limit = 100) {
		const [rows, channels, projects] = await Promise.all([
			this.db.selectFrom("thread").selectAll().orderBy("updatedAt", "desc").limit(limit).execute(),
			this.db.selectFrom("channel").select(["id", "name"]).execute(),
			this.db.selectFrom("project").select(["id", "name"]).execute()
		]);
		const counts = await this.db.selectFrom("trigger").select("threadId").select((eb) => eb.fn.countAll().as("total")).groupBy("threadId").execute();
		const countMap = new Map(counts.map((row) => [row.threadId, Number(row.total)]));
		const channelMap = new Map(channels.map((row) => [row.id, row.name]));
		const projectMap = new Map(projects.map((row) => [row.id, row.name]));
		return rows.map((row) => ({
			key: row.id,
			title: row.title,
			kind: row.kind,
			channel: channelMap.get(row.channelId) ?? row.channelId,
			triage: row.triage,
			...row.projectId ? { project: projectMap.get(row.projectId) ?? row.projectId } : {},
			...row.url ? { url: row.url } : {},
			updatedAt: row.updatedAt,
			triggers: countMap.get(row.id) ?? 0
		}));
	}
	/** 触发页：话题列表 + 选中话题的触发；没选就只给列表。 */
	async page(threadKey) {
		const threads = await this.brief();
		if (!threadKey) return {
			threads,
			triggers: []
		};
		const selected = await this.findUnique(threadKey).catch(() => void 0);
		const triggers = await this.db.selectFrom("trigger").selectAll().where("threadId", "=", threadKey).orderBy("at", "desc").limit(100).execute();
		const channels = await this.db.selectFrom("channel").select(["id", "name"]).execute();
		const channelMap = new Map(channels.map((row) => [row.id, row.name]));
		return {
			threads,
			triggers: triggers.map((row) => ({
				id: row.id,
				kind: row.kind,
				channel: row.channelId,
				channelName: channelMap.get(row.channelId) ?? row.channelId,
				threadKey: row.threadId,
				threadTitle: selected?.title ?? row.threadId,
				threadKind: selected?.kind ?? "issue",
				...row.actorName ? { actorName: row.actorName } : {},
				human: row.human === 1,
				mentioned: row.mentioned === 1,
				text: row.text,
				...row.url ? { url: row.url } : {},
				at: row.at,
				...row.ref ? { ref: row.ref } : {}
			}))
		};
	}
	/** 写分诊结论。`claim` 时 `projectId` 必填。 */
	async triageTo(threadKey, triage, projectId) {
		if (triage === "claimed" && !projectId) throw new Error("claim 必须给 projectId");
		await this.db.updateTable("thread").set({
			triage,
			triagedAt: (/* @__PURE__ */ new Date()).toISOString(),
			...projectId ? { projectId } : {}
		}).where("id", "=", threadKey).execute();
	}
};
/** 渠道里发生的、不可变的一件事。`ref` 带分支名或 commit sha。 */
var Trigger = class extends Model {
	constructor(db) {
		super(db, "trigger", "id");
	}
	/** 24 小时内的触发计数，概览页用。 */
	async receivedSince(iso) {
		const row = await this.db.selectFrom("trigger").select((eb) => eb.fn.countAll().as("total")).where("at", ">=", iso).executeTakeFirst();
		return Number(row?.total ?? 0);
	}
	/**
	* 按分支名找触发。
	* PR 归哪张工单靠它判断：分支末段和 `Worker.branch` 末段对得上就是同一张票。
	*/
	async byBranchSuffix(suffix) {
		return this.db.selectFrom("trigger").selectAll().where("ref", "like", `%${suffix}`).execute();
	}
};
//#endregion
//#region src/database/models/ticket.ts
/**
* 一个任务。主编排分诊出来的一件具体工作。
*
* 没有 `draft`：任务一旦存在，`projectId` 就必须确定。
* 没有 `attention`：「需介入」由 pending ask 派生，不占状态位。
*/
var Ticket = class extends Model {
	inbox;
	constructor(db) {
		super(db, "ticket", "id");
		this.inbox = new Inbox(db);
	}
	/** 有 pending ask 的票。一次查完，不逐票查。 */
	async attentionIds() {
		const rows = await this.db.selectFrom("inbox").select("ticketId").where("kind", "=", "ask").where("status", "=", "pending").where("ticketId", "is not", null).execute();
		return new Set(rows.flatMap((row) => row.ticketId ? [row.ticketId] : []));
	}
	/** 任务列表。`filter` 只影响返回的票，不影响计数。 */
	async board(filter) {
		const [rows, projects, channels, attention] = await Promise.all([
			this.db.selectFrom("ticket").selectAll().orderBy("updatedAt", "desc").execute(),
			this.db.selectFrom("project").select(["id", "name"]).execute(),
			this.db.selectFrom("channel").select(["id", "name"]).execute(),
			this.attentionIds()
		]);
		const projectMap = new Map(projects.map((row) => [row.id, row.name]));
		const channelMap = new Map(channels.map((row) => [row.id, row.name]));
		const briefs = rows.map((row) => toBrief(row, projectMap, channelMap, attention));
		const counts = {
			all: rows.length,
			attention: attention.size
		};
		for (const status of TICKET_STATUSES) counts[status] = rows.filter((row) => row.status === status).length;
		return {
			tickets: !filter || filter === "all" ? briefs : briefs.filter((brief) => brief.status === filter),
			counts
		};
	}
	/** 最近任务，概览页用。 */
	async recent(limit = 8) {
		const { tickets } = await this.board();
		return tickets.slice(0, limit);
	}
	/** 详情：话题、关联、Worker、收件箱一次取齐。 */
	async detail(id) {
		const [row, projects, channels, attention] = await Promise.all([
			this.db.selectFrom("ticket").selectAll().where("id", "=", id).executeTakeFirst(),
			this.db.selectFrom("project").select(["id", "name"]).execute(),
			this.db.selectFrom("channel").select(["id", "name"]).execute(),
			this.attentionIds()
		]);
		if (!row) return void 0;
		const [threadRows, linkRows, workerRows, inboxRows] = await Promise.all([
			this.db.selectFrom("ticket_thread").innerJoin("thread", "thread.id", "ticket_thread.threadId").select([
				"thread.id as key",
				"thread.title",
				"thread.kind",
				"thread.url",
				"ticket_thread.createdAt"
			]).where("ticket_thread.ticketId", "=", id).orderBy("ticket_thread.createdAt", "asc").execute(),
			this.db.selectFrom("ticket_link").innerJoin("ticket", "ticket.id", "ticket_link.relatedId").select([
				"ticket.id",
				"ticket.title",
				"ticket.status",
				"ticket_link.kind"
			]).where("ticket_link.ticketId", "=", id).execute(),
			this.db.selectFrom("worker").selectAll().where("ticketId", "=", id).orderBy("createdAt", "desc").execute(),
			this.db.selectFrom("inbox").selectAll().where("ticketId", "=", id).orderBy("seq", "desc").limit(50).execute()
		]);
		const threads = threadRows.map((thread) => ({
			key: thread.key,
			title: thread.title,
			kind: thread.kind,
			...thread.url ? { url: thread.url } : {}
		}));
		const links = linkRows.map((link) => ({
			id: link.id,
			title: link.title,
			kind: link.kind,
			status: link.status
		}));
		const workers = workerRows.map((worker) => ({
			id: worker.id,
			status: worker.status,
			...worker.title ? { title: worker.title } : {},
			...worker.branch ? { branch: worker.branch } : {},
			...worker.reportState ? { reportState: worker.reportState } : {},
			...worker.report ? { report: worker.report } : {},
			...worker.reportAt ? { reportAt: worker.reportAt } : {},
			...worker.backgroundUntil ? { backgroundUntil: worker.backgroundUntil } : {},
			...worker.recoveryNote ? { recoveryNote: worker.recoveryNote } : {}
		}));
		return {
			...toBrief(row, new Map(projects.map((p) => [p.id, p.name])), new Map(channels.map((c) => [c.id, c.name])), attention),
			...row.description ? { description: row.description } : {},
			createdAt: row.createdAt,
			...row.startedAt ? { startedAt: row.startedAt } : {},
			...row.endedAt ? { endedAt: row.endedAt } : {},
			...row.prUrl ? { prUrl: row.prUrl } : {},
			...row.prState ? { prState: row.prState } : {},
			...row.ciState ? { ciState: row.ciState } : {},
			paused: row.paused === 1,
			...row.prepareError ? { prepareError: row.prepareError } : {},
			threads,
			links,
			workers,
			inbox: inboxRows.map((row) => this.inbox.brief(row))
		};
	}
	/** 暂停 / 恢复。在任务详情里按，不是全局开关。 */
	async setPaused(id, paused) {
		await this.db.updateTable("ticket").set({
			paused: paused ? 1 : 0,
			updatedAt: (/* @__PURE__ */ new Date()).toISOString()
		}).where("id", "=", id).execute();
	}
	/** 状态机迁移。`done` / `cancelled` 是终态。 */
	async setStatus(id, status) {
		const now = (/* @__PURE__ */ new Date()).toISOString();
		await this.db.updateTable("ticket").set({
			status,
			updatedAt: now,
			...status === "running" ? { startedAt: now } : {},
			...status === "done" || status === "cancelled" ? { endedAt: now } : {}
		}).where("id", "=", id).execute();
	}
	/** 下一个任务号。`T-105` 这种，人和代理都靠它互相指代。 */
	async nextId() {
		return `T-${(await this.db.selectFrom("ticket").select("id").execute()).reduce((acc, row) => {
			const matched = /^T-(\d+)$/.exec(row.id);
			return matched ? Math.max(acc, Number(matched[1])) : acc;
		}, 100) + 1}`;
	}
	/** 每个状态各几张。概览页用。 */
	async statusCounts() {
		const rows = await this.db.selectFrom("ticket").select("status").select((eb) => eb.fn.countAll().as("total")).groupBy("status").execute();
		const found = new Map(rows.map((row) => [row.status, Number(row.total)]));
		return Object.fromEntries(TICKET_STATUSES.map((status) => [status, found.get(status) ?? 0]));
	}
};
/** 任务 ↔ 话题。这就是「订阅」：话题上再来新触发，就该冒到编排的收件箱。 */
var TicketThread = class extends Model {
	constructor(db) {
		super(db, "ticket_thread", "ticketId");
	}
};
/** 任务 ↔ 任务。`depends` 到终态时会自动通知该票所属的 Supervisor。 */
var TicketLink = class extends Model {
	constructor(db) {
		super(db, "ticket_link", "relatedId");
	}
};
/** 行 → 卡片。`attention` 由 pending ask 派生。 */
function toBrief(row, projects, channels, attention) {
	return {
		id: row.id,
		title: row.title,
		status: row.status,
		project: projects.get(row.projectId) ?? row.projectId,
		channel: channels.get(row.channelId) ?? row.channelId,
		updatedAt: row.updatedAt,
		attention: attention.has(row.id),
		...row.prepareError ? { error: row.prepareError } : {}
	};
}
//#endregion
//#region src/database/models/worker.ts
/**
* 一个 Worker（执行会话）。任务里真正干活的那一段，短命。
*
* **一个 Worker 只有一个 worktree**，所以分支和路径直接放在这一行上。
* **没有收件箱**：它被动、等的时候是阻塞的，上级的话直接 prompt 进会话。
*/
var Worker = class extends Model {
	constructor(db) {
		super(db, "worker", "id");
	}
	brief(row) {
		return {
			id: row.id,
			status: row.status,
			...row.title ? { title: row.title } : {},
			...row.branch ? { branch: row.branch } : {},
			...row.reportState ? { reportState: row.reportState } : {},
			...row.report ? { report: row.report } : {},
			...row.reportAt ? { reportAt: row.reportAt } : {},
			...row.backgroundUntil ? { backgroundUntil: row.backgroundUntil } : {},
			...row.recoveryNote ? { recoveryNote: row.recoveryNote } : {}
		};
	}
	/** 某个任务下的所有 Worker，最新在前。 */
	async ofTicket(ticketId) {
		return (await this.db.selectFrom("worker").selectAll().where("ticketId", "=", ticketId).orderBy("createdAt", "desc").execute()).map((row) => this.brief(row));
	}
	/** 正在跑的 Worker。槽位统计要用它。 */
	async running() {
		return (await this.db.selectFrom("worker").selectAll().where("status", "=", "running").execute()).map((row) => this.brief(row));
	}
	/**
	* 占着槽位的 Worker 数。
	*
	* 回合结束但有后台任务在跑的，`backgroundUntil` 非空 —— 它**继续占槽**，
	* 否则槽位被别的票占了，任务起了服务器却没人接。
	*/
	async holdingSlots(now = (/* @__PURE__ */ new Date()).toISOString()) {
		return (await this.db.selectFrom("worker").select(["status", "backgroundUntil"]).execute()).filter((row) => row.status === "running" || row.backgroundUntil !== null && row.backgroundUntil > now).length;
	}
	/** 记汇报。`dropped` 表示「这事不用做了」，票直接结束。 */
	async report(id, state, summary) {
		await this.db.updateTable("worker").set({
			reportState: state,
			report: summary,
			reportAt: (/* @__PURE__ */ new Date()).toISOString()
		}).where("id", "=", id).execute();
	}
	/** 收工。保留 `branch` / `worktree` —— 那是「曾在哪干过」的唯一记录。 */
	async end(id, reason) {
		await this.db.updateTable("worker").set({
			status: "ended",
			endedAt: (/* @__PURE__ */ new Date()).toISOString(),
			endedReason: reason
		}).where("id", "=", id).execute();
	}
	/** 改标题，让面板一眼看懂这个会话在干嘛。 */
	async rename(id, title) {
		await this.db.updateTable("worker").set({ title }).where("id", "=", id).execute();
	}
	/** 后台工作的截止时刻。超过它就该杀掉后台并报 waiting。 */
	async deadline(id, limitMinutes) {
		const until = new Date(Date.now() + limitMinutes * 6e4).toISOString();
		await this.db.updateTable("worker").set({ backgroundUntil: until }).where("id", "=", id).execute();
		return until;
	}
};
//#endregion
//#region src/database/schema.ts
/**
* 建表 SQL。由 `prisma migrate diff --from-empty --to-schema prisma/schema --script`
* 生成，去掉 CLI 横幅后批量加 `IF NOT EXISTS`，所以启动时重复执行是安全的。
*
* 生成命令见 `prisma/README.md`。**改 schema 之后必须重新生成** ——
* 两边不一致时面板会读到缺列的表。
*/
const SCHEMA_SQL = `
-- CreateTable
CREATE TABLE IF NOT EXISTS "channel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "host" TEXT,
    "createdAt" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "channel_account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "channelId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatar" TEXT,
    "status" TEXT NOT NULL DEFAULT 'offline',
    "createdAt" TEXT NOT NULL,
    CONSTRAINT "channel_account_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ci_watch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "channelId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "head" TEXT,
    "updatedAt" TEXT NOT NULL,
    CONSTRAINT "ci_watch_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "source_state" (
    "channelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL,

    PRIMARY KEY ("channelId", "name"),
    CONSTRAINT "source_state_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "inbox" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "seq" BIGINT NOT NULL,
    "type" TEXT NOT NULL,
    "projectId" TEXT,
    "supervisorId" TEXT,
    "origin" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "kind" TEXT NOT NULL,
    "title" TEXT,
    "message" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL,
    "doneAt" TEXT,
    "deliveryAttempts" INTEGER NOT NULL DEFAULT 0,
    "deliveryError" TEXT,
    "nextRetryAt" TEXT,
    "readAt" TEXT,
    "deadline" TEXT,
    "escalations" INTEGER NOT NULL DEFAULT 0,
    "lastEscalatedAt" TEXT,
    "answer" TEXT,
    "answeredBy" TEXT,
    "answeredAt" TEXT,
    "triggerId" TEXT,
    "threadId" TEXT,
    "ticketId" TEXT,
    "workerId" TEXT,
    CONSTRAINT "inbox_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "inbox_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "supervisor" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "inbox_triggerId_fkey" FOREIGN KEY ("triggerId") REFERENCES "trigger" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "inbox_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "thread" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "inbox_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "ticket" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "inbox_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "worker" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "channelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "directory" TEXT NOT NULL,
    "orchestratorSessionId" TEXT,
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL,
    CONSTRAINT "project_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "setting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "maxWorkers" INTEGER NOT NULL DEFAULT 4,
    "backgroundLimitMinutes" INTEGER NOT NULL DEFAULT 30,
    "autoMerge" BOOLEAN NOT NULL DEFAULT false,
    "autoMergeMaxLines" INTEGER NOT NULL DEFAULT 200,
    "proxyDecide" BOOLEAN NOT NULL DEFAULT false,
    "askDeadlineMinutes" INTEGER NOT NULL DEFAULT 30,
    "deliveryMaxAttempts" INTEGER NOT NULL DEFAULT 3,
    "deliveryRetryCeilingSeconds" INTEGER NOT NULL DEFAULT 60,
    "updatedAt" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "supervisor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT,
    "title" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TEXT NOT NULL,
    "closedAt" TEXT
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "supervisor_ticket" (
    "supervisorId" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL,

    PRIMARY KEY ("supervisorId", "ticketId"),
    CONSTRAINT "supervisor_ticket_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "supervisor" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "supervisor_ticket_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "ticket" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "thread" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "channelId" TEXT NOT NULL,
    "projectId" TEXT,
    "refId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT,
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL,
    "triage" TEXT NOT NULL DEFAULT 'pending',
    "triagedAt" TEXT,
    CONSTRAINT "thread_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "thread_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "trigger" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "channelId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "actorName" TEXT,
    "human" BOOLEAN NOT NULL DEFAULT true,
    "mentioned" BOOLEAN NOT NULL DEFAULT false,
    "text" TEXT NOT NULL,
    "url" TEXT,
    "at" TEXT NOT NULL,
    "ref" TEXT,
    CONSTRAINT "trigger_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "trigger_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "thread" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ticket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL,
    "startedAt" TEXT,
    "endedAt" TEXT,
    "prUrl" TEXT,
    "prState" TEXT,
    "ciState" TEXT,
    "paused" BOOLEAN NOT NULL DEFAULT false,
    "prepareError" TEXT,
    CONSTRAINT "ticket_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ticket_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ticket_thread" (
    "ticketId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL,

    PRIMARY KEY ("ticketId", "threadId"),
    CONSTRAINT "ticket_thread_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "ticket" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ticket_thread_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "thread" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ticket_link" (
    "ticketId" TEXT NOT NULL,
    "relatedId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL,

    PRIMARY KEY ("ticketId", "relatedId", "kind"),
    CONSTRAINT "ticket_link_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "ticket" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ticket_link_relatedId_fkey" FOREIGN KEY ("relatedId") REFERENCES "ticket" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "worker" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticketId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL,
    "startedAt" TEXT,
    "endedAt" TEXT,
    "title" TEXT,
    "endedReason" TEXT,
    "branch" TEXT,
    "worktree" TEXT,
    "reportState" TEXT,
    "report" TEXT,
    "reportAt" TEXT,
    "backgroundUntil" TEXT,
    "recoveryNote" TEXT,
    CONSTRAINT "worker_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "ticket" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "channel_account_channelId_role_idx" ON "channel_account"("channelId", "role");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "channel_account_channelId_role_name_key" ON "channel_account"("channelId", "role", "name");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ci_watch_channelId_kind_ref_key" ON "ci_watch"("channelId", "kind", "ref");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "source_state_updatedAt_idx" ON "source_state"("updatedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "inbox_type_projectId_status_idx" ON "inbox"("type", "projectId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "inbox_type_status_createdAt_idx" ON "inbox"("type", "status", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "inbox_status_createdAt_idx" ON "inbox"("status", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "inbox_kind_status_deadline_idx" ON "inbox"("kind", "status", "deadline");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "inbox_ticketId_seq_idx" ON "inbox"("ticketId", "seq");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "inbox_status_nextRetryAt_idx" ON "inbox"("status", "nextRetryAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "project_workspaceId_key" ON "project"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "project_channelId_name_key" ON "project"("channelId", "name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "supervisor_status_idx" ON "supervisor"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "supervisor_ticket_ticketId_idx" ON "supervisor_ticket"("ticketId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "thread_updatedAt_idx" ON "thread"("updatedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "thread_projectId_idx" ON "thread"("projectId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "thread_triage_idx" ON "thread"("triage");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "thread_channelId_refId_key" ON "thread"("channelId", "refId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "trigger_threadId_at_idx" ON "trigger"("threadId", "at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "trigger_channelId_at_idx" ON "trigger"("channelId", "at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "trigger_at_idx" ON "trigger"("at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "trigger_ref_idx" ON "trigger"("ref");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ticket_projectId_status_idx" ON "ticket"("projectId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ticket_status_updatedAt_idx" ON "ticket"("status", "updatedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ticket_thread_ticketId_createdAt_idx" ON "ticket_thread"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ticket_thread_threadId_idx" ON "ticket_thread"("threadId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ticket_link_relatedId_idx" ON "ticket_link"("relatedId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "worker_ticketId_createdAt_idx" ON "worker"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "worker_status_idx" ON "worker"("status");
`;
//#endregion
//#region src/database/index.ts
/**
* 库文件位置。
*
* **不能用相对路径。** 宿主的工作目录是 profile 目录，插件被 require 的时机
* 又和 `apply()` 不同，相对路径会解析到两个不同的文件 —— 结果是建表建在一个库、
* 查询查另一个库，报 `no such table`。
*/
const DATA_DIR = join(homedir(), ".dsh", "nexus");
mkdirSync(DATA_DIR, { recursive: true });
const sqlite = new DatabaseSync(join(DATA_DIR, "nexus.db"));
const statements = SCHEMA_SQL.split("\n").filter((line) => !line.trimStart().startsWith("--")).join("\n").split(";").map((statement) => statement.trim()).filter(Boolean);
for (const statement of statements) sqlite.exec(`${statement};`);
const connection = new Kysely({ dialect: new NodeSqliteDialect({ database: sqlite }) });
/**
* 一个连接 + 每张表一个 model。
*
* model 只包 CRUD 与「这张表自己的查询」；跨表组装放在需要它的那个 model 上
* （例如 `ticket.board()` 自己取项目名和渠道名），不在路由层拼 SQL。
*/
const db = Object.assign(connection, {
	channel: new Channel(connection),
	channelAccount: new ChannelAccount(connection),
	ciWatch: new CiWatch(connection),
	sourceState: new SourceState(connection),
	project: new Project(connection),
	thread: new Thread(connection),
	trigger: new Trigger(connection),
	ticket: new Ticket(connection),
	ticketThread: new TicketThread(connection),
	ticketLink: new TicketLink(connection),
	worker: new Worker(connection),
	inbox: new Inbox(connection),
	supervisor: new Supervisor(connection),
	supervisorTicket: new SupervisorTicket(connection),
	setting: new Setting(connection)
});
//#endregion
//#region src/server/routes/channel-enabled.post.ts
const channelEnabledHandler = defineEventHandler(async (event) => {
	const body = await readBody(event) ?? {};
	await db.channel.setEnabled(getRouterParam(event, "id") ?? "", body.enabled === true);
	return {
		ok: true,
		message: body.enabled ? "已开启监听" : "已关闭监听"
	};
});
//#endregion
//#region src/server/routes/channels.get.ts
const channelsHandler = defineEventHandler(async () => {
	return { channels: await db.channel.detail() };
});
//#endregion
//#region src/server/routes/inbox-kill.post.ts
const inboxKillHandler = defineEventHandler(async (event) => {
	const body = await readBody(event) ?? {};
	const killed = await db.inbox.kill(body.ids ?? []);
	return {
		ok: true,
		message: killed ? `已处理 ${killed} 条` : "没有要处理的条目"
	};
});
//#endregion
//#region src/server/routes/inbox.get.ts
const inboxHandler = defineEventHandler(async (event) => {
	const { type } = getQuery(event);
	return db.inbox.page(type);
});
//#endregion
//#region src/server/routes/overview.get.ts
const overviewHandler = defineEventHandler(async () => {
	const [channels, tickets, received24h, recent, projects, supervisors] = await Promise.all([
		db.channel.summary(),
		db.ticket.statusCounts(),
		db.trigger.receivedSince((/* @__PURE__ */ new Date(Date.now() - 24 * 36e5)).toISOString()),
		db.ticket.recent(8),
		db.project.findMany(),
		db.supervisor.active()
	]);
	const nodes = [{
		id: "main",
		kind: "main",
		label: "主编排"
	}];
	const edges = [];
	for (const channel of channels) {
		nodes.push({
			id: `channel:${channel.id}`,
			kind: "channel",
			label: channel.name,
			detail: channel.enabled ? `监听中 · ${channel.threads} 个话题` : "已关闭"
		});
		if (channel.enabled) edges.push({
			from: `channel:${channel.id}`,
			to: "main",
			kind: "trigger",
			label: "trigger"
		});
	}
	for (const project of projects) {
		nodes.push({
			id: `project:${project.id}`,
			kind: "project",
			label: project.name
		});
		edges.push({
			from: "main",
			to: `project:${project.id}`,
			kind: "dispatch",
			label: "dispatch"
		});
	}
	for (const supervisor of supervisors) {
		nodes.push({
			id: `supervisor:${supervisor.id}`,
			kind: "supervisor",
			label: supervisor.title,
			detail: "临时协调者"
		});
		edges.push({
			from: "main",
			to: `supervisor:${supervisor.id}`,
			kind: "supervise",
			label: "supervise"
		});
	}
	for (const ticket of recent) {
		nodes.push({
			id: `ticket:${ticket.id}`,
			kind: "ticket",
			label: `${ticket.id} ${ticket.title}`,
			detail: ticket.status,
			...ticket.attention ? { attention: true } : {}
		});
		edges.push({
			from: `project:${ticket.project}`,
			to: `ticket:${ticket.id}`,
			kind: "delegate"
		});
	}
	return {
		stats: {
			channels,
			received24h,
			filtered24h: 0,
			tickets
		},
		recent,
		graph: {
			nodes,
			edges
		}
	};
});
//#endregion
//#region src/server/routes/projects.get.ts
const projectsHandler = defineEventHandler(async () => {
	return { projects: (await db.project.findMany()).map((row) => ({
		id: row.id,
		name: row.name,
		workspaceId: row.workspaceId,
		directory: row.directory
	})) };
});
//#endregion
//#region src/server/routes/settings.get.ts
const settingsHandler = defineEventHandler(async () => db.setting.read());
//#endregion
//#region src/server/routes/settings.post.ts
const settingsSaveHandler = defineEventHandler(async (event) => {
	const body = await readBody(event) ?? {};
	const patch = Object.fromEntries(SETTING_KEYS.filter((key) => body[key] !== void 0).map((key) => [key, body[key]]));
	await db.setting.save(patch);
	return {
		ok: true,
		message: "设置已保存"
	};
});
//#endregion
//#region src/server/routes/tasks.get.ts
const tasksHandler = defineEventHandler(async (event) => {
	const { filter } = getQuery(event);
	return db.ticket.board(filter);
});
//#endregion
//#region src/server/routes/ticket-pause.post.ts
const ticketPauseHandler = defineEventHandler(async (event) => {
	const body = await readBody(event) ?? {};
	await db.ticket.setPaused(getRouterParam(event, "id") ?? "", body.paused === true);
	return {
		ok: true,
		message: body.paused ? "已暂停" : "已恢复"
	};
});
//#endregion
//#region src/server/routes/ticket.get.ts
const ticketHandler = defineEventHandler(async (event) => {
	const id = getRouterParam(event, "id") ?? "";
	const detail = await db.ticket.detail(id);
	if (!detail) throw createError({
		statusCode: 404,
		statusMessage: `任务 ${id} 不存在`
	});
	return detail;
});
//#endregion
//#region src/server/routes/triggers.get.ts
const triggersHandler = defineEventHandler(async (event) => {
	const { thread } = getQuery(event);
	return db.thread.page(thread);
});
//#endregion
//#region src/server/index.ts
/**
* Nexus 面板的 HTTP 服务。
*
* 路由只做三件事：取参数、调 model、返回。**不写 SQL** —— 查询都在
* `src/database/models/` 里，按表归属。
*
* 挂在宿主既有的 `ctx.webServer` 上，不额外起服务、不占端口。
*
* GenAPI 要求：`setup` 里只能有一句一句的 `app.method(...)`，不能有条件、循环、
* 嵌套函数。所以每个 handler 都拆到 `routes/` 下的独立文件。
*/
const server = defineWebServer((app) => {
	app.get("/api/nexus/overview", overviewHandler);
	app.get("/api/nexus/tasks", tasksHandler);
	app.get("/api/nexus/tickets/:id", ticketHandler);
	app.post("/api/nexus/tickets/:id/pause", ticketPauseHandler);
	app.get("/api/nexus/triggers", triggersHandler);
	app.get("/api/nexus/channels", channelsHandler);
	app.post("/api/nexus/channels/:id/enabled", channelEnabledHandler);
	app.get("/api/nexus/inbox", inboxHandler);
	app.post("/api/nexus/inbox/kill", inboxKillHandler);
	app.get("/api/nexus/settings", settingsHandler);
	app.post("/api/nexus/settings", settingsSaveHandler);
	app.get("/api/nexus/projects", projectsHandler);
});
//#endregion
//#region src/index.ts
const inject = ["webServer"];
/**
* 挂上 `ctx.webServer` 的路由。卸载时 Cordis 自动摘除。
*
* 工具与角色的注册走宿主的工具注册表；宿主没提供时只挂面板，
* 不报错 —— 面板本身是可用的。
*/
function apply(ctx) {
	ctx.effect(() => server(ctx, { entry: "nexus" }), "nexus:routes");
}
//#endregion
export { apply, inject };

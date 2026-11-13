/*
 * @title index
 * @swagger 2.0
 * @version 0.0.0
 */

import type * as Types from "./index.type";

/** @method get */
export async function getApiNexusOverview(config?: RequestInit) {
  const response = await fetch("/api/nexus/overview", {
    ...config,
  });
  return response.json() as Promise<Types.GetApiNexusOverviewResponse>;
}

/** @method get */
export async function getApiNexusTasks(query?: Types.GetApiNexusTasksQuery, config?: RequestInit) {
  const querystr = new URLSearchParams(Object.entries(query || {}));
  const response = await fetch(`/api/nexus/tasks?${querystr}`, {
    ...config,
  });
  return response.json() as Promise<Types.GetApiNexusTasksResponse>;
}

/** @method get */
export async function getApiNexusTicketsId(paths: Types.GetApiNexusTicketsidPath, config?: RequestInit) {
  const response = await fetch(`/api/nexus/tickets/${paths.id}`, {
    ...config,
  });
  return response.json() as Promise<Types.GetApiNexusTicketsidResponse>;
}

/** @method post */
export async function postApiNexusTicketsIdPause(paths: Types.PostApiNexusTicketsidPausePath, body: Types.PostApiNexusTicketsidPauseBody, config?: RequestInit) {
  const response = await fetch(`/api/nexus/tickets/${paths.id}/pause`, {
    headers: { "Content-Type": "application/json" },
    method: "post",
    body: JSON.stringify(body),
    ...config,
  });
  return response.json() as Promise<Types.PostApiNexusTicketsidPauseResponse>;
}

/** @method get */
export async function getApiNexusTriggers(query?: Types.GetApiNexusTriggersQuery, config?: RequestInit) {
  const querystr = new URLSearchParams(Object.entries(query || {}));
  const response = await fetch(`/api/nexus/triggers?${querystr}`, {
    ...config,
  });
  return response.json() as Promise<Types.GetApiNexusTriggersResponse>;
}

/** @method get */
export async function getApiNexusChannels(config?: RequestInit) {
  const response = await fetch("/api/nexus/channels", {
    ...config,
  });
  return response.json() as Promise<Types.GetApiNexusChannelsResponse>;
}

/** @method post */
export async function postApiNexusChannelsCreate(body: Types.PostApiNexusChannelsCreateBody, config?: RequestInit) {
  const response = await fetch("/api/nexus/channels/create", {
    headers: { "Content-Type": "application/json" },
    method: "post",
    body: JSON.stringify(body),
    ...config,
  });
  return response.json() as Promise<Types.PostApiNexusChannelsCreateResponse>;
}

/** @method post */
export async function postApiNexusChannelsIdEnabled(paths: Types.PostApiNexusChannelsidEnabledPath, body: Types.PostApiNexusChannelsidEnabledBody, config?: RequestInit) {
  const response = await fetch(`/api/nexus/channels/${paths.id}/enabled`, {
    headers: { "Content-Type": "application/json" },
    method: "post",
    body: JSON.stringify(body),
    ...config,
  });
  return response.json() as Promise<Types.PostApiNexusChannelsidEnabledResponse>;
}

/** @method get */
export async function getApiNexusInbox(query?: Types.GetApiNexusInboxQuery, config?: RequestInit) {
  const querystr = new URLSearchParams(Object.entries(query || {}));
  const response = await fetch(`/api/nexus/inbox?${querystr}`, {
    ...config,
  });
  return response.json() as Promise<Types.GetApiNexusInboxResponse>;
}

/** @method post */
export async function postApiNexusInboxKill(body: Types.PostApiNexusInboxKillBody, config?: RequestInit) {
  const response = await fetch("/api/nexus/inbox/kill", {
    headers: { "Content-Type": "application/json" },
    method: "post",
    body: JSON.stringify(body),
    ...config,
  });
  return response.json() as Promise<Types.PostApiNexusInboxKillResponse>;
}

/** @method get */
export async function getApiNexusSettings(config?: RequestInit) {
  const response = await fetch("/api/nexus/settings", {
    ...config,
  });
  return response.json() as Promise<Types.GetApiNexusSettingsResponse>;
}

/** @method post */
export async function postApiNexusSettings(body: Types.PostApiNexusSettingsBody, config?: RequestInit) {
  const response = await fetch("/api/nexus/settings", {
    headers: { "Content-Type": "application/json" },
    method: "post",
    body: JSON.stringify(body),
    ...config,
  });
  return response.json() as Promise<Types.PostApiNexusSettingsResponse>;
}

/** @method get */
export async function getApiNexusProjects(config?: RequestInit) {
  const response = await fetch("/api/nexus/projects", {
    ...config,
  });
  return response.json() as Promise<Types.GetApiNexusProjectsResponse>;
}

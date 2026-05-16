// Preconfigured storage helpers for Manus WebDev templates
// Uses the Biz-provided storage proxy (Authorization: Bearer <token>)

import { ENV } from './_core/env';

type StorageConfig = { baseUrl: string; apiKey: string };

const DEFAULT_STORAGE_TIMEOUT_MS = 8_000;
const STORAGE_DIAGNOSTIC_TEXT = "dxfai-storage-diagnostic";

type StorageDiagnosticStage = {
  name: "config" | "upload" | "downloadUrl";
  ok: boolean;
  durationMs: number;
  status?: number;
  statusText?: string;
  errorName?: string;
  errorMessage?: string;
  timedOut?: boolean;
};

export type StorageDiagnosticReport = {
  ok: boolean;
  checkedAt: string;
  hasBaseUrl: boolean;
  hasApiKey: boolean;
  baseHost?: string;
  probeKey?: string;
  stages: StorageDiagnosticStage[];
};

async function fetchWithTimeout(
  url: URL,
  init: RequestInit,
  timeoutMs = DEFAULT_STORAGE_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`Storage request timed out (ETIMEDOUT) after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

function getStorageConfig(): StorageConfig {
  const baseUrl = ENV.forgeApiUrl;
  const apiKey = ENV.forgeApiKey;

  if (!baseUrl || !apiKey) {
    throw new Error(
      "Storage proxy credentials missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY"
    );
  }

  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey };
}

function buildUploadUrl(baseUrl: string, relKey: string): URL {
  const url = new URL("v1/storage/upload", ensureTrailingSlash(baseUrl));
  url.searchParams.set("path", normalizeKey(relKey));
  return url;
}

async function buildDownloadUrl(
  baseUrl: string,
  relKey: string,
  apiKey: string
): Promise<string> {
  const downloadApiUrl = new URL(
    "v1/storage/downloadUrl",
    ensureTrailingSlash(baseUrl)
  );
  downloadApiUrl.searchParams.set("path", normalizeKey(relKey));
  const response = await fetchWithTimeout(downloadApiUrl, {
    method: "GET",
    headers: buildAuthHeaders(apiKey),
  });
  return (await response.json()).url;
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function toFormData(
  data: Buffer | Uint8Array | string,
  contentType: string,
  fileName: string
): FormData {
  const blob =
    typeof data === "string"
      ? new Blob([data], { type: contentType })
      : new Blob([data as any], { type: contentType });
  const form = new FormData();
  form.append("file", blob, fileName || "file");
  return form;
}

function buildAuthHeaders(apiKey: string): HeadersInit {
  return { Authorization: `Bearer ${apiKey}` };
}

function describeStorageError(err: unknown): Pick<StorageDiagnosticStage, "errorName" | "errorMessage" | "timedOut"> {
  const errorName = err instanceof Error ? err.name : typeof err;
  const rawMessage = err instanceof Error ? err.message : String(err);
  return {
    errorName,
    errorMessage: rawMessage.slice(0, 500),
    timedOut: /timed out|ETIMEDOUT|AbortError/i.test(`${errorName} ${rawMessage}`),
  };
}

async function safeResponseBody(response: Response): Promise<string> {
  try {
    return (await response.text()).slice(0, 500);
  } catch {
    return response.statusText.slice(0, 500);
  }
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const { baseUrl, apiKey } = getStorageConfig();
  const key = normalizeKey(relKey);
  const uploadUrl = buildUploadUrl(baseUrl, key);
  const formData = toFormData(data, contentType, key.split("/").pop() ?? key);
  const response = await fetchWithTimeout(uploadUrl, {
    method: "POST",
    headers: buildAuthHeaders(apiKey),
    body: formData,
  });

  if (!response.ok) {
    const message = await safeResponseBody(response);
    throw new Error(
      `Storage upload failed (${response.status} ${response.statusText}): ${message}`
    );
  }
  const url = (await response.json()).url;
  return { key, url };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string; }> {
  const { baseUrl, apiKey } = getStorageConfig();
  const key = normalizeKey(relKey);
  return {
    key,
    url: await buildDownloadUrl(baseUrl, key, apiKey),
  };
}

/**
 * Admin-only diagnostic helper.
 * It uploads a tiny non-user text probe and asks the proxy for a download URL.
 * The report intentionally exposes only config presence, host, timings, status codes,
 * and sanitized errors; it never returns the bearer token or signed download URL.
 */
export async function diagnoseStorageProxy(timeoutMs = DEFAULT_STORAGE_TIMEOUT_MS): Promise<StorageDiagnosticReport> {
  const report: StorageDiagnosticReport = {
    ok: false,
    checkedAt: new Date().toISOString(),
    hasBaseUrl: Boolean(ENV.forgeApiUrl),
    hasApiKey: Boolean(ENV.forgeApiKey),
    stages: [],
  };

  const configStart = Date.now();
  let config: StorageConfig;
  try {
    config = getStorageConfig();
    report.baseHost = new URL(config.baseUrl).hostname;
    report.stages.push({ name: "config", ok: true, durationMs: Date.now() - configStart });
  } catch (err) {
    report.stages.push({
      name: "config",
      ok: false,
      durationMs: Date.now() - configStart,
      ...describeStorageError(err),
    });
    return report;
  }

  const probeKey = `diagnostics/storage-probe-${Date.now()}.txt`;
  report.probeKey = probeKey;

  const uploadStart = Date.now();
  try {
    const uploadUrl = buildUploadUrl(config.baseUrl, probeKey);
    const uploadResponse = await fetchWithTimeout(uploadUrl, {
      method: "POST",
      headers: buildAuthHeaders(config.apiKey),
      body: toFormData(STORAGE_DIAGNOSTIC_TEXT, "text/plain; charset=utf-8", "storage-probe.txt"),
    }, timeoutMs);

    if (!uploadResponse.ok) {
      const message = await safeResponseBody(uploadResponse);
      report.stages.push({
        name: "upload",
        ok: false,
        durationMs: Date.now() - uploadStart,
        status: uploadResponse.status,
        statusText: uploadResponse.statusText,
        errorMessage: message,
      });
      return report;
    }

    await uploadResponse.json().catch(() => undefined);
    report.stages.push({
      name: "upload",
      ok: true,
      durationMs: Date.now() - uploadStart,
      status: uploadResponse.status,
      statusText: uploadResponse.statusText,
    });
  } catch (err) {
    report.stages.push({
      name: "upload",
      ok: false,
      durationMs: Date.now() - uploadStart,
      ...describeStorageError(err),
    });
    return report;
  }

  const downloadStart = Date.now();
  try {
    const downloadApiUrl = new URL("v1/storage/downloadUrl", ensureTrailingSlash(config.baseUrl));
    downloadApiUrl.searchParams.set("path", normalizeKey(probeKey));
    const downloadResponse = await fetchWithTimeout(downloadApiUrl, {
      method: "GET",
      headers: buildAuthHeaders(config.apiKey),
    }, timeoutMs);

    if (!downloadResponse.ok) {
      const message = await safeResponseBody(downloadResponse);
      report.stages.push({
        name: "downloadUrl",
        ok: false,
        durationMs: Date.now() - downloadStart,
        status: downloadResponse.status,
        statusText: downloadResponse.statusText,
        errorMessage: message,
      });
      return report;
    }

    await downloadResponse.json().catch(() => undefined);
    report.stages.push({
      name: "downloadUrl",
      ok: true,
      durationMs: Date.now() - downloadStart,
      status: downloadResponse.status,
      statusText: downloadResponse.statusText,
    });
  } catch (err) {
    report.stages.push({
      name: "downloadUrl",
      ok: false,
      durationMs: Date.now() - downloadStart,
      ...describeStorageError(err),
    });
    return report;
  }

  report.ok = true;
  return report;
}

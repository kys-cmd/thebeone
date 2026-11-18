import crypto from "crypto";
import { SupabaseClient } from "@supabase/supabase-js";

export const OFFICIAL_TEST_INICIS_MID = "INIpayTest";
export const OFFICIAL_TEST_INICIS_SIGNKEY = "SU5JQ0lTX1NJR05LRVlfVEVTVF9LRVk=";
export const OFFICIAL_TEST_INICIS_APIKEY = "ItEQKi3rY7uvDS8l";
export const BROKEN_LEGACY_TEST_APIKEY = "ltS7C37SSTG90S7S";

export const INICIS_ENDPOINTS = {
  sandbox: {
    stdpay: "https://stgstdpay.inicis.com/api/payAuth",
    cancel: "https://stginiapi.inicis.com/api/v1/refund",
    stdjs: "https://stgstdpay.inicis.com/stdjs/INIStdPay.js",
  },
  production: {
    stdpay: "https://stdpay.inicis.com/api/payAuth",
    cancel: "https://iniapi.inicis.com/api/v1/refund",
    stdjs: "https://stdpay.inicis.com/stdjs/INIStdPay.js",
  },
} as const;

export const INICIS_SETTINGS_ACTIONS = new Set<string>([
  "admin-get-inicis-api-key-status",
  "admin-save-inicis-api-key",
]);

const VAULT_RECORD_TYPE = "inicis_api_key_vault";

function getVaultEncryptionSecret(): Buffer {
  const seed =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.INICIS_SIGNKEY ||
    "beone-academy-inicis-vault-fallback-secret";
  return crypto
    .createHash("sha256")
    .update(`${seed}|beone-inicis-api-key-vault-v1`, "utf8")
    .digest();
}

function encryptVaultSecret(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const key = getVaultEncryptionSecret();
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

function decryptVaultSecret(payload?: string | null): string {
  if (!payload || typeof payload !== "string") return "";
  const trimmed = payload.trim();
  if (!trimmed.startsWith("v1:")) return "";
  try {
    const parts = trimmed.split(":");
    if (parts.length !== 4) return "";
    const [, ivHex, tagHex, dataHex] = parts;
    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");
    const encrypted = Buffer.from(dataHex, "hex");
    const key = getVaultEncryptionSecret();
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString("utf8").trim();
  } catch {
    return "";
  }
}

export function maskInicisSecret(secret?: string | null): string {
  const clean = String(secret || "").trim();
  if (!clean) return "";
  if (clean.length <= 6) {
    return `${clean.slice(0, 2)}${"*".repeat(Math.max(2, clean.length - 2))}`;
  }
  return `${clean.slice(0, 4)}${"•".repeat(Math.min(10, clean.length - 8))}${clean.slice(-4)}`;
}

function sanitizeStoredApiKey(raw?: string | null): string {
  const clean = String(raw || "").trim();
  if (!clean || clean === BROKEN_LEGACY_TEST_APIKEY) return "";
  return clean;
}

export interface InicisRuntimeConfig {
  mid: string;
  signKey: string;
  apiKey: string;
  apiKeySource: "db" | "vault" | "env" | "test_default" | "none";
  isSandbox: boolean;
}

export async function getInicisRuntimeConfig(
  supabaseAdmin: SupabaseClient | null
): Promise<InicisRuntimeConfig> {
  let dbSettings: any = null;
  let vaultKey = "";

  if (supabaseAdmin) {
    try {
      const [settingsRes, vaultRes] = await Promise.all([
        supabaseAdmin.from("payment_settings").select("*").limit(1).maybeSingle(),
        supabaseAdmin
          .from("support_contents")
          .select("content")
          .eq("type", VAULT_RECORD_TYPE)
          .eq("is_deleted", false)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (!settingsRes.error && settingsRes.data) {
        dbSettings = settingsRes.data;
      }
      if (!vaultRes.error && vaultRes.data?.content) {
        vaultKey = sanitizeStoredApiKey(decryptVaultSecret(vaultRes.data.content));
      }
    } catch (e) {
      console.warn("[getInicisRuntimeConfig] DB load failed, falling back to env:", e);
    }
  }

  const mid = String(
    dbSettings?.pg_id ||
      process.env.INICIS_MID ||
      process.env.VITE_INICIS_MID ||
      OFFICIAL_TEST_INICIS_MID
  ).trim();

  const signKey = String(
    dbSettings?.inicis_sign_key ||
      process.env.INICIS_SIGNKEY ||
      OFFICIAL_TEST_INICIS_SIGNKEY
  ).trim();

  const isSandbox = dbSettings
    ? dbSettings.pg_mode
      ? dbSettings.pg_mode !== "live"
      : dbSettings.is_sandbox !== false
    : process.env.NODE_ENV !== "production";

  const dbColumnKey = sanitizeStoredApiKey(dbSettings?.inicis_api_key);
  const envKey = sanitizeStoredApiKey(process.env.INICIS_APIKEY);

  let apiKey = "";
  let apiKeySource: InicisRuntimeConfig["apiKeySource"] = "none";

  if (mid === OFFICIAL_TEST_INICIS_MID) {
    // Official KG Inicis test merchant INIpayTest always requires ItEQKi3rY7uvDS8l
    apiKey = OFFICIAL_TEST_INICIS_APIKEY;
    apiKeySource = "test_default";
  } else if (dbColumnKey) {
    apiKey = dbColumnKey;
    apiKeySource = "db";
  } else if (vaultKey) {
    apiKey = vaultKey;
    apiKeySource = "vault";
  } else if (envKey) {
    apiKey = envKey;
    apiKeySource = "env";
  }

  return {
    mid,
    signKey,
    apiKey,
    apiKeySource,
    isSandbox,
  };
}

export type BuildInicisRefundResult =
  | {
      ok: true;
      cancelUrl: string;
      effectiveMid: string;
      type: string;
      paymethod: string;
      timestamp: string;
      clientIp: string;
      tid: string;
      msg: string;
      hashData: string;
      isTestTransaction: boolean;
    }
  | {
      ok: false;
      httpStatus: number;
      errorCode: string;
      message: string;
    };

export function buildInicisRefundRequest(params: {
  config: InicisRuntimeConfig;
  tid: string;
  paymethod: string;
  loggedMid?: string;
  reason?: string;
  timestamp: string;
}): BuildInicisRefundResult {
  const cleanTid = String(params.tid || "").trim();
  const cleanPaymethod = String(params.paymethod || "Card").trim() || "Card";
  const cleanLoggedMid = String(params.loggedMid || "").trim();
  const cleanTimestamp = String(params.timestamp || "").trim();

  const isTestTid =
    cleanTid.includes(OFFICIAL_TEST_INICIS_MID) ||
    cleanLoggedMid === OFFICIAL_TEST_INICIS_MID;

  const effectiveMid = isTestTid
    ? OFFICIAL_TEST_INICIS_MID
    : cleanLoggedMid && cleanTid.includes(cleanLoggedMid)
      ? cleanLoggedMid
      : params.config.mid.trim();

  const isTestTransaction = isTestTid || effectiveMid === OFFICIAL_TEST_INICIS_MID;

  const cancelKey = isTestTransaction
    ? OFFICIAL_TEST_INICIS_APIKEY
    : sanitizeStoredApiKey(params.config.apiKey);

  if (!cancelKey) {
    return {
      ok: false,
      httpStatus: 400,
      errorCode: "MISSING_INICIS_API_KEY",
      message:
        "이니시스 실시간 환불 처리에 필요한 INIAPI Key(취소 API 키)가 등록되어 있지 않습니다. [관리자 > 시스템 설정 > 결제 설정]에서 이니시스 가맹점관리자의 INIAPI Key를 입력해 주세요.",
    };
  }

  const cancelUrl =
    isTestTransaction || params.config.isSandbox
      ? INICIS_ENDPOINTS.sandbox.cancel
      : INICIS_ENDPOINTS.production.cancel;

  const type = "Refund";
  const clientIp = "127.0.0.1";
  const msg = String(params.reason || "").trim() || "관리자 환불 처리";

  // KG Inicis INIAPI v1/refund hash spec:
  // SHA-512(INIAPIKey + type + paymethod + timestamp + clientIp + mid + tid)
  const plainText = `${cancelKey}${type}${cleanPaymethod}${cleanTimestamp}${clientIp}${effectiveMid}${cleanTid}`;
  const hashData = crypto.createHash("sha512").update(plainText, "utf8").digest("hex");

  return {
    ok: true,
    cancelUrl,
    effectiveMid,
    type,
    paymethod: cleanPaymethod,
    timestamp: cleanTimestamp,
    clientIp,
    tid: cleanTid,
    msg,
    hashData,
    isTestTransaction,
  };
}

export async function handleInicisSettingsAction(params: {
  action: string;
  body: Record<string, any>;
  supabaseAdmin: SupabaseClient;
  requestingUser: any;
  isAdminCheck: (uid: string) => Promise<boolean>;
}): Promise<{ httpStatus: number; payload: Record<string, any> }> {
  const { action, body, supabaseAdmin, requestingUser, isAdminCheck } = params;

  if (!requestingUser) {
    return {
      httpStatus: 401,
      payload: { status: "error", message: "로그인이 필요합니다." },
    };
  }

  const isAdmin = await isAdminCheck(requestingUser.id);
  if (!isAdmin) {
    return {
      httpStatus: 403,
      payload: { status: "error", message: "관리자 권한이 필요합니다." },
    };
  }

  if (action === "admin-get-inicis-api-key-status") {
    const cfg = await getInicisRuntimeConfig(supabaseAdmin);
    return {
      httpStatus: 200,
      payload: {
        status: "success",
        configured: Boolean(cfg.apiKey),
        source: cfg.apiKeySource,
        maskedKey: cfg.apiKey ? maskInicisSecret(cfg.apiKey) : "",
        effectiveMid: cfg.mid,
        isSandbox: cfg.isSandbox,
      },
    };
  }

  if (action === "admin-save-inicis-api-key") {
    const clear = Boolean(body?.clear);
    const trimmedKey = sanitizeStoredApiKey(body?.apiKey);

    if (!clear && !trimmedKey) {
      return {
        httpStatus: 400,
        payload: {
          status: "error",
          message: "유효한 이니시스 INIAPI Key 값을 입력해 주세요.",
        },
      };
    }

    const nowIso = new Date().toISOString();

    // Soft-delete existing vault rows
    await supabaseAdmin
      .from("support_contents")
      .update({ is_deleted: true, active: false, updated_at: nowIso })
      .eq("type", VAULT_RECORD_TYPE)
      .eq("is_deleted", false);

    if (!clear) {
      const ciphertext = encryptVaultSecret(trimmedKey);
      const { error: insertErr } = await supabaseAdmin.from("support_contents").insert([
        {
          type: VAULT_RECORD_TYPE,
          title: "INICIS_APIKEY_VAULT",
          content: ciphertext,
          active: false,
          is_deleted: false,
          created_at: nowIso,
          updated_at: nowIso,
        },
      ]);

      if (insertErr) {
        return {
          httpStatus: 500,
          payload: { status: "error", message: insertErr.message },
        };
      }
    }

    // Best-effort sync to payment_settings.inicis_api_key if column exists
    try {
      const { data: existingSettings } = await supabaseAdmin
        .from("payment_settings")
        .select("id")
        .limit(1)
        .maybeSingle();

      if (existingSettings?.id) {
        await supabaseAdmin
          .from("payment_settings")
          .update({
            inicis_api_key: clear ? null : trimmedKey,
            updated_at: nowIso,
          })
          .eq("id", existingSettings.id);
      }
    } catch {
      // Ignore if payment_settings.inicis_api_key column does not exist yet
    }

    const cfg = await getInicisRuntimeConfig(supabaseAdmin);
    return {
      httpStatus: 200,
      payload: {
        status: "success",
        message: clear
          ? "저장된 이니시스 INIAPI Key가 삭제되었습니다."
          : "이니시스 INIAPI Key가 안전하게 암호화되어 저장되었습니다.",
        configured: Boolean(cfg.apiKey),
        source: cfg.apiKeySource,
        maskedKey: cfg.apiKey ? maskInicisSecret(cfg.apiKey) : "",
      },
    };
  }

  return {
    httpStatus: 400,
    payload: { status: "error", message: `Unsupported action: ${action}` },
  };
}

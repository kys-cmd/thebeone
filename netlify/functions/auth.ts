import { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import crypto from "crypto";

// Initialize Supabase Admin using premium Service Role capabilities
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabaseAdmin = (supabaseUrl && supabaseServiceKey)
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null;

// Safe helper to send password reset OTP email containing 6-digit verification code via SMTP
async function sendOTPEmail(email: string, code: string): Promise<boolean> {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.warn(`[SMS/Email Sandbox] No SMTP configured. Generated OTP: ${code} for ${email}`);
    return false;
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass
      }
    });

    const mailOptions = {
      from: `"비원아카데미" <${user}>`,
      to: email,
      subject: "[비원아카데미] 귀하의 비밀번호 찾기 인증번호입니다.",
      html: `
        <div style="font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif; max-width: 500px; margin: 0 auto; padding: 40px; border: 1px solid #f3f4f6; border-radius: 24px; color: #1f2937; background-color: #ffffff; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);">
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="display: inline-block; background-color: #9333ea; color: white; font-weight: 900; font-size: 24px; width: 60px; height: 60px; line-height: 60px; border-radius: 18px; text-align: center; margin-bottom: 15px;">BE</div>
            <h2 style="font-size: 24px; font-weight: 800; color: #111827; margin: 0; letter-spacing: -1px;">비밀번호 재설정 인증번호</h2>
            <p style="color: #6b7280; font-size: 13px; margin-top: 5px;">본 인증번호는 5분 동안 유효합니다.</p>
          </div>
          
          <div style="background-color: #f5f3ff; border-radius: 16px; padding: 24.5px; text-align: center; margin-bottom: 25px; border: 1.5px dashed #c084fc;">
            <div style="font-size: 38px; font-weight: 900; color: #7e22ce; letter-spacing: 8px; margin-left: 8px;">${code}</div>
          </div>
          
          <div style="font-size: 13.5px; color: #4b5563; line-height: 1.6; margin-bottom: 25px; font-weight: 500;">
            안녕하세요. 비원아카데미 회원님,<br/>
            비밀번호 찾기를 요청하셔서 임시 인증번호가 발급되었습니다.<br/>
            화면의 입력창에 <b>위 인증번호 6자리</b>를 정확하게 기입해 주세요.
          </div>
          
          <div style="font-size: 11px; color: #9ca3af; border-top: 1px solid #f3f4f6; padding-top: 15px; text-align: center;">
            본 메일은 발신전용이며, 만약 요청하지 않으셨다면 이 메일을 무시하시기 바랍니다.
          </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`[SMTP Mailer] OTP Email successfully sent to ${email}`);
    return true;
  } catch (e) {
    console.error("[SMTP Mailer] Failed to send email via SMTP:", e);
    return false;
  }
}

export const handler: Handler = async (event) => {
  const allowedOrigin = process.env.APP_URL || process.env.VITE_APP_URL || "*";

  // CORS support
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": allowedOrigin,
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS"
      },
      body: ""
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ status: "error", message: "Method Not Allowed" })
    };
  }

  const responseHeaders = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": allowedOrigin
  };

  try {
    if (!supabaseAdmin) {
      return {
        statusCode: 500,
        headers: responseHeaders,
        body: JSON.stringify({ status: "error", message: "Supabase Administrator credentials not configured." })
      };
    }

    const { path: reqPath } = event;
    const body = JSON.parse(event.body || "{}");

    // Route: Send OTP (/api/auth/send-reset-otp)
    if (reqPath.endsWith("send-reset-otp")) {
      const { email } = body;
      if (!email) {
        return {
          statusCode: 400,
          headers: responseHeaders,
          body: JSON.stringify({ status: "error", message: "이메일 주소를 입력해 주세요." })
        };
      }

      // 1. Verify email exists in profiles
      const { data: profile, error: pErr } = await supabaseAdmin
        .from("profiles")
        .select("id, email, name")
        .eq("email", email)
        .eq("is_deleted", false)
        .maybeSingle();

      if (pErr) {
        console.error("[OTP Server] Error checking profile by email:", pErr);
        return {
          statusCode: 500,
          headers: responseHeaders,
          body: JSON.stringify({ status: "error", message: "계정을 식별하는 도중 예외가 발생했습니다." })
        };
      }

      if (!profile) {
        return {
          statusCode: 404,
          headers: responseHeaders,
          body: JSON.stringify({ status: "error", message: "가입되어 있지 않거나 비활성화된 이메일 주소입니다." })
        };
      }

      // Generate a 6-digit secure code
      const generatedCode = Math.floor(100000 + Math.random() * 900000).toString();
      const expiry = Date.now() + 5 * 60 * 1000; // valid for 5 min

      // Inactivate any existing OTP records for this email
      await supabaseAdmin
        .from("support_contents")
        .update({ active: false, is_deleted: true })
        .eq("type", "password_reset_otp")
        .eq("title", email);

      // Store in DB support_contents table (serverless safe)
      const { error: insertErr } = await supabaseAdmin
        .from("support_contents")
        .insert([{
          type: "password_reset_otp",
          title: email,
          content: JSON.stringify({ code: generatedCode, expiresAt: expiry, verified: false }),
          active: true,
          is_deleted: false
        }]);

      if (insertErr) {
        console.error("[OTP Server] DB Storage error:", insertErr);
        return {
          statusCode: 500,
          headers: responseHeaders,
          body: JSON.stringify({ status: "error", message: "인증번호 등록 데이타베이스 처리에 실패했습니다." })
        };
      }

      console.log(`[OTP Engine] Generated recovery OTP for (${email}): ${generatedCode}`);
      const isSent = await sendOTPEmail(email, generatedCode);

      return {
        statusCode: 200,
        headers: responseHeaders,
        body: JSON.stringify({
          status: "success",
          message: isSent 
            ? "귀하의 회원 이메일 주소로 인증코드 6자리가 발송되었습니다."
            : "안전하게 인증 코드가 생성되었습니다. (데모 모드)"
        })
      };
    }

    // Route: Verify OTP (/api/auth/verify-reset-otp)
    if (reqPath.endsWith("verify-reset-otp")) {
      const { email, code } = body;
      if (!email || !code) {
        return {
          statusCode: 400,
          headers: responseHeaders,
          body: JSON.stringify({ status: "error", message: "이메일 주소와 인증코드 6자리를 모두 작성해 주세요." })
        };
      }

      // Retrieve from support_contents
      const { data: record, error: getErr } = await supabaseAdmin
        .from("support_contents")
        .select("*")
        .eq("type", "password_reset_otp")
        .eq("title", email)
        .eq("active", true)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (getErr || !record) {
        return {
          statusCode: 400,
          headers: responseHeaders,
          body: JSON.stringify({ status: "error", message: "해당 이메일로 발송된 인증 요청을 찾을 수 없습니다." })
        };
      }

      const meta = JSON.parse(record.content);

      if (meta.expiresAt < Date.now()) {
        return {
          statusCode: 400,
          headers: responseHeaders,
          body: JSON.stringify({ status: "error", message: "유효 시간이 만료되었습니다. 인증번호를 다시 요청해 주세요." })
        };
      }

      if (meta.code !== code) {
        return {
          statusCode: 400,
          headers: responseHeaders,
          body: JSON.stringify({ status: "error", message: "인증코드 6자리가 일치하지 않습니다. 다시 입력해 주세요." })
        };
      }

      // Issue temporary recovery security token
      const tempToken = crypto.randomBytes(32).toString("hex");

      // Mark the DB OTP as verified
      const updatedMeta = { ...meta, verified: true, resetToken: tempToken };
      const { error: updateErr } = await supabaseAdmin
        .from("support_contents")
        .update({
          content: JSON.stringify(updatedMeta),
          updated_at: new Date().toISOString()
        })
        .eq("id", record.id);

      if (updateErr) {
        console.error("[OTP Server] Failed to update OTP verification status:", updateErr);
        return {
          statusCode: 500,
          headers: responseHeaders,
          body: JSON.stringify({ status: "error", message: "인증 상태 저장에 실패했습니다." })
        };
      }

      return {
        statusCode: 200,
        headers: responseHeaders,
        body: JSON.stringify({
          status: "success",
          message: "이메일 인증에 성공했습니다! 새 비밀번호를 바로 설정할 수 있습니다.",
          tempToken
        })
      };
    }

    // Route: Confirm Reset Password (/api/auth/confirm-reset-password)
    if (reqPath.endsWith("confirm-reset-password")) {
      const { email, tempToken, password } = body;
      if (!email || !tempToken || !password) {
        return {
          statusCode: 400,
          headers: responseHeaders,
          body: JSON.stringify({ status: "error", message: "필요한 정보가 누락되었습니다." })
        };
      }

      // Query verification record from Support Contents
      const { data: record, error: getErr } = await supabaseAdmin
        .from("support_contents")
        .select("*")
        .eq("type", "password_reset_otp")
        .eq("title", email)
        .eq("active", true)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (getErr || !record) {
        return {
          statusCode: 403,
          headers: responseHeaders,
          body: JSON.stringify({ status: "error", message: "이메일 인증이 승인되지 않았거나 만료되었습니다." })
        };
      }

      const meta = JSON.parse(record.content);
      if (!meta.verified) {
        return {
          statusCode: 403,
          headers: responseHeaders,
          body: JSON.stringify({ status: "error", message: "이메일 인증 승인이 감지되지 않았습니다." })
        };
      }

      if (!meta.resetToken || meta.resetToken !== tempToken) {
        return {
          statusCode: 403,
          headers: responseHeaders,
          body: JSON.stringify({ status: "error", message: "보안 토큰 인증에 실패했습니다. 다시 시도해 주세요." })
        };
      }

      if (password.length < 6) {
        return {
          statusCode: 400,
          headers: responseHeaders,
          body: JSON.stringify({ status: "error", message: "비밀번호는 최소 6자 이상으로 안전하게 입력해 주세요." })
        };
      }

      // Fetch user ID
      const { data: profile, error: pErr } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("email", email)
        .maybeSingle();

      if (pErr || !profile) {
        return {
          statusCode: 404,
          headers: responseHeaders,
          body: JSON.stringify({ status: "error", message: "유효한 사용자를 확인할 수 없습니다." })
        };
      }

      // Reset password
      const { error: resetErr } = await supabaseAdmin.auth.admin.updateUserById(
        profile.id,
        { password }
      );

      if (resetErr) {
        console.error("[OTP Server] Password reset error inside auth func:", resetErr);
        return {
          statusCode: 500,
          headers: responseHeaders,
          body: JSON.stringify({ status: "error", message: `비밀번호 변동 처리가 거부되었습니다: ${resetErr.message}` })
        };
      }

      // Inactivate the OTP record
      await supabaseAdmin
        .from("support_contents")
        .update({ active: false, is_deleted: true, updated_at: new Date().toISOString() })
        .eq("id", record.id);

      // Automatically satisfy and close any pending support tickets as well
      await supabaseAdmin
        .from("support_contents")
        .update({ is_deleted: true, active: false, updated_at: new Date().toISOString() })
        .eq("type", "password_reset_request")
        .eq("title", email);

      console.log(`[OTP Engine] Password successfully reset for user: ${email}`);

      return {
        statusCode: 200,
        headers: responseHeaders,
        body: JSON.stringify({
          status: "success",
          message: "비밀번호가 성공적으로 변경되었습니다! 새 비밀번호로 다시 로그인해 주세요."
        })
      };
    }

    return {
      statusCode: 400,
      headers: responseHeaders,
      body: JSON.stringify({ status: "error", message: "Invalid action routing" })
    };
  } catch (error: any) {
    console.error("[Auth Serverless Exception]:", error);
    return {
      statusCode: 500,
      headers: responseHeaders,
      body: JSON.stringify({ status: "error", message: error.message || "서버 내부 오류가 발생했습니다." })
    };
  }
};

import emailjs from "@emailjs/browser";

const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function storeOTP(email: string, otp: string): void {
  localStorage.setItem(
    `vt_otp_${email.toLowerCase()}`,
    JSON.stringify({ otp, expiresAt: Date.now() + OTP_EXPIRY_MS })
  );
}

export function verifyOTP(email: string, entered: string): { ok: boolean; error?: string } {
  try {
    const raw = localStorage.getItem(`vt_otp_${email.toLowerCase()}`);
    if (!raw) return { ok: false, error: "No verification code found. Please request a new one." };
    const { otp, expiresAt } = JSON.parse(raw);
    if (Date.now() > expiresAt) {
      localStorage.removeItem(`vt_otp_${email.toLowerCase()}`);
      return { ok: false, error: "Code expired. Please request a new one." };
    }
    if (otp !== entered.trim()) return { ok: false, error: "Incorrect code. Please try again." };
    // NOTE: do NOT remove the OTP here — only clear it via clearOTP() once the
    // follow-up action (create account / submit application / reset password)
    // has actually succeeded, so a failed DB write doesn't strand the user.
    return { ok: true };
  } catch {
    return { ok: false, error: "Verification failed. Please try again." };
  }
}

export function clearOTP(email: string): void {
  localStorage.removeItem(`vt_otp_${email.toLowerCase()}`);
}

export async function sendOTP(
  toEmail: string,
  toName: string,
  otp: string
): Promise<{ ok: boolean; error?: string; devMode?: boolean }> {
  const serviceId  = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID;
  const templateId = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID;
  const publicKey  = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY;

  // Dev mode: EmailJS not configured — display code on screen instead
  if (!serviceId || !templateId || !publicKey) {
    return { ok: true, devMode: true };
  }

  try {
    await emailjs.send(
      serviceId,
      templateId,
      { email: toEmail, to_name: toName, passcode: otp, time: "5 minutes" },
      { publicKey }
    );
    return { ok: true };
  } catch (err) {
    console.error("EmailJS error:", JSON.stringify(err), err);
    const msg = (err as { text?: string; status?: number })?.text ?? "Failed to send verification email. Please try again.";
    return { ok: false, error: msg };
  }
}

// RFC 5321/5322-aligned regex — rejects obviously malformed addresses
const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

// Known disposable / temporary email providers
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com", "guerrillamail.com", "guerrillamail.net", "guerrillamail.org",
  "guerrillamail.info", "guerrillamail.biz", "guerrillamailblock.com",
  "tempmail.com", "temp-mail.org", "temp-mail.io", "throwaway.email",
  "maildrop.cc", "10minutemail.com", "10minute.email", "10minutemail.net",
  "yopmail.com", "yopmail.fr", "spam4.me", "trashmail.com", "trashmail.net",
  "trashmail.org", "trashmail.at", "trashmail.io", "trashmail.me",
  "dispostable.com", "fakeinbox.com", "mailnull.com", "spamgourmet.com",
  "sharklasers.com", "grr.la", "spam.la", "getairmail.com", "filzmail.com",
  "discard.email", "spambox.us", "spambox.info", "dodgeit.com", "dodgit.com",
  "jetable.fr.nf", "nomail.xl.cx", "amilegit.com", "spamfree24.org",
  "spamfree24.de", "tempr.email", "dropmail.me", "mt2015.com",
  "throwam.com", "mailnesia.com", "getnada.com", "crazymailing.com",
  "obobbo.com", "sogetthis.com", "spamavert.com", "meltmail.com",
  "tempinbox.com", "tempinbox.co.uk", "trash-mail.com", "slopsbox.com",
  "anonymbox.com", "antichef.com", "antichef.net", "anonbox.net",
  "inoutmail.de", "inoutmail.eu", "inoutmail.info", "inoutmail.net",
  "listomail.com", "lookugly.com", "mailseal.de", "mailscrap.com",
  "mailtemp.info", "mierdamail.com", "mintemail.com", "my10minutemail.com",
  "neomailbox.com", "nowmymail.com", "objectmail.com", "oneoffemail.com",
  "ownmail.net", "pookmail.com", "receiveee.com", "spamherelots.com",
  "spamhereplease.com", "rklips.com", "yevme.com", "mailnew.com",
  "wegwerfmail.de", "wegwerfmail.net", "wegwerfmail.org",
  "spamevader.com", "binkmail.com", "safetymail.info", "speed.1s.fr",
  "superrito.com", "tafmail.com", "tagyourself.com", "thecity.biz",
  "thisisnotmyrealemail.com", "throwam.com", "tradermail.info",
  "trbvm.com", "turual.com", "twinmail.de", "tyldd.com",
  "uggsrock.com", "uroid.com", "vomoto.com", "vpn.st", "walala.org",
  "walkmail.ru", "webemail.me", "webm4il.info", "whatpaas.com",
  "whyspam.me", "wilemail.com", "willselfdestruct.com",
  "wuzupmail.net", "xagloo.com", "xemaps.com", "xents.com",
  "xmaily.com", "xoxy.net", "xyzfree.net", "yapped.net",
  "ycare.de", "yellowslinky.com", "ypmail.webarnak.fr.eu.org",
  "yuurok.com", "z1p.biz", "za.com", "zehnminuten.de",
  "zehnminutenmail.de", "zetmail.com", "zippymail.info",
  "zoaxe.com", "zoemail.net", "zoemail.org", "zomg.info",
]);

// Canonical spellings of the most popular email domains
const COMMON_DOMAINS = [
  "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.uk", "yahoo.co.in",
  "hotmail.com", "hotmail.co.uk", "outlook.com", "outlook.co.uk",
  "icloud.com", "me.com", "mac.com", "aol.com", "live.com", "msn.com",
  "protonmail.com", "proton.me", "ymail.com",
];

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

// Domains we know are real — skip the live DNS check for speed
const KNOWN_VALID_DOMAINS = new Set(COMMON_DOMAINS);

export interface EmailValidationResult {
  ok: boolean;
  error?: string;
  suggestion?: string;
}

/**
 * Checks via Cloudflare's public DNS-over-HTTPS API whether the email's
 * domain has MX records, meaning it is actually configured to receive mail.
 * Fails open (returns ok:true) on any network/timeout error so we never
 * block a user due to a connectivity issue on our end.
 */
export async function verifyEmailDomain(
  email: string
): Promise<{ ok: boolean; error?: string }> {
  const domain = email.trim().toLowerCase().split("@")[1];
  if (!domain) return { ok: false, error: "Invalid email domain." };

  // Skip the network round-trip for well-known providers
  if (KNOWN_VALID_DOMAINS.has(domain)) return { ok: true };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=MX`,
      {
        headers: { Accept: "application/dns-json" },
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);

    if (!res.ok) return { ok: true }; // fail open

    const data: {
      Status: number;
      Answer?: { type: number; data: string }[];
    } = await res.json();

    // Status 3 = NXDOMAIN — the domain flat-out doesn't exist
    if (data.Status === 3) {
      return {
        ok: false,
        error:
          "That email domain doesn't exist. Please double-check your address.",
      };
    }

    // type 15 = MX record
    const hasMX = Array.isArray(data.Answer) &&
      data.Answer.some((r) => r.type === 15);

    if (!hasMX) {
      return {
        ok: false,
        error:
          "That domain isn't set up to receive email. Please use a real email address.",
      };
    }

    return { ok: true };
  } catch {
    // Network error / timeout — fail open, don't punish the user
    return { ok: true };
  }
}

export function validateEmail(raw: string): EmailValidationResult {
  const email = raw.trim().toLowerCase();

  if (!email) return { ok: false, error: "Email is required." };

  // Must have exactly one @
  const parts = email.split("@");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return { ok: false, error: "Please enter a valid email address." };
  }

  if (!EMAIL_REGEX.test(email)) {
    return { ok: false, error: "Please enter a valid email address (e.g. name@example.com)." };
  }

  const [localPart, domain] = parts;

  // Reject domains with no dot (e.g. user@localhost)
  if (!domain.includes(".")) {
    return { ok: false, error: "Please enter a valid email address." };
  }

  // Reject disposable email services
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return {
      ok: false,
      error: "Temporary or disposable email addresses are not accepted. Please use a real email.",
    };
  }

  // Detect likely typos in common provider domains and suggest a correction
  let suggestion: string | undefined;
  for (const common of COMMON_DOMAINS) {
    if (domain !== common && levenshtein(domain, common) <= 2) {
      suggestion = `${localPart}@${common}`;
      break;
    }
  }

  return { ok: true, suggestion };
}

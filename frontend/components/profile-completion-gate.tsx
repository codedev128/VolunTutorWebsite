"use client";

import { useState, useEffect, useCallback } from "react";
import * as db from "@/lib/db";
import { COUNTRY_CODES, DEFAULT_COUNTRY_ISO } from "@/lib/country-codes";

/*
 * ── Profile completion gate ────────────────────────────────────────────────
 * Convention: whenever a NEW account field is introduced, add an entry here.
 * On every login the gate fetches the user's record, finds any required field
 * that is still empty, and forces the user to fill it before continuing.
 *
 * To add a new required field:
 *   1. Add the column to the `users` table + DbUser in lib/db.ts
 *   2. Add one entry to REQUIRED_PROFILE_FIELDS below
 * That's it — existing accounts missing the field get prompted automatically.
 */

type Role = "tutor" | "student";

interface RequiredField {
  key: string;                       // column name on the users row
  label: string;
  placeholder: string;
  roles: Role[];                     // which roles must have it
  kind: "text" | "phone";           // input style
  // returns an error string if invalid, or null if ok
  validate: (raw: string, countryIso?: string) => string | null;
  // transform the raw input into the value stored in the DB
  serialize: (raw: string, countryIso?: string) => string;
}

export const REQUIRED_PROFILE_FIELDS: RequiredField[] = [
  {
    key: "phone_number",
    label: "Phone number",
    placeholder: "Phone number",
    roles: ["tutor", "student"],
    kind: "phone",
    validate: (raw) => (/^\d{6,15}$/.test(raw.trim()) ? null : "Enter a valid phone number (digits only)."),
    serialize: (raw, iso) => {
      const dial = COUNTRY_CODES.find((c) => c.iso === iso)?.code ?? "+91";
      return `${dial} ${raw.trim()}`;
    },
  },
];

function isEmpty(v: unknown): boolean {
  return v === null || v === undefined || (typeof v === "string" && v.trim() === "");
}

export function ProfileCompletionGate({ userId, role }: { userId: string; role: Role }) {
  const [missing, setMissing] = useState<RequiredField[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [countryIso, setCountryIso] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [checked, setChecked] = useState(false);

  const runCheck = useCallback(async () => {
    try {
      const record = await db.getUserById(userId);
      if (!record) { setChecked(true); return; }
      const fields = record as unknown as Record<string, unknown>;
      const need = REQUIRED_PROFILE_FIELDS.filter(
        (f) => f.roles.includes(role) && isEmpty(fields[f.key])
      );
      setMissing(need);
    } catch { /* ignore — don't block on a failed check */ } finally {
      setChecked(true);
    }
  }, [userId, role]);

  useEffect(() => { runCheck(); }, [runCheck]);

  if (!checked || missing.length === 0) return null;

  async function handleSave() {
    const newErrors: Record<string, string> = {};
    const updates: Record<string, unknown> = {};
    for (const f of missing) {
      const raw = values[f.key] ?? "";
      const err = f.validate(raw, countryIso[f.key]);
      if (err) { newErrors[f.key] = err; continue; }
      updates[f.key] = f.serialize(raw, countryIso[f.key]);
    }
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;
    setSaving(true);
    try {
      await db.updateUserFields(userId, updates);
      setMissing([]); // satisfied — unmount the gate
    } catch {
      setErrors({ _form: "Couldn't save. Please try again." });
      setSaving(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-[1px]" />
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
          <div className="mb-4">
            <p className="text-lg font-bold text-gray-900">Complete your profile</p>
            <p className="mt-1 text-sm text-gray-500">
              We need a little more information before you continue.
            </p>
          </div>

          <div className="space-y-4">
            {missing.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700">
                  {f.label} <span className="text-red-500">*</span>
                </label>
                {f.kind === "phone" ? (
                  <div className="flex">
                    <select
                      aria-label="Country code"
                      value={countryIso[f.key] ?? DEFAULT_COUNTRY_ISO}
                      onChange={(e) => setCountryIso((p) => ({ ...p, [f.key]: e.target.value }))}
                      className="max-w-[110px] rounded-l-md border border-r-0 border-gray-200 bg-gray-50 px-2 text-sm font-medium text-gray-800 focus:outline-none focus:ring-1 focus:ring-amber-400"
                    >
                      {COUNTRY_CODES.map((c) => (
                        <option key={c.iso} value={c.iso}>{c.flag} {c.code} {c.name}</option>
                      ))}
                    </select>
                    <input
                      type="tel"
                      inputMode="numeric"
                      maxLength={15}
                      placeholder={f.placeholder}
                      value={values[f.key] ?? ""}
                      onChange={(e) => setValues((p) => ({ ...p, [f.key]: e.target.value.replace(/\D/g, "").slice(0, 15) }))}
                      className="flex-1 rounded-r-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                    />
                  </div>
                ) : (
                  <input
                    type="text"
                    placeholder={f.placeholder}
                    value={values[f.key] ?? ""}
                    onChange={(e) => setValues((p) => ({ ...p, [f.key]: e.target.value }))}
                    className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                  />
                )}
                {errors[f.key] && <p className="text-xs text-red-600">{errors[f.key]}</p>}
              </div>
            ))}
          </div>

          {errors._form && <p className="mt-3 text-sm text-red-600">{errors._form}</p>}

          <button
            onClick={handleSave}
            disabled={saving}
            className="mt-5 w-full rounded-lg bg-amber-400 py-2.5 text-sm font-bold text-white transition hover:bg-amber-300 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save & continue"}
          </button>
        </div>
      </div>
    </>
  );
}

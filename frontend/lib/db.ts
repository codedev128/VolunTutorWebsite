import { supabase } from "./supabase";

/* ── Users ───────────────────────────────────────────── */

export interface DbUser {
  id: string;
  name: string;
  email: string;
  password: string;
  role: "tutor" | "student";
  is_banned: boolean;
  phone_number?: string;
}

export async function getUserById(id: string): Promise<DbUser | null> {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

// Generic updater used by the profile-completion gate to fill missing fields.
export async function updateUserFields(userId: string, fields: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.from("users").update(fields).eq("id", userId);
  if (error) throw error;
}

export async function getUsers(): Promise<DbUser[]> {
  const { data, error } = await supabase.from("users").select("*");
  if (error) throw error;
  return data ?? [];
}

export async function getUserByEmail(email: string): Promise<DbUser | null> {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("email", email.toLowerCase())
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function createUser(user: Omit<DbUser, "is_banned">): Promise<DbUser> {
  const { data, error } = await supabase
    .from("users")
    .insert({ ...user, email: user.email.toLowerCase(), is_banned: false })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function setUserPassword(userId: string, password: string): Promise<void> {
  const { error } = await supabase
    .from("users")
    .update({ password })
    .eq("id", userId);
  if (error) throw error;
}

export async function setBanned(userId: string, banned: boolean): Promise<void> {
  const { error } = await supabase
    .from("users")
    .update({ is_banned: banned })
    .eq("id", userId);
  if (error) throw error;
}

export async function isBanned(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("users")
    .select("is_banned")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data?.is_banned ?? false;
}

export async function deleteUser(userId: string): Promise<void> {
  const { error } = await supabase.from("users").delete().eq("id", userId);
  if (error) throw error;
}

/* ── Tutor applications ──────────────────────────────── */

export interface DbApplication {
  id: string;
  name: string;
  email: string;
  password: string;
  phone_number?: string;
  cv_file_name?: string;
  cv_data_url?: string;
  status: "pending" | "approved" | "denied";
  submitted_at: string;
  reviewed_at?: string;
  reviewed_by?: string;
  review_note?: string;
}

export async function getApplications(): Promise<DbApplication[]> {
  const { data, error } = await supabase
    .from("tutor_applications")
    .select("*")
    .order("submitted_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getApplicationByEmail(email: string): Promise<DbApplication | null> {
  const { data, error } = await supabase
    .from("tutor_applications")
    .select("*")
    .eq("email", email.toLowerCase())
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function createApplication(app: Omit<DbApplication, "submitted_at" | "status">): Promise<void> {
  const payload = {
    ...app,
    email: app.email.toLowerCase(),
    status: "pending" as const,
    submitted_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("tutor_applications").insert(payload);
  if (error) {
    // Gracefully degrade if the phone_number column hasn't been added yet
    if (/phone_number/i.test(error.message)) {
      const { phone_number: _omit, ...withoutPhone } = payload;
      void _omit;
      const { error: retryErr } = await supabase.from("tutor_applications").insert(withoutPhone);
      if (retryErr) throw retryErr;
      return;
    }
    throw error;
  }
}

export async function deleteApplication(id: string): Promise<void> {
  const { error } = await supabase.from("tutor_applications").delete().eq("id", id);
  if (error) throw error;
}

export async function updateApplicationStatus(
  id: string,
  status: "approved" | "denied",
  reviewedBy?: string,
  reviewNote?: string
): Promise<void> {
  const update: Record<string, unknown> = {
    status,
    reviewed_at: new Date().toISOString(),
  };
  if (reviewedBy) update.reviewed_by = reviewedBy;
  if (reviewNote) update.review_note = reviewNote;
  const { error } = await supabase.from("tutor_applications").update(update).eq("id", id);
  if (error) throw error;
}

/* ── Tutor profiles ──────────────────────────────────── */

export interface DbTutorProfile {
  user_id: string;
  subjects: Array<{ name: string; proficiency: string; educationLevel: string }>;
  hours_worked?: number;
}

export async function getTutorProfile(userId: string): Promise<DbTutorProfile | null> {
  const { data, error } = await supabase
    .from("tutor_data")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data as DbTutorProfile | null;
}

export async function setTutorProfile(userId: string, profile: { subjects: DbTutorProfile["subjects"] }): Promise<void> {
  const { error } = await supabase
    .from("tutor_data")
    .upsert({ user_id: userId, subjects: profile.subjects }, { onConflict: "user_id" });
  if (error) throw error;
}

export async function setTutorHours(userId: string, hours: number): Promise<void> {
  const { error } = await supabase
    .from("tutor_data")
    .upsert({ user_id: userId, hours_worked: hours }, { onConflict: "user_id" });
  if (error) throw error;
}

/* ── Tutor matches ───────────────────────────────────── */

export interface DbTutorMatch {
  id: string;
  tutor_id: string;
  student_id?: string;
  subject?: string;
  grade_level?: string;
  booked_slots: string[];
  matched_at: string;
  status: string;
  // Extra fields used by tutor dashboard (stored as part of the record)
  student_name?: string;
  avatar?: string;
  help_message?: string;
  session_count?: number;
  next_session?: string | null;
  proficiency?: string;
  unread_messages?: number;
  meet_active?: boolean;
  meet_url?: string;
  messages?: DbMessage[];
}

export async function getTutorMatches(tutorId: string): Promise<DbTutorMatch[]> {
  const { data, error } = await supabase
    .from("tutor_matches")
    .select("*")
    .eq("tutor_id", tutorId);
  if (error) throw error;
  return data ?? [];
}

export async function getAllMatches(): Promise<DbTutorMatch[]> {
  const { data, error } = await supabase.from("tutor_matches").select("*");
  if (error) throw error;
  return data ?? [];
}

export async function createMatch(match: DbTutorMatch): Promise<void> {
  // Store everything useful; auto-drop any column the table doesn't have yet so
  // a schema gap on an optional field never blocks the core booking from saving.
  const payload: Record<string, unknown> = {
    id: match.id,
    tutor_id: match.tutor_id,
    student_id: match.student_id,
    subject: match.subject,
    grade_level: match.grade_level,
    booked_slots: match.booked_slots ?? [],
    matched_at: match.matched_at ?? new Date().toISOString(),
    status: match.status ?? "ACTIVE",
    student_name: match.student_name,
    avatar: match.avatar,
    help_message: match.help_message,
    session_count: match.session_count,
    next_session: match.next_session,
    proficiency: match.proficiency,
    unread_messages: match.unread_messages,
  };
  // Try the full insert; if Postgres reports a missing column, drop it and retry.
  for (let attempt = 0; attempt < 12; attempt++) {
    const { error } = await supabase.from("tutor_matches").insert(payload);
    if (!error) return;
    // Row already exists (duplicate primary key) → update it instead.
    if (error.code === "23505") {
      await supabase.from("tutor_matches").update(payload).eq("id", match.id);
      return;
    }
    const m = /column "?([a-z_]+)"? .* does not exist/i.exec(error.message)
      ?? /Could not find the '([a-z_]+)' column/i.exec(error.message);
    const col = m?.[1];
    if (col && col in payload && !["id", "tutor_id", "booked_slots"].includes(col)) {
      delete payload[col];
      continue; // retry without the missing optional column
    }
    throw error; // genuine error (or a core column is missing)
  }
}

export async function updateMatch(
  tutorId: string,
  matchId: string,
  updates: Partial<DbTutorMatch>
): Promise<void> {
  const { error } = await supabase
    .from("tutor_matches")
    .update(updates)
    .eq("id", matchId)
    .eq("tutor_id", tutorId);
  if (error) throw error;
}

export async function deleteMatch(tutorId: string, matchId: string): Promise<void> {
  const { error } = await supabase
    .from("tutor_matches")
    .delete()
    .eq("id", matchId)
    .eq("tutor_id", tutorId);
  if (error) throw error;
}

/* ── Tutor ratings ───────────────────────────────────── */

export interface DbTutorRating {
  id: string;
  tutor_id: string;
  rating: number;
  reviewer_name?: string;
  comment?: string;
  created_at?: string;
}

export async function getTutorRatings(tutorId: string): Promise<DbTutorRating[]> {
  const { data, error } = await supabase
    .from("tutor_ratings")
    .select("*")
    .eq("tutor_id", tutorId);
  if (error) throw error;
  return data ?? [];
}

export async function addRating(tutorId: string, rating: DbTutorRating): Promise<void> {
  const { error } = await supabase.from("tutor_ratings").upsert({
    id: rating.id,
    tutor_id: tutorId,
    rating: rating.rating,
    reviewer_name: rating.reviewer_name,
    comment: rating.comment,
    created_at: rating.created_at ?? new Date().toISOString(),
  });
  if (error) throw error;
}

/* ── Student requests ────────────────────────────────── */

export interface DbRequest {
  id: string;
  student_id?: string;
  student_name: string;
  subject: string;
  grade_level: string;
  help_message?: string;
  availability_slots: string[];
  status: "pending" | "accepted" | "cancelled";
  accepted_by_tutor_id?: string;
  target_tutor_id?: string;
  recurrence_weeks?: number;
  submitted_at: string;
  // Extra UI fields (stored in record)
  avatar?: string;
}

export async function getRequests(): Promise<DbRequest[]> {
  const { data, error } = await supabase
    .from("student_requests")
    .select("*")
    .order("submitted_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getRequestsByStudentId(studentId: string): Promise<DbRequest[]> {
  const { data, error } = await supabase
    .from("student_requests")
    .select("*")
    .eq("student_id", studentId)
    .order("submitted_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createRequest(req: Omit<DbRequest, "submitted_at" | "status">): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { avatar: _avatar, ...rest } = req;
  const { error } = await supabase.from("student_requests").insert({
    ...rest,
    status: "pending",
    submitted_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function updateRequestStatus(
  id: string,
  status: "pending" | "accepted" | "cancelled",
  tutorId?: string
): Promise<void> {
  const update: Record<string, unknown> = { status };
  if (tutorId !== undefined) update.accepted_by_tutor_id = tutorId;
  const { error } = await supabase.from("student_requests").update(update).eq("id", id);
  if (error) throw error;
}

export async function deleteRequest(id: string): Promise<void> {
  const { error } = await supabase.from("student_requests").delete().eq("id", id);
  if (error) throw error;
}

/* ── Reviews ─────────────────────────────────────────── */

export interface DbReview {
  id: string;
  tutor_id?: string;
  tutor_name?: string;
  reviewer_name?: string;
  student_name?: string;
  rating: number;
  text?: string;
  comment?: string;
  created_at?: string;
}

export async function getReviews(): Promise<DbReview[]> {
  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createReview(review: DbReview): Promise<void> {
  const { error } = await supabase.from("reviews").upsert({
    ...review,
    created_at: review.created_at ?? new Date().toISOString(),
  });
  if (error) throw error;
}

export async function deleteReview(id: string): Promise<void> {
  const { error } = await supabase.from("reviews").delete().eq("id", id);
  if (error) throw error;
}

/* ── Moderators ──────────────────────────────────────── */

export interface DbModerator {
  id: string;
  name: string;
  email: string;
  password: string;
  created_at?: string;
}

export async function getModerators(): Promise<DbModerator[]> {
  const { data, error } = await supabase.from("moderators").select("*");
  if (error) throw error;
  return data ?? [];
}

export async function getModeratorById(id: string): Promise<DbModerator | null> {
  const { data, error } = await supabase
    .from("moderators")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function getModeratorByCredentials(email: string, password: string): Promise<DbModerator | null> {
  const { data, error } = await supabase
    .from("moderators")
    .select("*")
    .eq("email", email.toLowerCase())
    .eq("password", password)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function createModerator(mod: DbModerator): Promise<void> {
  const { error } = await supabase.from("moderators").insert({
    ...mod,
    email: mod.email.toLowerCase(),
    created_at: mod.created_at ?? new Date().toISOString(),
  });
  if (error) throw error;
}

export async function deleteModerator(id: string): Promise<void> {
  const { error } = await supabase.from("moderators").delete().eq("id", id);
  if (error) throw error;
}

/* ── Messages (stored as JSONB in tutor_matches) ─────── */

export interface DbMessage {
  id: string;
  match_id: string;
  from_role: "tutor" | "student";
  body: string;
  sent_at: string;
}

export async function getMessages(matchId: string): Promise<DbMessage[]> {
  const { data, error } = await supabase
    .from("tutor_matches")
    .select("messages")
    .eq("id", matchId)
    .maybeSingle();
  if (error) throw error;
  const msgs = (data?.messages ?? []) as DbMessage[];
  return msgs.sort((a, b) => a.sent_at.localeCompare(b.sent_at));
}

export async function createMessage(message: Omit<DbMessage, "id">): Promise<void> {
  const { data, error: readErr } = await supabase
    .from("tutor_matches")
    .select("messages")
    .eq("id", message.match_id)
    .maybeSingle();
  if (readErr) throw readErr;
  const existing: DbMessage[] = (data?.messages ?? []) as DbMessage[];
  const newMsg: DbMessage = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    match_id: message.match_id,
    from_role: message.from_role,
    body: message.body,
    sent_at: message.sent_at ?? new Date().toISOString(),
  };
  const { error: writeErr } = await supabase
    .from("tutor_matches")
    .update({ messages: [...existing, newMsg] })
    .eq("id", message.match_id);
  if (writeErr) throw writeErr;
}

/* ── Tutor reports ───────────────────────────────────── */

export interface DbTutorReport {
  id: string;
  student_id?: string;
  student_name: string;
  tutor_id: string;
  tutor_name: string;
  match_id?: string;
  reason: string;
  details?: string;
  status: "pending" | "reviewed" | "dismissed";
  created_at: string;
  reviewed_by?: string;
  reviewed_at?: string;
}

export async function getReports(): Promise<DbTutorReport[]> {
  const { data, error } = await supabase
    .from("tutor_reports")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DbTutorReport[];
}

export async function createReport(report: Omit<DbTutorReport, "status" | "created_at">): Promise<void> {
  const { error } = await supabase.from("tutor_reports").insert({
    ...report,
    status: "pending",
    created_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function updateReportStatus(
  id: string,
  status: "reviewed" | "dismissed",
  reviewedBy: string
): Promise<void> {
  const { error } = await supabase
    .from("tutor_reports")
    .update({ status, reviewed_by: reviewedBy, reviewed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteReport(id: string): Promise<void> {
  const { error } = await supabase.from("tutor_reports").delete().eq("id", id);
  if (error) throw error;
}

/* ── Mod classrooms ──────────────────────────────────── */

export interface DbClassroomMember {
  id: string;
  mod_id: string;
  student_id: string;
  joined_at: string;
}

export async function getModClassroom(modId: string): Promise<DbClassroomMember[]> {
  const { data, error } = await supabase
    .from("mod_classrooms")
    .select("*")
    .eq("mod_id", modId);
  if (error) throw error;
  return (data ?? []) as DbClassroomMember[];
}

export async function addModClassroomStudent(modId: string, studentId: string): Promise<void> {
  const { error } = await supabase.from("mod_classrooms").insert({
    id: `${modId}-${studentId}-${Date.now()}`,
    mod_id: modId,
    student_id: studentId,
    joined_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function removeModClassroomStudent(modId: string, studentId: string): Promise<void> {
  const { error } = await supabase
    .from("mod_classrooms")
    .delete()
    .eq("mod_id", modId)
    .eq("student_id", studentId);
  if (error) throw error;
}

export async function getAllClassroomMembers(): Promise<DbClassroomMember[]> {
  const { data, error } = await supabase.from("mod_classrooms").select("*");
  if (error) throw error;
  return (data ?? []) as DbClassroomMember[];
}

export async function getStudentClassroom(studentId: string): Promise<{ mod_id: string } | null> {
  const { data, error } = await supabase
    .from("mod_classrooms")
    .select("mod_id")
    .eq("student_id", studentId)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function getTutorMatchesByStudentIds(studentIds: string[]): Promise<DbTutorMatch[]> {
  if (studentIds.length === 0) return [];
  const { data, error } = await supabase
    .from("tutor_matches")
    .select("*")
    .in("student_id", studentIds);
  if (error) throw error;
  return (data ?? []) as DbTutorMatch[];
}

/* ── Classroom hours (mod-specific per tutor) ────────── */

export interface DbClassroomHours {
  id: string;
  mod_id: string;
  tutor_id: string;
  hours: number;
}

export async function getClassroomHours(modId: string): Promise<DbClassroomHours[]> {
  const { data, error } = await supabase
    .from("classroom_hours")
    .select("*")
    .eq("mod_id", modId);
  if (error) throw error;
  return (data ?? []) as DbClassroomHours[];
}

export async function setClassroomHours(modId: string, tutorId: string, hours: number): Promise<void> {
  const existing = await supabase
    .from("classroom_hours")
    .select("id")
    .eq("mod_id", modId)
    .eq("tutor_id", tutorId)
    .maybeSingle();
  if (existing.data) {
    const { error } = await supabase
      .from("classroom_hours")
      .update({ hours })
      .eq("mod_id", modId)
      .eq("tutor_id", tutorId);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("classroom_hours")
      .insert({ id: `${modId}-${tutorId}`, mod_id: modId, tutor_id: tutorId, hours });
    if (error) throw error;
  }
}

/* ── Mod ↔ Tutor messages ────────────────────────────── */

export interface DbModTutorMessage {
  id: string;
  mod_id: string;
  tutor_id: string;
  from_role: "mod" | "tutor";
  body: string;
  sent_at: string;
}

export async function getModTutorMessages(modId: string, tutorId: string): Promise<DbModTutorMessage[]> {
  const { data, error } = await supabase
    .from("mod_tutor_messages")
    .select("*")
    .eq("mod_id", modId)
    .eq("tutor_id", tutorId)
    .order("sent_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as DbModTutorMessage[];
}

export async function sendModTutorMessage(
  modId: string,
  tutorId: string,
  fromRole: "mod" | "tutor",
  body: string
): Promise<void> {
  const { error } = await supabase.from("mod_tutor_messages").insert({
    id: `mtm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    mod_id: modId,
    tutor_id: tutorId,
    from_role: fromRole,
    body,
    sent_at: new Date().toISOString(),
  });
  if (error) throw error;
}

/* ── Reset (admin) ───────────────────────────────────── */

export async function resetAllData(): Promise<void> {
  const tables = [
    "tutor_matches",
    "student_requests",
    "tutor_ratings",
    "tutor_data",
    "reviews",
    "tutor_reports",
    "mod_classrooms",
    "classroom_hours",
    "tutor_applications",
    "users",
  ];
  for (const table of tables) {
    const { error } = await supabase.from(table).delete().not("id", "is", null);
    if (error) throw error;
  }
}

export async function setMeetActive(
  tutorId: string,
  matchId: string,
  active: boolean,
  meetUrl?: string
): Promise<void> {
  const update: Record<string, unknown> = { meet_active: active };
  if (meetUrl !== undefined) update.meet_url = meetUrl;
  const { error } = await supabase
    .from("tutor_matches")
    .update(update)
    .eq("id", matchId)
    .eq("tutor_id", tutorId);
  if (error) throw error;
}

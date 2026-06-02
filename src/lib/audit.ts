import { supabase } from "@/integrations/supabase/client";

export async function logAdminAction(
  action: string,
  entity_type: string,
  entity_id?: string | null,
  details: Record<string, any> = {},
): Promise<void> {
  try {
    const { data } = await supabase.auth.getUser();
    const uid = data.user?.id;
    if (!uid) return;
    await supabase.from("admin_audit_log").insert({
      actor_id: uid,
      action,
      entity_type,
      entity_id: entity_id ?? null,
      details,
    });
  } catch {
    // silent — audit logging must never break the user action
  }
}

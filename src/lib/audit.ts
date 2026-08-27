import { db } from "./db";

// Ren sporbarhed, ingen håndhævelse — kaldes ved siden af de tunge/følsomme
// admin-handlinger (oprette kunde, give/fjerne adgang, åbne som kunde,
// invitere/fjerne konsulent), se app/admin/actions.ts og
// app/admin/consultants/actions.ts.
export async function logAdminAction(
  consultantId: string,
  action: string,
  opts?: { targetType?: string; targetId?: string; detail?: string },
) {
  await db.adminAuditLog.create({
    data: {
      consultantId,
      action,
      targetType: opts?.targetType,
      targetId: opts?.targetId,
      detail: opts?.detail,
    },
  });
}

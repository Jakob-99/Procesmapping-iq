// Labels for ConsultantAccount.role — Cornerstones-siden af huset, ikke
// kundens egne User-roller (se lib/roles.ts). Kun ADMIN kan ændre andres
// rolle, se updateConsultantRole i app/admin/consultants/actions.ts.
export const CONSULTANT_ROLES = {
  ADMIN: "Admin",
  CO_LEADER: "Co-leder",
  CONSULTANT: "Konsulent",
} as const;

export type ConsultantRole = keyof typeof CONSULTANT_ROLES;

// Labels for User.role — organisationens egne login-brugere, ikke Respondenter.
export const ROLES = {
  FDE: "Senior konsulent (FDE)",
  PROCESS_OWNER: "Procesejer",
  EMPLOYEE: "Medarbejder",
  CUSTOMER_LEAD: "Kundeansvarlig",
  PARTNER: "Udviklingspartner",
} as const;

export type Role = keyof typeof ROLES;

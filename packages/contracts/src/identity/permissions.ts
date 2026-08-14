import type { LaboratoryRole, SystemRole } from './roles.js';

export const identityPermissions = [
  'identity.user.read',
  'identity.user.manage',
  'identity.laboratory.read',
  'identity.laboratory.manage',
  'identity.project.read',
  'identity.project.manage',
  'identity.membership.manage',
  'inventory.read',
  'inventory.withdraw',
  'inventory.manage',
  'equipment.read',
  'equipment.report-incident',
  'equipment.manage',
  'scheduling.reserve',
  'scheduling.cancel',
  'scheduling.approve',
  'scheduling.block.manage',
  'controlled.authorize',
  'management.report.read',
  'audit.read',
] as const;

export type IdentityPermission = (typeof identityPermissions)[number];

export const LABORATORY_ROLE_PERMISSIONS = {
  USUARIO: [
    'identity.laboratory.read',
    'identity.project.read',
    'inventory.read',
    'inventory.withdraw',
    'equipment.read',
    'equipment.report-incident',
    'scheduling.reserve',
    'scheduling.cancel',
  ],
  TECNICO: [
    'identity.user.read',
    'identity.laboratory.read',
    'identity.project.read',
    'identity.project.manage',
    'inventory.read',
    'inventory.withdraw',
    'inventory.manage',
    'equipment.read',
    'equipment.report-incident',
    'equipment.manage',
    'scheduling.reserve',
    'scheduling.cancel',
    'scheduling.approve',
    'scheduling.block.manage',
    'management.report.read',
    'audit.read',
  ],
  RESPONSAVEL_CONTROLADOS: [
    'identity.laboratory.read',
    'identity.project.read',
    'inventory.read',
    'controlled.authorize',
  ],

} as const satisfies Readonly<Record<LaboratoryRole, readonly IdentityPermission[]>>;

export const SYSTEM_ROLE_PERMISSIONS = {
  ADMIN: identityPermissions,
} as const satisfies Readonly<Record<SystemRole, readonly IdentityPermission[]>>;

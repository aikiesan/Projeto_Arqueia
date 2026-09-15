import { Module } from '@nestjs/common';

import { HealthModule } from './health/health.module.js';
import { CatalogModule } from './modules/catalog/catalog.module.js';
import { EquipmentModule } from './modules/equipment/equipment.module.js';
import { IdentityModule } from './modules/identity/identity.module.js';
import { InventoryModule } from './modules/inventory/inventory.module.js';
import { ManagementModule } from './modules/management/management.module.js';
import { PublicScheduleModule } from './modules/public-schedule/public-schedule.module.js';
import { SchedulingModule } from './modules/scheduling/scheduling.module.js';

@Module({
  imports: [
    HealthModule,
    IdentityModule,
    CatalogModule,
    EquipmentModule,
    SchedulingModule,
    PublicScheduleModule,
    InventoryModule,
    ManagementModule,
  ],
})
export class AppModule {}

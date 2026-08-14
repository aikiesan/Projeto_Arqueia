import { Module } from '@nestjs/common';

import { HealthController } from './health/health.controller.js';
import { CatalogModule } from './modules/catalog/catalog.module.js';
import { EquipmentModule } from './modules/equipment/equipment.module.js';
import { IdentityModule } from './modules/identity/identity.module.js';
import { InventoryModule } from './modules/inventory/inventory.module.js';
import { ManagementModule } from './modules/management/management.module.js';
import { SchedulingModule } from './modules/scheduling/scheduling.module.js';

@Module({
  imports: [
    IdentityModule,
    CatalogModule,
    EquipmentModule,
    SchedulingModule,
    InventoryModule,
    ManagementModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}

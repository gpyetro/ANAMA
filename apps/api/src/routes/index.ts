import { deliveryRoutes } from "../modules/deliveries/delivery.routes.js";
import { donationRoutes } from "../modules/donations/donation.routes.js";
import { notificationRoutes } from "../modules/notifications/notification.routes.js";
import { organizationManagementRoutes } from "../modules/organizations/organization-management.routes.js";
import { authenticate } from "../middlewares/authenticate.js";
import { updateFilter } from "../modules/updates/updates.js";
import { Router } from "express";
import { organizationAdminRoutes } from "../modules/organizations/organization.routes.js";
import { authRoutes } from "../modules/auth/auth.routes.js";
import { basketRoutes } from "../modules/baskets/basket.routes.js";
import { familyRoutes } from "../modules/families/family.routes.js";

export const routes = Router();

routes.get("/health", (_request, response) => {
  response.status(200).json({
    status: "ok",
    application: "ANAMÃ API",
  });
});

routes.use("/api/v1/auth", authRoutes);

routes.use("/api/v1/families", familyRoutes);

routes.use("/api/v1/admin/organizations", organizationAdminRoutes);

routes.use("/api/v1/baskets", basketRoutes);

routes.use("/api/v1/donations", donationRoutes);
routes.use("/api/v1/notifications", notificationRoutes);
routes.use("/api/v1/organizations/me", organizationManagementRoutes);
routes.get("/api/v1/updates/stream", authenticate, updateFilter);

routes.use("/api/v1/organizations/me/deliveries", deliveryRoutes);

import { Route, Routes } from "react-router-dom";

import { AppLayout } from "./layouts/AppLayout";
import { ProtectedRoute } from "./components/ProtectedRoute";

import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { RegisterPage } from "./pages/RegisterPage";
import { BasketDetailsPage } from "./pages/BasketDetailsPage";
import { RequestAidPage } from "./pages/RequestAidPage";
import { AdminOrganizationsPage } from "./pages/AdminOrganizationsPage";
import { DonatePage } from "./pages/DonatePage";
import { OrganizationDashboardPage } from "./pages/OrganizationDashboardPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { ProfilePage } from "./pages/ProfilePage";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<HomePage />} />

          <Route path="baskets/:id" element={<BasketDetailsPage />} />

          <Route path="request-aid" element={<RequestAidPage />} />

          <Route
            path="admin/organizations"
            element={<AdminOrganizationsPage />}
          />

          <Route path="profile" element={<ProfilePage />} />
          <Route path="donate/:id" element={<DonatePage />} />
          <Route path="organization" element={<OrganizationDashboardPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

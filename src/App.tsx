import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/shared/ProtectedRoute";
import { RoleGuard } from "@/components/shared/RoleGuard";
import AppLayout from "@/layouts/AppLayout";
import AuthLayout from "@/layouts/AuthLayout";
import Forbidden from "@/pages/Forbidden";
import NotFound from "@/pages/NotFound";

// Auth pages
const LoginPage = lazy(() => import("@/pages/auth/LoginPage"));
const ChangePasswordPage = lazy(
  () => import("@/pages/auth/ChangePasswordPage"),
);

// App pages
const DashboardPage = lazy(() => import("@/pages/DashboardPage"));
const CategoriesPage = lazy(() => import("@/pages/catalog/CategoriesPage"));
const ProductsPage = lazy(() => import("@/pages/catalog/ProductsPage"));
const ProductDetailPage = lazy(
  () => import("@/pages/catalog/ProductDetailPage"),
);
const ProductFormPage = lazy(() => import("@/pages/catalog/ProductFormPage"));
const RecategorizePage = lazy(() => import("@/pages/catalog/RecategorizePage"));
const CatalogsPage = lazy(() => import("@/pages/catalog/CatalogsPage"));
const SuppliersPage = lazy(() => import("@/pages/catalog/SuppliersPage"));
const RemapPage = lazy(() => import("@/pages/catalog/RemapPage"));
const IngresosPage = lazy(() => import("@/pages/inventory/IngresosPage"));
const IngresoNewPage = lazy(() => import("@/pages/inventory/IngresoNewPage"));
const IngresoDetailPage = lazy(
  () => import("@/pages/inventory/IngresoDetailPage"),
);
const EgresosPage = lazy(() => import("@/pages/inventory/EgresosPage"));
const EgresoNewPage = lazy(() => import("@/pages/inventory/EgresoNewPage"));
const EgresoDetailPage = lazy(
  () => import("@/pages/inventory/EgresoDetailPage"),
);
const KardexPage = lazy(() => import("@/pages/KardexPage"));
const ReportsPage = lazy(() => import("@/pages/reports/ReportsPage"));
const AuditPage = lazy(() => import("@/pages/AuditPage"));
const AdminUsersPage = lazy(() => import("@/pages/admin/AdminUsersPage"));
const AdminParamsPage = lazy(() => import("@/pages/admin/AdminParamsPage"));
const AdminCompanyPage = lazy(() => import("@/pages/admin/AdminCompanyPage"));

function PageLoader() {
  return (
    <div className="flex h-64 items-center justify-center text-muted-foreground">
      Cargando...
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Auth routes */}
            <Route element={<AuthLayout />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/change-password" element={<ChangePasswordPage />} />
            </Route>

            {/* Protected app routes */}
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/" element={<DashboardPage />} />

                {/* Categories - all roles can view; write is gated in-page (admin + supervisor) */}
                <Route path="/categories" element={<CategoriesPage />} />
                <Route path="/products" element={<ProductsPage />} />
                <Route path="/suppliers" element={<SuppliersPage />} />
                <Route path="/products/new" element={<ProductFormPage />} />
                <Route path="/products/:id" element={<ProductDetailPage />} />
                <Route
                  path="/products/:id/edit"
                  element={<ProductFormPage />}
                />
                {/* Recategorization + attribute remap - admin + operator (product write) */}
                <Route element={<RoleGuard roles={["admin", "operator"]} />}>
                  <Route path="/recategorize" element={<RecategorizePage />} />
                  <Route path="/remap" element={<RemapPage />} />
                </Route>
                {/* Master catalogs - admin + supervisor */}
                <Route element={<RoleGuard roles={["admin", "supervisor"]} />}>
                  <Route path="/catalogs" element={<CatalogsPage />} />
                </Route>

                {/* Inventory movements - admin + operator */}
                <Route element={<RoleGuard roles={["admin", "operator"]} />}>
                  <Route
                    path="/inventory/ingresos"
                    element={<IngresosPage />}
                  />
                  <Route
                    path="/inventory/ingresos/new"
                    element={<IngresoNewPage />}
                  />
                  <Route
                    path="/inventory/ingresos/:id"
                    element={<IngresoDetailPage />}
                  />
                  <Route path="/inventory/egresos" element={<EgresosPage />} />
                  <Route
                    path="/inventory/egresos/new"
                    element={<EgresoNewPage />}
                  />
                  <Route
                    path="/inventory/egresos/:id"
                    element={<EgresoDetailPage />}
                  />
                  <Route
                    path="/inventory/bajas"
                    element={<Navigate to="/inventory/egresos" replace />}
                  />
                  <Route
                    path="/inventory/bajas/new"
                    element={<Navigate to="/inventory/egresos/new" replace />}
                  />
                  <Route
                    path="/inventory/bajas/:id"
                    element={<Navigate to="/inventory/egresos" replace />}
                  />
                  <Route
                    path="/inventory/ajustes"
                    element={<Navigate to="/inventory/ingresos" replace />}
                  />
                  <Route
                    path="/inventory/ajustes/new"
                    element={<Navigate to="/inventory/ingresos/new" replace />}
                  />
                  <Route
                    path="/inventory/ajustes/:id"
                    element={<Navigate to="/inventory/ingresos" replace />}
                  />
                </Route>

                <Route path="/kardex" element={<KardexPage />} />
                <Route path="/kardex/:productId" element={<KardexPage />} />

                {/* Reports + Audit - admin + supervisor */}
                <Route element={<RoleGuard roles={["admin", "supervisor"]} />}>
                  <Route path="/reports/*" element={<ReportsPage />} />
                  <Route path="/audit" element={<AuditPage />} />
                </Route>

                {/* Admin - admin only */}
                <Route element={<RoleGuard roles={["admin"]} />}>
                  <Route path="/admin/users" element={<AdminUsersPage />} />
                  <Route path="/admin/params" element={<AdminParamsPage />} />
                  <Route path="/admin/company" element={<AdminCompanyPage />} />
                </Route>
              </Route>
            </Route>

            <Route path="/403" element={<Forbidden />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}

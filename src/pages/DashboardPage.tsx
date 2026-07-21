import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  TrendingDown,
  TrendingUp,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useStockReport } from "@/features/reports/hooks";
import { useIngresos, useEgresos } from "@/features/inventory/hooks";
import { useAuth } from "@/contexts/AuthContext";
import { useCompanyConfig } from "@/features/admin/hooks";

export default function DashboardPage() {
  const { user } = useAuth();
  const { data: company } = useCompanyConfig();
  const companyReady = !!company?.is_complete;
  const canViewStockReports =
    user?.role === "admin" || user?.role === "supervisor";
  const { data: lowStock, isLoading: stockLoading } = useStockReport(
    { bajo_stock: true },
    { enabled: companyReady && canViewStockReports },
  );
  const { data: recentIn } = useIngresos(
    { cursor: undefined },
    { enabled: companyReady },
  );
  const { data: recentOut } = useEgresos(
    { cursor: undefined },
    { enabled: companyReady },
  );

  const ajustesPositivos = (recentIn ?? []).filter(
    (d) => d.ingreso_type === "adjustment_positive",
  ).length;
  const bajasYAjustesNegativos = (recentOut ?? []).filter(
    (d) => d.egreso_type === "baja" || d.egreso_type === "adjustment_negative",
  ).length;

  const recentMovements = [
    ...(recentIn ?? []).slice(0, 3).map((d) => ({
      ...d,
      label:
        d.ingreso_type === "adjustment_positive"
          ? "Ingreso (Ajuste +)"
          : "Ingreso",
      kind: "in" as const,
    })),
    ...(recentOut ?? []).slice(0, 3).map((d) => ({
      ...d,
      label:
        d.egreso_type === "baja"
          ? "Egreso (Baja)"
          : d.egreso_type === "adjustment_negative"
            ? "Egreso (Ajuste -)"
            : "Egreso",
      kind: "out" as const,
    })),
  ]
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
    .slice(0, 5);

  const summaryCards = [
    {
      title: "Productos bajo mínimo",
      value: canViewStockReports ? (lowStock ?? []).length : "N/D",
      hint: canViewStockReports
        ? (lowStock ?? []).length > 0
          ? "Requiere atención inmediata"
          : "Sin alertas críticas"
        : "Disponible solo para administradores y supervisores",
      icon: AlertTriangle,
      accent: "from-rose-500 to-red-600",
      iconBg: "bg-rose-100 text-rose-600",
      valueClass:
        canViewStockReports && (lowStock ?? []).length > 0
          ? "text-destructive"
          : "text-[hsl(var(--foreground))]",
    },
    {
      title: "Ingresos recientes",
      value: (recentIn ?? []).length,
      hint: `Incluye ${ajustesPositivos} ajustes positivos`,
      icon: TrendingUp,
      accent: "from-sky-500 to-cyan-500",
      iconBg: "bg-cyan-100 text-cyan-700",
      valueClass: "text-[hsl(var(--foreground))]",
    },
    {
      title: "Egresos recientes",
      value: (recentOut ?? []).length,
      hint: `Incluye ${bajasYAjustesNegativos} bajas/ajustes negativos`,
      icon: TrendingDown,
      accent: "from-blue-600 to-sky-600",
      iconBg: "bg-sky-100 text-sky-700",
      valueClass: "text-[hsl(var(--foreground))]",
    },
    {
      title: "Movimientos recientes",
      value: recentMovements.length,
      hint: "Últimas transacciones del sistema",
      icon: Activity,
      accent: "from-cyan-500 to-teal-500",
      iconBg: "bg-teal-100 text-teal-700",
      valueClass: "text-[hsl(var(--foreground))]",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-cyan-200/80 bg-linear-to-r from-sky-900 via-sky-800 to-cyan-700 px-6 py-5 text-white shadow-token-md">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">
              Bienvenido, {user?.full_name}
            </h1>
            <p className="text-sm text-cyan-100/90">
              Panel ejecutivo de inventario y movimientos operativos
            </p>
          </div>
          <div className="rounded-xl border border-cyan-300/35 bg-cyan-100/10 px-3 py-2 text-xs font-medium text-cyan-50">
            Estado del sistema:{" "}
            {companyReady ? "Configurado" : "Pendiente de configuración"}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <Card key={card.title} className="overflow-hidden border-cyan-100/90">
            <div className={`h-1.5 bg-linear-to-r ${card.accent}`} />
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {card.title}
                  </p>
                  {stockLoading && card.title === "Productos bajo mínimo" ? (
                    <Skeleton className="mt-2 h-9 w-20" />
                  ) : (
                    <p className={`mt-1 text-3xl font-bold ${card.valueClass}`}>
                      {card.value}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {card.hint}
                  </p>
                </div>
                <div className={`rounded-full p-2.5 ${card.iconBg}`}>
                  <card.icon className="h-4 w-4" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {(lowStock ?? []).length > 0 && (
          <Card className="border-cyan-100">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold text-slate-800">
                Productos bajo stock
              </CardTitle>
              {canViewStockReports && (
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/products?bajo_stock=true">
                    Ver todos <ArrowRight className="ml-1 h-3.5 w-3.5" />
                  </Link>
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Mínimo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(lowStock ?? []).slice(0, 5).map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <Link
                          to={`/products/${p.id}`}
                          className="font-medium hover:underline text-sm"
                        >
                          {p.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right text-destructive font-medium">
                        {p.stock_actual}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {p.stock_minimo}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        <Card className="border-cyan-100">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold text-slate-800">
              Movimientos recientes
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/reports">
                <BarChart3 className="mr-1 h-3.5 w-3.5" />
                Ver reportes
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentMovements.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Sin movimientos recientes
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Fecha</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentMovements.map((d) => (
                    <TableRow key={`${d.label}-${d.id}`}>
                      <TableCell className="font-mono text-xs">
                        {d.number}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={d.kind === "in" ? "default" : "secondary"}
                        >
                          {d.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(d.created_at).toLocaleDateString("es-EC")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import {
  Users,
  FileText,
  DollarSign,
  TrendingUp,
  Activity,
  Crown,
  Zap,
  BarChart3,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Area,
  AreaChart,
} from "recharts"

// ── Mock Data ──────────────────────────────────────────────────

function generateLast30Days() {
  const data = []
  const now = new Date()
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    const day = date.toLocaleDateString("es-CL", { day: "2-digit", month: "short" })
    const docs = Math.floor(Math.random() * 180) + 40
    const costMistral = +(Math.random() * 8 + 2).toFixed(2)
    const costGemini = +(Math.random() * 12 + 4).toFixed(2)
    data.push({
      date: day,
      documentos: docs,
      costMistral,
      costGemini,
      costoTotal: +(costMistral + costGemini).toFixed(2),
    })
  }
  return data
}

const chartData = generateLast30Days()

const mockStats = {
  totalUsers: 1_247,
  docsToday: 342,
  docsWeek: 2_180,
  docsMonth: 8_745,
  apiCostToday: 18.42,
  apiCostWeek: 127.85,
  apiCostMonth: 489.32,
  userGrowth: 12.5,
  docGrowth: 8.3,
}

const mockRecentUsers = [
  { id: 1, name: "María González", email: "maria@empresa.cl", plan: "PRO", joinedAt: "2026-03-25", docs: 0 },
  { id: 2, name: "Carlos Pérez", email: "carlos@startup.io", plan: "STARTER", joinedAt: "2026-03-24", docs: 3 },
  { id: 3, name: "Ana Silva", email: "ana@corp.com", plan: "FREE", joinedAt: "2026-03-24", docs: 1 },
  { id: 4, name: "Roberto Muñoz", email: "roberto@legal.cl", plan: "PRO", joinedAt: "2026-03-23", docs: 12 },
  { id: 5, name: "Valentina Rojas", email: "val@design.co", plan: "STARTER", joinedAt: "2026-03-23", docs: 5 },
  { id: 6, name: "Diego Fuentes", email: "diego@tech.cl", plan: "FREE", joinedAt: "2026-03-22", docs: 2 },
]

const mockTopUsers = [
  { id: 1, name: "Empresa Legal SpA", email: "admin@legal.cl", plan: "ENTERPRISE", docs: 4_521, cost: 245.80 },
  { id: 2, name: "Contaduría Express", email: "info@contaex.cl", plan: "PRO", docs: 2_890, cost: 156.30 },
  { id: 3, name: "FacturaFácil", email: "ops@factura.io", plan: "PRO", docs: 1_745, cost: 94.20 },
  { id: 4, name: "Roberto Muñoz", email: "roberto@legal.cl", plan: "STARTER", docs: 892, cost: 48.10 },
  { id: 5, name: "Clínica Norte", email: "docs@clinica.cl", plan: "STARTER", docs: 654, cost: 35.30 },
]

const mrrData = {
  free: { count: 847, price: 0, mrr: 0 },
  starter: { count: 245, price: 29, mrr: 245 * 29 },
  pro: { count: 132, price: 49, mrr: 132 * 49 },
  enterprise: { count: 23, price: 199, mrr: 23 * 199 },
}

const totalMRR = mrrData.free.mrr + mrrData.starter.mrr + mrrData.pro.mrr + mrrData.enterprise.mrr

// ── Chart Configs ──────────────────────────────────────────────

const docsChartConfig: ChartConfig = {
  documentos: {
    label: "Documentos",
    color: "hsl(var(--chart-1))",
  },
}

const costChartConfig: ChartConfig = {
  costMistral: {
    label: "Mistral",
    color: "hsl(var(--chart-2))",
  },
  costGemini: {
    label: "Gemini",
    color: "hsl(var(--chart-3))",
  },
}

// ── Plan Badge ─────────────────────────────────────────────────

function PlanBadge({ plan }: { plan: string }) {
  const variants: Record<string, string> = {
    FREE: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
    STARTER: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    PRO: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    ENTERPRISE: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  }
  return (
    <Badge variant="outline" className={variants[plan] || ""}>
      {plan}
    </Badge>
  )
}

// ── Stat Card ──────────────────────────────────────────────────

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
}: {
  title: string
  value: string
  description: string
  icon: React.ElementType
  trend?: { value: number; positive: boolean }
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <div className="flex items-center gap-1 mt-1">
          {trend && (
            <span className={`flex items-center text-xs ${trend.positive ? "text-green-500" : "text-red-500"}`}>
              {trend.positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {trend.value}%
            </span>
          )}
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Page ────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Simulate session check – replace with real auth later
    const token = typeof window !== "undefined" ? localStorage.getItem("token") || document.cookie : null
    // For demo, always allow; in production, verify admin role
    const timer = setTimeout(() => setIsLoading(false), 400)
    return () => clearTimeout(timer)
  }, [router])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <Activity className="h-8 w-8 animate-pulse text-primary" />
          <p className="text-muted-foreground text-sm">Cargando panel de administración...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4 md:p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Panel de Administración</h1>
            <p className="text-muted-foreground">Métricas y estadísticas de la plataforma ONAI OCR</p>
          </div>
          <Badge variant="outline" className="w-fit bg-green-500/10 text-green-500 border-green-500/30">
            <Activity className="h-3 w-3 mr-1" />
            Sistema operativo
          </Badge>
        </div>

        {/* Stat Cards */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Usuarios Totales"
            value={mockStats.totalUsers.toLocaleString("es-CL")}
            description="vs. mes anterior"
            icon={Users}
            trend={{ value: mockStats.userGrowth, positive: true }}
          />
          <StatCard
            title="Docs Procesados Hoy"
            value={mockStats.docsToday.toLocaleString("es-CL")}
            description={`${mockStats.docsWeek.toLocaleString("es-CL")} esta semana`}
            icon={FileText}
            trend={{ value: mockStats.docGrowth, positive: true }}
          />
          <StatCard
            title="Costo API Hoy"
            value={`$${mockStats.apiCostToday.toFixed(2)}`}
            description={`$${mockStats.apiCostMonth.toFixed(2)} este mes`}
            icon={DollarSign}
          />
          <StatCard
            title="MRR Estimado"
            value={`$${totalMRR.toLocaleString("en-US")}`}
            description={`${mrrData.free.count + mrrData.starter.count + mrrData.pro.count + mrrData.enterprise.count} suscriptores`}
            icon={TrendingUp}
            trend={{ value: 15.2, positive: true }}
          />
        </div>

        {/* Charts */}
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
          {/* Docs Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Documentos Procesados
              </CardTitle>
              <CardDescription>Últimos 30 días</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={docsChartConfig} className="h-[300px] w-full">
                <BarChart data={chartData} accessibilityLayer>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    interval={4}
                    fontSize={11}
                  />
                  <YAxis tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="documentos" fill="var(--color-documentos)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Cost Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Costos API por Día
              </CardTitle>
              <CardDescription>Mistral + Gemini — últimos 30 días</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={costChartConfig} className="h-[300px] w-full">
                <AreaChart data={chartData} accessibilityLayer>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    interval={4}
                    fontSize={11}
                  />
                  <YAxis tickLine={false} axisLine={false} tickMargin={8} fontSize={11} tickFormatter={(v) => `$${v}`} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area
                    type="monotone"
                    dataKey="costMistral"
                    stackId="1"
                    fill="var(--color-costMistral)"
                    stroke="var(--color-costMistral)"
                    fillOpacity={0.4}
                  />
                  <Area
                    type="monotone"
                    dataKey="costGemini"
                    stackId="1"
                    fill="var(--color-costGemini)"
                    stroke="var(--color-costGemini)"
                    fillOpacity={0.4}
                  />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>

        {/* Revenue Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5" />
              Revenue por Plan (MRR)
            </CardTitle>
            <CardDescription>Ingreso mensual recurrente estimado</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { name: "Free", data: mrrData.free, color: "bg-zinc-500" },
                { name: "Starter", data: mrrData.starter, color: "bg-blue-500" },
                { name: "Pro", data: mrrData.pro, color: "bg-purple-500" },
                { name: "Enterprise", data: mrrData.enterprise, color: "bg-amber-500" },
              ].map((plan) => (
                <div key={plan.name} className="flex flex-col gap-2 p-4 rounded-lg border bg-card">
                  <div className="flex items-center gap-2">
                    <div className={`h-3 w-3 rounded-full ${plan.color}`} />
                    <span className="font-medium">{plan.name}</span>
                  </div>
                  <div className="text-2xl font-bold">${plan.data.mrr.toLocaleString("en-US")}</div>
                  <div className="text-xs text-muted-foreground">
                    {plan.data.count} usuarios × ${plan.data.price}/mes
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Tables */}
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
          {/* Recent Users */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Últimos Usuarios Registrados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right">Docs</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockRecentUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium text-sm">{user.name}</div>
                          <div className="text-xs text-muted-foreground">{user.email}</div>
                        </div>
                      </TableCell>
                      <TableCell><PlanBadge plan={user.plan} /></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{user.joinedAt}</TableCell>
                      <TableCell className="text-right font-mono">{user.docs}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Top Users */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Top Usuarios por Uso
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead className="text-right">Docs</TableHead>
                    <TableHead className="text-right">Costo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockTopUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium text-sm">{user.name}</div>
                          <div className="text-xs text-muted-foreground">{user.email}</div>
                        </div>
                      </TableCell>
                      <TableCell><PlanBadge plan={user.plan} /></TableCell>
                      <TableCell className="text-right font-mono">{user.docs.toLocaleString("es-CL")}</TableCell>
                      <TableCell className="text-right font-mono">${user.cost.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Docs volume stats */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Resumen de Volumen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
              {[
                { label: "Hoy", value: mockStats.docsToday, cost: mockStats.apiCostToday },
                { label: "Esta Semana", value: mockStats.docsWeek, cost: mockStats.apiCostWeek },
                { label: "Este Mes", value: mockStats.docsMonth, cost: mockStats.apiCostMonth },
              ].map((period) => (
                <div key={period.label} className="flex flex-col gap-1 p-4 rounded-lg border bg-card">
                  <span className="text-sm text-muted-foreground">{period.label}</span>
                  <span className="text-xl font-bold">{period.value.toLocaleString("es-CL")} docs</span>
                  <span className="text-sm text-muted-foreground">
                    Costo estimado: <span className="font-mono text-foreground">${period.cost.toFixed(2)}</span>
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

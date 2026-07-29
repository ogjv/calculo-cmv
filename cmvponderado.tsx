import { DollarSign, Package, Percent, ShoppingCart } from "lucide-react";
import KPICard from "@/components/KPICard";
import RevenueByGroupChart from "@/components/RevenueByGroupChart";
import CMVByGroupChart from "@/components/CMVByGroupChart";
import TopProductsTable from "@/components/TopProductsTable";
import SubgroupChart from "@/components/SubgroupChart";
import { totalGeral, formatCurrency, formatPercent, groupSummaries } from "@/data/cmvData";

const Index = () => {
  const lucro = totalGeral.total - totalGeral.custoTeorico;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-serif font-bold text-foreground">
              Dashboard CMV Ponderado
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Vidah — Janeiro 2025
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10">
            <div className="h-2 w-2 rounded-full bg-accent animate-pulse" />
            <span className="text-xs font-medium text-accent">Dados atualizados</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            title="Faturamento Total"
            value={formatCurrency(totalGeral.total)}
            subtitle={`${totalGeral.quantity.toLocaleString('pt-BR')} itens vendidos`}
            icon={DollarSign}
          />
          <KPICard
            title="Custo Total (CMV)"
            value={formatCurrency(totalGeral.custoTeorico)}
            subtitle={`CMV médio: ${formatPercent(totalGeral.cmvPercent)}`}
            icon={ShoppingCart}
          />
          <KPICard
            title="Lucro Bruto"
            value={formatCurrency(lucro)}
            subtitle={`Margem: ${formatPercent((lucro / totalGeral.total) * 100)}`}
            icon={Percent}
          />
          <KPICard
            title="Itens no Cardápio"
            value={groupSummaries.length.toString() + " grupos"}
            subtitle={`${totalGeral.quantity.toLocaleString('pt-BR')} unidades vendidas`}
            icon={Package}
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RevenueByGroupChart />
          <CMVByGroupChart />
        </div>

        {/* Subgroup Chart */}
        <SubgroupChart />

        {/* Products Table */}
        <TopProductsTable />
      </main>
    </div>
  );
};

export default Index;

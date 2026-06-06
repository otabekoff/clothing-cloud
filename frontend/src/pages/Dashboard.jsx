import { api } from "../api/client.js";
import { DonutChart, RevenueTrend, StockByWarehouse } from "../components/charts.jsx";
import { Icon } from "../components/icons.jsx";
import { ErrorBanner, Loading } from "../components/states.jsx";
import { useAsync } from "../hooks/useAsync.js";

const money = (n) => `$${Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

function Kpi({ icon, color, label, value, sub }) {
  const Ico = Icon[icon];
  return (
    <div className="kpi">
      <div className="top">
        <div className="k">{label}</div>
        <div className="ico" style={{ background: `${color}1a`, color }}>
          <Ico width={20} height={20} />
        </div>
      </div>
      <div className="v">{value}</div>
      <div className="s">{sub}</div>
    </div>
  );
}

export default function Dashboard() {
  const { data, loading, error, reload } = useAsync(() => api.dashboard(), []);

  if (loading) return <Loading label="Loading dashboard…" />;
  if (error) return <ErrorBanner message={error} onRetry={reload} />;

  const k = data.kpis;

  return (
    <>
      <div className="kpi-grid">
        <Kpi icon="money" color="#4f46e5" label="Total revenue" value={money(k.revenue)} sub={`${k.orders} orders`} />
        <Kpi icon="box" color="#16a34a" label="Products (ERP)" value={k.products} sub="active product lines" />
        <Kpi icon="warehouse" color="#d97706" label="Units in stock (WMS)" value={k.total_stock.toLocaleString()} sub={`${k.low_stock_items} low-stock items`} />
        <Kpi icon="users" color="#0ea5b7" label="Customers (CRM)" value={k.customers} sub="wholesale accounts" />
      </div>

      <div className="chart-grid">
        <div className="chart-card">
          <h3>Revenue trend</h3>
          <div className="desc">Daily order revenue over the recent period</div>
          <div className="chart-h">
            <RevenueTrend data={data.orders_trend} />
          </div>
        </div>
        <div className="chart-card">
          <h3>Revenue by status</h3>
          <div className="desc">Where current order value sits in the pipeline</div>
          <div className="chart-h">
            <DonutChart data={data.revenue_by_status} />
          </div>
        </div>
      </div>

      <div className="chart-grid">
        <div className="chart-card">
          <h3>Stock by warehouse</h3>
          <div className="desc">Total units held at each distribution centre</div>
          <div className="chart-h">
            <StockByWarehouse data={data.stock_by_warehouse} />
          </div>
        </div>
        <div className="chart-card">
          <h3>Products by category</h3>
          <div className="desc">Catalogue composition across categories</div>
          <div className="chart-h">
            <DonutChart data={data.products_by_category} />
          </div>
        </div>
      </div>
    </>
  );
}

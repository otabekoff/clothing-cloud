import { Navigate, Route, Routes } from "react-router";
import Layout from "./components/Layout.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import Customers from "./pages/Customers.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Forbidden from "./pages/Forbidden.jsx";
import Login from "./pages/Login.jsx";
import Orders from "./pages/Orders.jsx";
import Products from "./pages/Products.jsx";
import Stock from "./pages/Stock.jsx";
import Users from "./pages/Users.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/403" element={<Forbidden />} />

      {/* Authenticated app shell */}
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="products" element={<Products />} />
        <Route path="stock" element={<Stock />} />
        <Route path="customers" element={<Customers />} />
        <Route path="orders" element={<Orders />} />
        <Route
          path="users"
          element={
            <ProtectedRoute minRole="admin">
              <Users />
            </ProtectedRoute>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

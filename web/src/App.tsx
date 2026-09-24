import { Routes, Route } from "react-router-dom";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/layout/AppShell";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import IngredientsListPage from "@/pages/ingredients/IngredientsListPage";
import IngredientDetailPage from "@/pages/ingredients/IngredientDetailPage";
import RecipesListPage from "@/pages/recipes/RecipesListPage";
import RecipeDetailPage from "@/pages/recipes/RecipeDetailPage";
import CostCalculatorPage from "@/pages/calculator/CostCalculatorPage";
import ProduceBatchPage from "@/pages/batches/ProduceBatchPage";
import RegisterSalePage from "@/pages/sales/RegisterSalePage";
import InventoryPage from "@/pages/inventory/InventoryPage";
import ReportsPage from "@/pages/reports/ReportsPage";
import CategoriesPage from "@/pages/categories/CategoriesPage";
import SuppliersPage from "@/pages/suppliers/SuppliersPage";
import AboutPage from "@/pages/about/AboutPage";
import NotFoundPage from "@/pages/NotFoundPage";

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/ingredientes" element={<IngredientsListPage />} />
        <Route path="/ingredientes/:id" element={<IngredientDetailPage />} />
        <Route path="/recetas" element={<RecipesListPage />} />
        <Route path="/recetas/:id" element={<RecipeDetailPage />} />
        <Route path="/calculadora-costos" element={<CostCalculatorPage />} />
        <Route path="/lotes/producir" element={<ProduceBatchPage />} />
        <Route path="/ventas/registrar" element={<RegisterSalePage />} />
        <Route path="/inventario" element={<InventoryPage />} />
        <Route path="/reportes" element={<ReportsPage />} />
        <Route path="/categorias" element={<CategoriesPage />} />
        <Route path="/proveedores" element={<SuppliersPage />} />
        <Route path="/acerca-de" element={<AboutPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default App;

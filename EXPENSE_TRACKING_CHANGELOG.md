# Expense Tracking System - Changelog

## Version 2.0 - Comprehensive Revenue & Expense Management

**Date:** January 25, 2026
**Branch:** focused-ramanujan
**Merged with:** main (includes Cruises feature)

---

## 🎯 New Features Implemented

### 1. **Expense Tracking System**
Complete expense management for taxi drivers with the following capabilities:

#### Database Schema
- **New `expenses` table** with:
  - Categories: Fuel, Maintenance, Operating, Other
  - Subcategories for detailed tracking
  - Odometer readings for all expenses
  - Liters tracking for fuel purchases
  - Notes field for additional context
  - Receipt photo URL support (structure ready)
  - Recurring expense support (future enhancement)

#### Enhanced Earnings Table
- Added `ride_category` (airport, train_station, event, street, app, other)
- Added `shift_type` (morning, afternoon, night) - auto-detected
- Added `start_km` and `end_km` for odometer tracking
- Added `notes` field

#### SQL Views
- `daily_profit_summary` - Revenue breakdown by day
- `daily_expenses_summary` - Expense breakdown by day
- `daily_profit` - Combined profit calculation (revenue - expenses)

---

### 2. **UI Components**

#### AddExpenseSheet (`src/components/widgets/AddExpenseSheet.tsx`)
- **Red "-" floating button** (bottom-right, above earnings button)
- Quick fuel presets: 20€, 30€, 40€, 50€, 60€
- 4 expense categories with custom icons:
  - 🟠 Combustible (Fuel) - Orange
  - 🔵 Mantenimiento (Maintenance) - Blue
  - 🟣 Operativo (Operating) - Purple
  - ⚫ Otros (Other) - Gray
- Dynamic subcategory dropdown per category
- Odometer and liters tracking
- Notes field

**Subcategories:**
- **Fuel:** Gasolina, Diésel, GNC, Eléctrico
- **Maintenance:** Cambio de aceite, Neumáticos, Frenos, Batería, Filtros, Reparación, Revisión, ITV, Lavado
- **Operating:** Seguro, Licencia, Parking, Peajes, Multas, Tasas municipales, Alquiler plaza
- **Other:** Otros

#### ExpensesView (`src/components/views/ExpensesView.tsx`)
- **New "Gastos" tab** in bottom navigation (replaced "Licencias")
- Summary cards showing total expenses by category
- Click-to-filter by category
- Daily grouped expense list with totals
- Delete functionality with confirmation dialog
- Detailed expense cards showing:
  - Category icon and name
  - Amount in red
  - Subcategory/notes
  - Odometer reading and liters (if applicable)
  - Time of expense

#### ProfitWidget (`src/components/widgets/ProfitWidget.tsx`)
- **Replaces** simple earnings widget in dashboard
- Shows **today's net profit** (Revenue - Expenses)
- Color-coded:
  - 🟢 Green for profit
  - 🔴 Red for loss
- Breakdown cards:
  - Revenue (green) with ride count
  - Expenses (red) with expense count
- Weekly profit summary
- Quick links to both Earnings and Expenses views

#### Enhanced QuickEarningsSheet
- **Collapsible "Advanced Options"** section
- Odometer tracking:
  - Start km field
  - End km field
  - Auto-calculates distance traveled
- Auto-detects ride category from current zone:
  - Airport zones → 'airport'
  - Train station zones → 'train_station'
  - Other → 'street'
- Auto-assigns shift type based on time:
  - 6:00-14:00 → 'morning'
  - 14:00-22:00 → 'afternoon'
  - 22:00-6:00 → 'night'

---

### 3. **Navigation Changes**

#### Bottom Navigation
- **Replaced:** "Licencias" tab
- **With:** "Gastos" (Expenses) tab
- **Icon:** TrendingDown (red down arrow)

#### Updated Routes
All routes properly configured in `src/pages/Index.tsx`:
- `/dashboard` - Main dashboard with ProfitWidget
- `/gastos` - Full expense tracking view
- `/earnings` - Enhanced earnings with odometer
- `/cruceros` - Cruises view (from main merge)

---

### 4. **Custom Hooks**

#### useExpenses.ts
```typescript
- fetchExpenses(startDate?, endDate?)
- addExpense(category, amount, subcategory?, odometer?, liters?, notes?)
- deleteExpense(id)
- getTotalExpenses(category?)
- getMonthlyExpenses(year, month)
- dailySummary - grouped expenses by date
```

#### Enhanced useEarnings.ts
```typescript
- addCarrera() - now accepts:
  - startKm, endKm (odometer tracking)
  - category (auto-detected from zone)
  - notes
- stats.daily[] - array of daily earnings
- stats.weekly - weekly revenue and count
```

---

## 📊 Database Migration

**File:** `supabase/migrations/20260125_add_expenses_tracking.sql`

**To apply:**
1. Go to: https://supabase.com/dashboard/project/uqjwfnevtefdfpbckuwf/sql/new
2. Copy the SQL from the migration file
3. Paste and RUN in Supabase SQL Editor

**Tables Created:**
- `expenses` - with RLS policies
- Enhanced `registros_carreras` with new columns

**Indexes Created:**
- `idx_expenses_device_date` - Fast queries by device and date
- `idx_expenses_category` - Fast filtering by category

**Views Created:**
- `daily_profit_summary`
- `daily_expenses_summary`
- `daily_profit` (combined)

---

## 🚀 Development Setup

### Local Testing
```bash
npm install          # Install dependencies
npm run dev         # Start dev server
# Open: http://localhost:8087/
```

### Android Build
```bash
npm run build             # Build production version
npm run cap:sync          # Sync with Capacitor
npm run cap:open:android  # Open Android Studio
```

### Testing on Phone
- **Network URL:** http://192.168.178.27:8087/
- Make sure phone is on same WiFi

---

## 🎨 User Experience

### Adding an Expense
1. Tap red **-** button (bottom-right)
2. Select category (Fuel, Maintenance, etc.)
3. Choose subcategory from dropdown
4. Enter amount (or use quick presets for fuel)
5. Optionally add odometer reading
6. Add notes if needed
7. Save!

### Adding Earnings with Odometer
1. Tap yellow **+** button
2. Select amount
3. Add tip if applicable
4. Choose payment method
5. Expand "Advanced Options"
6. Enter start and end kilometers
7. Save with automatic zone/category detection!

### Viewing Profit
- Dashboard shows **today's net profit** prominently
- Green if profitable, red if loss
- Tap "Ver Ingresos" or "Ver Gastos" for details
- Or use "Gastos" tab in bottom navigation

---

## 🔄 Merged Features from Main

The following features from main branch were successfully integrated:

### Cruises View
- Full cruise ship tracking from Port of Barcelona
- New `CruisesView` component
- `useCruises` hook for cruise data
- Integrated into dashboard with cruise widget
- Updated scraping system for cruise data

### Other Updates
- Dense grid layout for FullDayView (4 terminals)
- User presence timeline in Admin
- Updated scripts for data scraping
- Latest flight and train data

---

## 📱 Testing Checklist

- [ ] Run migration in Supabase
- [ ] Test adding fuel expense with liters and km
- [ ] Test adding maintenance expense
- [ ] Test adding earnings with km tracking
- [ ] Verify profit widget shows correct calculations
- [ ] Test expense filtering by category
- [ ] Test expense deletion
- [ ] Test on Android device
- [ ] Verify geolocation still works
- [ ] Check cruises view integration

---

## 🔮 Future Enhancements

### Phase 2: Analytics & Insights
- [ ] Cost-per-kilometer calculator
- [ ] Fuel efficiency tracking (L/100km)
- [ ] Best hours analysis with profit margins
- [ ] Zone profitability comparison
- [ ] Weekly/monthly profit charts
- [ ] Export to Excel/PDF for taxes

### Phase 3: Advanced Features
- [ ] Receipt photo upload using camera
- [ ] Recurring expense automation
- [ ] Maintenance reminders based on km/date
- [ ] Daily revenue goals with progress tracking
- [ ] Earnings calendar view
- [ ] Break-even analysis

### Phase 4: Business Intelligence
- [ ] Predictive analytics for best hours
- [ ] Weather impact on earnings
- [ ] Event correlation with revenue
- [ ] Competitor zone analysis
- [ ] Customer tracking (frequent passengers)
- [ ] Route optimization suggestions

---

## 📝 Notes

- All data stored in Supabase with device_id
- Works offline with service worker
- PWA enabled for installation
- Fully responsive design
- Dark mode compatible
- TypeScript for type safety

---

**Built with:** React, TypeScript, Vite, Tailwind CSS, shadcn/ui, Supabase, Capacitor
**Co-Authored-By:** Claude Sonnet 4.5


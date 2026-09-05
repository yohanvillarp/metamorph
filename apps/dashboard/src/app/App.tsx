import { DashboardPage } from '@/pages/dashboard/ui/DashboardPage';
import { AlertProvider } from '@/shared/store/alertStore';
import { GlobalAlert } from '@/shared/ui/GlobalAlert';

export const App = () => {
  return (
    <AlertProvider>
      <div className="bg-neo-bg text-neo-text min-h-screen">
        <DashboardPage />
        <GlobalAlert />
      </div>
    </AlertProvider>
  )
}

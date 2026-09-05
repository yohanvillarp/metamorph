import type { ReactNode } from 'react';
import { createContext, useContext, useState } from 'react';

type AlertType = 'alert' | 'confirm';

interface AlertState {
  isOpen: boolean;
  type: AlertType;
  title: string;
  message: ReactNode;
  onConfirm?: () => void;
  onCancel?: () => void;
}

interface AlertStore extends AlertState {
  showAlert: (title: string, message: ReactNode, onConfirm?: () => void) => void;
  showConfirm: (title: string, message: ReactNode, onConfirm: () => void, onCancel?: () => void) => void;
  close: (confirmed: boolean) => void;
}

const AlertContext = createContext<AlertStore | null>(null);

export const AlertProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<AlertState>({
    isOpen: false,
    type: 'alert',
    title: '',
    message: '',
  });

  const showAlert = (title: string, message: ReactNode, onConfirm?: () => void) => {
    setState({ isOpen: true, type: 'alert', title, message, onConfirm });
  };

  const showConfirm = (title: string, message: ReactNode, onConfirm: () => void, onCancel?: () => void) => {
    setState({ isOpen: true, type: 'confirm', title, message, onConfirm, onCancel });
  };

  const close = (confirmed: boolean) => {
    if (confirmed && state.onConfirm) state.onConfirm();
    if (!confirmed && state.onCancel) state.onCancel();
    setState(prev => ({ ...prev, isOpen: false }));
  };

  return (
    <AlertContext.Provider value={{ ...state, showAlert, showConfirm, close }}>
      {children}
    </AlertContext.Provider>
  );
};

export const useAlertStore = () => {
  const context = useContext(AlertContext);
  if (!context) throw new Error('useAlertStore must be used within an AlertProvider');
  return context;
};

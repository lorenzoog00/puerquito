import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from "react";

type Toast = { id: number; message: string; undo?: () => void };
const Ctx = createContext<{ notify: (message: string, undo?: () => void) => void }>(null!);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const notify = useCallback((message: string, undo?: () => void) => {
    const id = Date.now();
    setToast({ id, message, undo });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast((t) => (t && t.id === id ? null : t)), 5000);
  }, []);

  return (
    <Ctx.Provider value={{ notify }}>
      {children}
      {toast && (
        <div className="toast">
          <span>{toast.message}</span>
          {toast.undo && (
            <button
              className="toast-undo"
              onClick={() => {
                toast.undo!();
                setToast(null);
              }}
            >
              Deshacer
            </button>
          )}
        </div>
      )}
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);

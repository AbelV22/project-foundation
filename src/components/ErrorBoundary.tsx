import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary component that catches JavaScript errors in child components.
 * Displays a fallback UI with retry functionality.
 */
export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        errorInfo: null,
    };

    public static getDerivedStateFromError(error: Error): Partial<State> {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        console.error('[ErrorBoundary] Caught error:', error, errorInfo);
        this.setState({ errorInfo });
        this.props.onError?.(error, errorInfo);
    }

    private handleRetry = (): void => {
        this.setState({ hasError: false, error: null, errorInfo: null });
    };

    public render(): ReactNode {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="min-h-[200px] flex flex-col items-center justify-center p-6 text-center">
                    <div className="bg-red-500/10 rounded-full p-4 mb-4">
                        <AlertTriangle className="h-8 w-8 text-red-400" />
                    </div>
                    <h2 className="text-lg font-semibold text-white mb-2">
                        Algo salió mal
                    </h2>
                    <p className="text-sm text-muted-foreground mb-4 max-w-md">
                        Ha ocurrido un error inesperado. Por favor, intenta de nuevo.
                    </p>
                    {this.state.error && (
                        <p className="text-xs text-red-400 mb-4 font-mono bg-red-500/10 px-3 py-2 rounded max-w-md truncate">
                            {this.state.error.message}
                        </p>
                    )}
                    <button
                        onClick={this.handleRetry}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-black rounded-lg font-medium hover:bg-primary/90 transition-colors"
                    >
                        <RefreshCw className="h-4 w-4" />
                        Reintentar
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

/**
 * Functional wrapper for easier use with hooks
 */
interface ErrorFallbackProps {
    error: Error | null;
    resetError: () => void;
    title?: string;
    message?: string;
}

export function ErrorFallback({
    error,
    resetError,
    title = 'Error al cargar datos',
    message = 'No se pudo cargar la información. Comprueba tu conexión e intenta de nuevo.',
}: ErrorFallbackProps): JSX.Element {
    return (
        <div className="flex flex-col items-center justify-center p-6 text-center card-glass rounded-xl">
            <div className="bg-red-500/10 rounded-full p-3 mb-3">
                <AlertTriangle className="h-6 w-6 text-red-400" />
            </div>
            <h3 className="text-base font-semibold text-white mb-1">{title}</h3>
            <p className="text-sm text-muted-foreground mb-3">{message}</p>
            {error && (
                <p className="text-[10px] text-red-400 mb-3 font-mono bg-red-500/10 px-2 py-1 rounded max-w-full truncate">
                    {error.message}
                </p>
            )}
            <button
                onClick={resetError}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-black rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
            >
                <RefreshCw className="h-3.5 w-3.5" />
                Reintentar
            </button>
        </div>
    );
}

export default ErrorBoundary;

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MapPin } from "lucide-react";

interface LocationDisclosureDialogProps {
    open: boolean;
    onAccept: () => void;
}

export function LocationDisclosureDialog({ open, onAccept }: LocationDisclosureDialogProps) {
    return (
        <AlertDialog open={open}>
            <AlertDialogContent className="max-w-[90%] md:max-w-md rounded-2xl">
                <AlertDialogHeader>
                    <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                        <MapPin className="h-6 w-6 text-primary" />
                    </div>
                    <AlertDialogTitle className="text-center">Uso de tu Ubicación</AlertDialogTitle>
                    <AlertDialogDescription className="text-center space-y-3">
                        <p>
                            Para que el "Modo Radar" funcione correctamente y detecte cuando entras o sales del aeropuerto (T1, T2) o estación de Sants, <strong>iTaxi BCN necesita acceder a tu ubicación en segundo plano</strong>.
                        </p>
                        <p className="text-xs bg-muted p-3 rounded-lg text-left">
                            Esto significa que la app recopilará datos de ubicación incluso cuando la aplicación esté cerrada o no se esté usando.
                        </p>
                        <p className="text-xs text-muted-foreground">
                            Estos datos se usan exclusivamente para calcular tiempos de espera en tiempo real. No se comparten con terceros para publicidad.
                        </p>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogAction onClick={onAccept} className="w-full">
                        Entendido, activar radar
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

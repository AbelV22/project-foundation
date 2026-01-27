import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

const PrivacyPolicy = () => {
    return (
        <div className="min-h-screen bg-background p-4 md:p-8">
            <div className="max-w-2xl mx-auto space-y-6">
                <Link to="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors">
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    Volver
                </Link>

                <h1 className="text-3xl font-bold tracking-tight text-foreground">Política de Privacidad</h1>
                <p className="text-sm text-muted-foreground">Última actualización: {new Date().toLocaleDateString()}</p>

                <div className="prose prose-sm dark:prose-invert max-w-none space-y-4">
                    <section>
                        <h2 className="text-xl font-semibold text-foreground">1. Introducción</h2>
                        <p className="text-muted-foreground">
                            Esta aplicación ("App") está diseñada para el uso profesional por taxistas en Barcelona.
                            Nos tomamos muy en serio la privacidad de sus datos.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-foreground">2. Uso de la Ubicación en Segundo Plano</h2>
                        <div className="bg-primary/10 border border-primary/20 p-4 rounded-lg my-4">
                            <p className="font-medium text-foreground">Aviso Importante sobre Localización</p>
                            <p className="text-muted-foreground text-sm mt-1">
                                Esta aplicación recopila datos de ubicación <strong>incluso cuando la aplicación está cerrada o no se está utilizando</strong>
                                para permitir la función de "Detección Automática de Zonas de Espera" y calcular tiempos de espera estimados en el Aeropuerto y Estaciones.
                            </p>
                        </div>
                        <p className="text-muted-foreground">
                            Utilizamos estos datos para:
                        </p>
                        <ul className="list-disc pl-5 text-muted-foreground space-y-1">
                            <li>Detectar automáticamente cuando entra a una zona de espera (T1, T2, Sants).</li>
                            <li>Calcular su tiempo de espera real para compartirlo con la comunidad.</li>
                            <li>Registrar su historial de servicios (opcional).</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-foreground">3. Datos Recopilados</h2>
                        <p className="text-muted-foreground">
                            Solo recopilamos:
                        </p>
                        <ul className="list-disc pl-5 text-muted-foreground space-y-1">
                            <li>Coordenadas GPS (Latitud, Longitud, Precisión).</li>
                            <li>Identificador de dispositivo anónimo.</li>
                            <li>Información técnica básica del dispositivo (Modelo, Batería).</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-foreground">4. Compartir Datos</h2>
                        <p className="text-muted-foreground">
                            Sus datos de ubicación se procesan de forma anónima para generar estadísticas comunitarias (tiempos de espera).
                            No compartimos sus datos personales con terceros para fines publicitarios.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-foreground">5. Contacto</h2>
                        <p className="text-muted-foreground">
                            Si tiene preguntas sobre esta política, contáctenos en soporte@itaxibcn.com.
                        </p>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default PrivacyPolicy;

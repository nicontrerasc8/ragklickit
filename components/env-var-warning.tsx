import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

export function EnvVarWarning() {
  return (
    <div className="flex items-center gap-3">
      <Badge variant="outline" className="hidden font-normal sm:inline-flex">
        Configura variables de entorno
      </Badge>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" disabled>
          Ingresar
        </Button>
        <Button size="sm" variant="default" disabled>
          Crear cuenta
        </Button>
      </div>
    </div>
  );
}

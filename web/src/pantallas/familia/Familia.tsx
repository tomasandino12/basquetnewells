import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { Users } from 'lucide-react';
import escudo from '../../../../public/escudo.png';
import { Boton } from '../../components/ui/button';
import { Consulta } from '../../components/ui/consulta';
import { Vacio } from '../../components/ui/estados';
import { Pagina } from '../../components/ui/pagina';
import { useSesion } from '../../datos/contexto';
import { useMisChicos } from '../../familias/consultas';
import { GuiaDePrimerUso } from '../../guia/GuiaDePrimerUso';
import { BotonSalir, BotonTema } from '../../laboratorio';
import { aplicarTema, guardarTema, leerTema, type Tema } from '../../tema';
import { PasosDeCuenta } from '../cuenta/PasosDeCuenta';

/**
 * El marco del portal de familias: sólo el escudo, salir y el tema. Una familia ve únicamente a sus hijos
 * vinculados (nombre y categoría): nada de partidos, mediciones ni misiones, y eso lo impone la base, no esta pantalla.
 */
export function MarcoFamilia() {
  const [tema, setTema] = useState<Tema>(leerTema);
  useEffect(() => aplicarTema(tema), [tema]);
  const cambiarTema = () =>
    setTema((t) => {
      const otro: Tema = t === 'oscuro' ? 'claro' : 'oscuro';
      guardarTema(otro);
      return otro;
    });
  return (
    <div className="min-h-svh">
      <header className="sticky top-0 z-20 flex h-12 items-center justify-between border-b-2 border-club bg-negro pr-1 pl-4 print:hidden">
        <div className="flex items-center gap-2">
          <img src={escudo} alt="" width={24} height={24} className="size-6" />
          <p className="font-titulo text-lg leading-none font-bold tracking-wide text-sobre-negro uppercase">Semillero</p>
        </div>
        <div className="flex items-center">
          <BotonSalir compacto />
          <BotonTema tema={tema} alCambiar={cambiarTema} />
        </div>
      </header>
      <div className="entra pb-12">
        <RequiereSesionDeFamilia>
          <Pagina>
            <Outlet />
          </Pagina>
          <GuiaDePrimerUso modo="familia" />
        </RequiereSesionDeFamilia>
      </div>
    </div>
  );
}

function RequiereSesionDeFamilia({ children }: { children: React.ReactNode }) {
  const { estado, error, reintentar } = useSesion();
  const lugar = useLocation();
  if (estado === 'sin-sesion') return <Navigate to="/entrar" replace state={{ desde: lugar.pathname }} />;
  if (estado !== 'con-sesion') {
    return (
      <Pagina>
        <Consulta
          consulta={{ isPending: estado === 'cargando', isError: estado === 'error', error, data: undefined, refetch: reintentar }}
          errorGenerico="No pudimos revisar tu sesión"
          conTitulo
          filas={3}
        >
          {() => null}
        </Consulta>
      </Pagina>
    );
  }
  return <PasosDeCuenta sinAcceso>{children}</PasosDeCuenta>;
}

const PASOS_PARA_ANOTAR = (email: string | undefined) => (
  <section aria-label="Cómo anotar a tu hijo" className="mt-6 rounded-tarjeta border border-linea p-4">
    <h2 className="font-titulo text-2xl leading-none font-semibold uppercase">Cómo anotar a tu hijo</h2>
    <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm">
      <li>Entrá a la página del básquet y completá el <b>formulario de inscripción</b>.</li>
      <li>Poné este mismo mail: <b>{email ?? 'el de tu cuenta'}</b>.</li>
      <li>El club carga la inscripción y tu hijo aparece acá. Puede tardar unos días.</li>
    </ol>
    <p className="mt-3 text-sm text-gris">Los documentos (DNI y fotos) también se suben por la página del básquet, no por WhatsApp.</p>
  </section>
);

/** Lo único que ve una familia: sus hijos vinculados, con nombre y categoría. */
export function FamiliaChicos() {
  const chicos = useMisChicos();
  const { sesion } = useSesion();
  const email = sesion?.user.email;
  return (
    <>
      <h1 className="font-titulo text-4xl leading-none font-bold tracking-wide uppercase">Tus chicos</h1>
      <div className="mt-4">
        <Consulta consulta={chicos} errorGenerico="No se pudo cargar. Probá de nuevo en un rato." conTitulo={false} filas={3}>
          {(lista) =>
            lista.length === 0 ? (
              <>
                <Vacio icono={Users} titulo="Todavía no encontramos a tu hijo" accion={<Boton variante="contorno" onClick={() => void chicos.refetch()}>Volver a mirar</Boton>}>
                  Si ya lo anotaste, el club lo carga en unos días. Si pasó tiempo y no aparece, avisale al coordinador.
                </Vacio>
                {PASOS_PARA_ANOTAR(email)}
              </>
            ) : (
              <>
                <ul aria-label="Tus chicos" className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {lista.map((c) => (
                    <li key={c.vinculoId ?? c.nombre} className="rounded-tarjeta border border-linea bg-sup p-4">
                      <p className="font-titulo text-2xl leading-none font-semibold">{c.nombre}</p>
                      <p className="mt-1 text-sm text-gris">{c.categorias ?? 'Todavía sin categoría'} · {c.clubNombre}</p>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-sm text-gris">Si falta alguno, avisale al coordinador del club.</p>
                {PASOS_PARA_ANOTAR(email)}
              </>
            )
          }
        </Consulta>
      </div>
    </>
  );
}

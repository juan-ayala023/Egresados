# Despliegue de Homecoming 80

Guía para poner el sitio y la API en el servidor del colegio. Escrita para que
la siga TI sin tener que preguntar nada.

El servidor es `cseventos`, el mismo donde ya viven los eventos de teatro,
carreras, camp y la fundación. Todo cuelga de `/home/eventos`.

---

## En qué se parece y en qué NO se parece a los otros eventos

Se parece en casi todo: mismo servidor, mismo usuario `eventos`, mismo nginx,
systemd para los procesos, y un subdominio propio bajo `columbus.edu.co`.

**La diferencia está en la forma del front.**

Los sitios de Run, Teatro y Camp están hechos con React y Vite. Se compilan a
una carpeta `dist` con archivos sueltos y nginx los sirve directamente. No hay
ningún proceso corriendo para el front.

Homecoming está hecho con **Next.js sin exportación estática**, así que necesita
su propio proceso Node vivo. Y su backend es **Node**, no Python.

Resultado: donde los otros eventos tienen un bloque de nginx con un `root` y un
`proxy_pass` al backend de Python, Homecoming tiene **dos servicios de systemd y
dos `proxy_pass`**, y ningún `root`.

| | Otros cuatro eventos | Homecoming |
|---|---|---|
| Front | archivos estáticos en `dist` | proceso Next.js en el 3000 |
| Backend | FastAPI (Python) compartido | Node propio en el 4000 |
| Servicios systemd | `gunicorn` (uno, compartido) | `homecoming-web` y `homecoming-api` |
| Base de datos | SQL Server del colegio | SQLite local, un archivo |

Homecoming **no escribe** en el SQL Server del colegio. Solo lee una fila de
`ecampus.dbo.school_services` para la configuración contable. Sus órdenes,
boletas y pagos viven en su propio archivo SQLite.

---

## Lo que hace falta antes de empezar

1. **El subdominio.** Siguiendo el patrón de los otros:
   `tcshomecoming.columbus.edu.co`, apuntando a la IP de `cseventos`.
2. **Node 18.17 o superior** en el servidor. Comprobar con `node -v`.
3. **Los secretos de Wompi** en el `.env` del backend.
4. **La cuenta de correo** de Homecoming, con SPF y DKIM en el dominio.

---

## Pasos

### 1. Traer el código

```bash
cd /home/eventos
git clone <repo> homecoming
cd homecoming
```

Queda así:

```
/home/eventos/homecoming/                    ← front Next.js
/home/eventos/homecoming/back-homeparty-main/ ← backend Node
/home/eventos/homecoming/despliegue/          ← esta carpeta
```

### 2. Configurar el backend

```bash
cd /home/eventos/homecoming/back-homeparty-main
cp .env.example .env
nano .env
```

Lo que hay que cambiar sí o sí:

```bash
NODE_ENV=production
PUBLIC_URL=https://tcshomecoming.columbus.edu.co
CORS_ORIGINS=https://tcshomecoming.columbus.edu.co
WOMPI_REDIRECT_URL=https://tcshomecoming.columbus.edu.co/pago/resultado

WOMPI_SIMULACION=false
WOMPI_PUBLIC_KEY=pub_prod_...
WOMPI_INTEGRITY_SECRET=prod_integrity_...
WOMPI_EVENTS_SECRET=prod_events_...

SMTP_HOST=smtp.gmail.com
SMTP_USER=<la cuenta de Homecoming>
SMTP_PASS=<su contraseña de aplicación>
MAIL_FROM=Homecoming 80 Anos <la cuenta de Homecoming>
```

Y **generar un QR_SECRET propio para producción**:

```bash
npm run generar-qr-secret
```

> Cambiar esa llave después de haber emitido boletas **las invalida todas**.
> Ningún QR ya enviado volvería a servir en la puerta. Se genera una vez, antes
> de abrir la venta, y no se toca más.

Instalar y comprobar que arranca:

```bash
npm ci
npm test
node -e "import('./src/config.js').then(m=>{m.revisarConfiguracion();console.log('config OK')})"
```

Ese último comando revisa el `.env` y lista **todo** lo que falta de una vez, en
vez de fallar en lo primero que encuentre. Si dice `config OK`, sigue.

### 3. Compilar el front

```bash
cd /home/eventos/homecoming
cp .env.example .env.local
nano .env.local
```

Dejar la variable **vacía**:

```bash
NEXT_PUBLIC_API_URL=
```

No es un olvido. Next.js incrusta las variables `NEXT_PUBLIC_*` dentro del
JavaScript al compilar, no las lee al arrancar. Vacía, las llamadas quedan
relativas (`/api/evento`), nginx las enruta al backend por el mismo dominio, no
hay CORS de por medio, y el dominio no queda quemado en el bundle.

```bash
npm ci
npm run build
```

### 4. Los dos servicios

```bash
cd /home/eventos/homecoming/despliegue
sudo cp homecoming-api.service homecoming-web.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now homecoming-api homecoming-web
sudo systemctl status homecoming-api homecoming-web
```

Comprobar que responden antes de tocar nginx:

```bash
curl -s localhost:4000/api/evento | head -c 200
curl -s -o /dev/null -w "%{http_code}\n" localhost:3000
```

### 5. Nginx

```bash
sudo cp nginx-homecoming.conf /etc/nginx/sites-available/homecoming
sudo ln -s /etc/nginx/sites-available/homecoming /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 6. Certificado

```bash
sudo certbot --nginx -d tcshomecoming.columbus.edu.co
```

### 7. Comprobar de punta a punta

```bash
curl -s https://tcshomecoming.columbus.edu.co/api/evento
```

Y en un navegador: entrar al sitio, hacer una compra de prueba, revisar que
llegue el correo con el QR, y escanear ese QR en `/puerta`.

---

## Después de desplegar

**Respaldos.** La base es un archivo. Si se pierde, se perdieron las 500 boletas
vendidas y no hay forma de reconstruir quién compró qué.

```bash
crontab -e
```

```
0 */6 * * * cd /home/eventos/homecoming/back-homeparty-main && npm run respaldo
```

Cada 6 horas. Y conviene que alguien se lleve una copia fuera del servidor: un
respaldo que vive en el mismo disco que la base no protege de que se dañe el
disco.

**Los tokens de `/admin` y `/puerta`.** Están en el `.env`. Quien esté en la
entrada el día del evento necesita el de puerta. Se pasan por un canal privado,
no por WhatsApp de grupo.

**Los logs.**

```bash
sudo journalctl -u homecoming-api -f
sudo journalctl -u homecoming-web -f
```

---

## Si algo falla

**El backend no arranca.** Casi siempre es el `.env`. `journalctl -u
homecoming-api -n 50` muestra la lista exacta de lo que falta: el arranque está
escrito para reportar todos los problemas juntos, no el primero.

**El sitio carga pero no puede comprar.** El front llega y el backend no.
Comprobar `curl localhost:4000/api/evento` en el servidor, y que el bloque
`location /api/` de nginx esté antes del `location /`.

**Alguien paga y no le llega la boleta.** Mirar `SMTP_HOST` en el `.env`. Sin
él configurado, el backend guarda los correos en `datos/correos/` en vez de
enviarlos — no se pierde nada, pero nadie recibe su entrada. Si el SMTP está
bien, revisar que el dominio tenga SPF y DKIM: sin eso los correos con QR se van
a spam.

**Se perdió un webhook de Wompi.** No hay que hacer nada: el barrido de
reconciliación le pregunta a Wompi por las órdenes que quedaron pendientes y las
resuelve solo. Se puede ver desde `/admin`.

# Despliegue en el servidor del colegio

Homecoming vive en **el mismo servidor de los otros eventos del colegio**
(`cseventos`, `10.90.11.180`): el de teatro, carreras y camp. Ahí ya hay nginx,
pm2 y Node 20, y desde ahí responden SIESA y el SQL Server. Homecoming entra
**al lado** de lo que hay, con el mismo patrón: un `server_name` propio en
nginx y dos procesos más en pm2.

**Regla número uno: ahí no se rompe nada.** Todo lo de abajo está pensado para
convivir. Ningún paso reinicia nginx (se usa `reload`), ninguno toca los
procesos de los otros eventos, y ninguno reinicia el servidor.

Cómo queda:

```
internet ──HTTPS──▶ borde del colegio ──80──▶ nginx (cseventos)
                                               ├─ tcsteatro.columbus.edu.co  → (lo de ellos, sin tocar)
                                               ├─ tcsrun / tcscamp / fundaciontcs → (idem)
                                               └─ homecomingtcs.columbus.edu.co
                                                    ├─ /api/  → 127.0.0.1:4000  pm2: homecoming-api
                                                    └─ /      → 127.0.0.1:3002  pm2: homecoming-web
```

Sitio y API en **un solo dominio**: sin CORS, sin Vercel, sin túneles.

---

## 0. Lo que tiene que existir antes (no depende de nosotros)

| Quién | Qué |
|---|---|
| **TI** | `homecomingtcs.columbus.edu.co` apuntando a este servidor, **igual que `tcsteatro.columbus.edu.co`**, y con HTTPS en el borde para ese nombre. Es el mismo trámite que se hizo para los otros eventos. |
| **Tesorería** | Las 4 llaves de **producción** de Wompi (`pub_prod_`, `prv_prod_`, `prod_integrity_`, `prod_events_`). |
| **TI** | La clave de aplicación de `HomecomingTCS@columbus.edu.co` (ya la tenemos). SPF y DKIM del dominio (pendiente). |

Sin lo de TI se puede dejar todo montado, pero nadie llega al sitio.

---

## 1. Clonar

Como el usuario `eventos`, en su carpeta, igual que los otros proyectos:

```bash
cd ~
git clone https://github.com/juan-ayala023/Egresados.git homecoming
cd homecoming
mkdir -p logs
```

## 2. Backend

```bash
cd ~/homecoming/back-homeparty-main
npm ci --omit=dev
cp ../deploy/env.produccion.ejemplo .env
nano .env
```

En `nano`, rellenar **solo** lo que está entre `< >`:

- Las 4 de Wompi.
- `SMTP_PASS`, `MSSQL_USER`, `MSSQL_PASSWORD` (los mismos que en pruebas).
- `QR_SECRET` y `ADMIN_TOKEN`: **generarlos aquí**, no copiar los de pruebas:

```bash
node -e "console.log('QR_SECRET=' + require('crypto').randomBytes(32).toString('base64url'))"
node -e "console.log('ADMIN_TOKEN=' + require('crypto').randomBytes(24).toString('base64url'))"
```

> `QR_SECRET` se pone **una sola vez y no se cambia nunca más**: cambiarlo
> invalida todas las boletas ya emitidas.

Revisar que todo esté bien **antes** de arrancar nada:

```bash
npm run revisar-produccion
```

Tiene que decir `[ok]` en Wompi (con llaves de producción), correo y SIESA.
Si algo sale `[ojo]`, se arregla antes de seguir.

## 3. Front

```bash
cd ~/homecoming
npm ci
cat > .env.local <<'EOF'
NEXT_PUBLIC_API_URL=https://homecomingtcs.columbus.edu.co
NEXT_PUBLIC_SITIO_URL=https://homecomingtcs.columbus.edu.co
EOF
NODE_OPTIONS=--max-old-space-size=2048 npm run build
```

`NEXT_PUBLIC_*` se lee **al compilar**: si algún día cambia, hay que volver a
correr `npm run build`.

## 4. Arrancar los dos procesos

```bash
cd ~/homecoming
pm2 start deploy/ecosystem.config.cjs
pm2 save
pm2 status
```

Tienen que aparecer `homecoming-api` y `homecoming-web` en `online`, **al
lado** de lo que ya había. Comprobar desde el propio servidor:

```bash
curl -s http://127.0.0.1:4000/api/evento | head -c 200; echo
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3002/
```

### 4b. Verificar `TRUST_PROXY` — esto NO se puede saltar

Detrás de Node hay dos capas (el borde HTTPS y nginx). Los límites por IP
(10 compras por IP cada 10 minutos) usan la IP que Node cree que tiene el
cliente. Si Node ve la IP de nginx o del borde **para todo el mundo**, a la
undécima compra de la ciudad el sistema dice "demasiadas peticiones".

Con el dominio ya apuntado, abrir el sitio desde **dos celulares con datos
(no wifi del colegio)** y mirar el log:

```bash
pm2 logs homecoming-api --lines 20 | grep "ip="
```

- Si los dos celulares salen con **IPs distintas** → bien, seguir.
- Si salen con **la misma** (y es `127.0.0.1` o una interna) → en el `.env`
  poner `TRUST_PROXY=2` y `pm2 restart homecoming-api`. Volver a mirar.

## 5. nginx

```bash
sudo cp ~/homecoming/deploy/nginx-homecoming.conf /etc/nginx/sites-available/homecoming
sudo ln -s /etc/nginx/sites-available/homecoming /etc/nginx/sites-enabled/homecoming
sudo nginx -t
```

**Si `nginx -t` no dice `syntax is ok` y `test is successful`, NO seguir**:
borrar el enlace de `sites-enabled` y revisar. Un nginx con la configuración
rota no arranca, y eso tumba los otros eventos.

```bash
sudo systemctl reload nginx
```

`reload`, no `restart`: no corta ninguna conexión en curso.

> Si nginx del colegio no usa `sites-enabled` sino un solo `nginx.conf` (hay
> uno en `~/nginx.conf`), el bloque de `deploy/nginx-homecoming.conf` se pega
> dentro del `http { }` de ese archivo, al lado de los otros `server { }`.

## 6. Probar de verdad

Con TI ya apuntando el dominio:

1. Abrir `https://homecomingtcs.columbus.edu.co` desde un celular con datos
   (no desde la red del colegio).
2. Comprar **una** boleta con una tarjeta real. Es una venta real: se puede
   anular desde el panel después, pero el cobro hay que reversarlo en Wompi.
3. No tocar nada después de pagar. El correo tiene que llegar solo.
4. Entrar al panel `https://homecomingtcs.columbus.edu.co/admin` con el
   `ADMIN_TOKEN` nuevo y ver la venta.

## 7. Wompi: la URL de eventos

En el panel de Wompi, **Desarrolladores → URL de eventos**:

```
https://homecomingtcs.columbus.edu.co/api/webhooks/wompi
```

Es **una sola por comercio**, y hoy la tiene la plataforma del colegio. Si no
se puede cambiar, no pasa nada grave: el backend pregunta a Wompi cada minuto
por las órdenes pendientes y la boleta sale igual, con hasta un minuto de
demora. Pero con la URL puesta sale al instante.

## 8. Respaldo diario de la base

La base es **un archivo**. Si se pierde, se pierden las boletas. Como
`eventos`, `crontab -e` y agregar:

```
0 3 * * * cd /home/eventos/homecoming/back-homeparty-main && npm run respaldo -- --carpeta /home/eventos/respaldos-homecoming >> /home/eventos/homecoming/logs/respaldo.log 2>&1
```

## 9. Actualizar después

```bash
cd ~/homecoming
git pull
cd back-homeparty-main && npm ci --omit=dev && cd ..
npm ci && NODE_OPTIONS=--max-old-space-size=2048 npm run build
pm2 restart homecoming-api homecoming-web
```

Las migraciones de la base corren solas al arrancar el backend.

---

## Si algo se rompe

```bash
pm2 logs homecoming-api --lines 100     # que dice el backend
pm2 logs homecoming-web --lines 100     # que dice el sitio
sudo tail -50 /var/log/nginx/error.log  # que dice nginx
```

Para **apagar Homecoming sin tocar lo demás**:

```bash
pm2 stop homecoming-api homecoming-web
```

Los otros eventos siguen como si nada.

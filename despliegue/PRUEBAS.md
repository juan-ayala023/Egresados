# Pruebas antes de abrir la venta

Qué está probado, qué falta probar, y qué **no se puede** probar antes de que
haya gente comprando de verdad.

Se venden 500 boletas de $86.634 a egresados de un colegio, en un evento que
pasa una sola vez. No hay segunda oportunidad para arreglar un cobro mal hecho
ni para una boleta que no llegó.

---

## Fase 0 — Lo que ya corre solo

```bash
cd back-homeparty-main
npm test
```

**65 pruebas.** Cubren la venta con aforo y límite acumulado por cédula, el
webhook y su idempotencia, la firma de integridad y el checksum, la
reconciliación de pagos perdidos, la emisión y validación de QR, los reintentos
de correo, las alertas, y que el servidor se niegue a arrancar con el `.env`
incompleto.

Tres de ellas merecen mención porque prueban plata:

- `tarifa.test.js` — que el comprador pague 86.634 y no 80.000, que la tarifa se
  cobre por boleta y no por compra, y que a Wompi se le firme el total con
  tarifa. Un peso de diferencia entre lo firmado y lo cobrado hace que Wompi
  rechace el checkout.
- `concurrencia.test.js` — 40 compras simultáneas contra un aforo de 10. Vende
  exactamente 10. Es el escenario del primer minuto de venta, cuando se avisa
  por WhatsApp y entran todos a la vez.
- `bloque3.test.js` — que un webhook perdido no deje a nadie sin boleta: el
  barrido le pregunta a Wompi por las órdenes pendientes y las resuelve.

**Lo que las pruebas automáticas NO pueden ver:** si el correo llega, si el QR
escanea, si el checkout de Wompi acepta la firma, y si la pantalla se ve bien en
un teléfono. De eso trata el resto de este documento.

---

## Fase 1 — Hoy, sin depender de nadie

Con `WOMPI_SIMULACION=true`. Levanta los dos:

```bash
cd back-homeparty-main && npm run dev     # :4000
cd .. && npm run dev                      # :3000
```

### 1.1 La compra completa, en el navegador

Comprar 2 boletas en `localhost:3000`, pagar con el simulador, y revisar:

- [ ] El desglose muestra **$80.000 + $6.634 = $86.634** por boleta, y el total
      de 2 da **$173.268**.
- [ ] El formulario pide dirección y ciudad, y no deja seguir sin ellas.
- [ ] Al terminar, la página de resultado encuentra el pago.
- [ ] Llegan **2 boletas, una por asistente**, cada una con su QR.

Si el desglose no cuadra con lo que cobra Wompi después, el problema es que
`tarifaServicio` en `src/data.ts` y `BOLETA_TARIFA_COP` en el `.env` se
separaron. Hoy están las dos en 6634.

### 1.2 El correo y el PDF, de verdad

Sin `SMTP_HOST`, el backend guarda los correos en `datos/correos/` en vez de
enviarlos. Ábrelos con un navegador:

- [ ] El correo se lee bien y el QR se ve, no sale roto.
- [ ] El PDF adjunto abre y trae nombre, documento, fecha y lugar.
- [ ] **Imprime el PDF en papel** y compruébalo con el lector del teléfono. En
      la puerta va a haber gente con la boleta impresa.
- [ ] Ábrelo en un celular con el brillo bajo. Ahí es donde fallan los QR.

### 1.3 La puerta

En `localhost:3000/puerta` con el token de puerta:

- [ ] Un QR válido deja entrar.
- [ ] **El mismo QR dos veces no deja entrar la segunda.** Esta es la que evita
      que una boleta circule por WhatsApp entre varias personas.
- [ ] Un QR inventado se rechaza.
- [ ] **Con un escáner USB de verdad**, no copiando y pegando el código. Se
      comporta como un teclado, y si el foco se sale de la caja escribe en la
      nada y alguien pasa sin registrarse. Prueba a hacer clic fuera y escanear.
- [ ] **Sin red**: apaga el wifi del dispositivo de la puerta y escanea. La
      página descarga los tokens antes; si eso no funciona, un problema de
      internet en la entrada deja a 500 personas en la fila.

### 1.4 Las reglas del negocio

- [ ] Comprar 4 boletas con una cédula, y luego intentar 1 más con la misma:
      tiene que rechazarla. El límite es acumulado, no por compra.
- [ ] Poner `EVENTO_AFORO=3` en el `.env`, reiniciar, y vender hasta agotar:
      el sitio tiene que mostrar Sold Out solo.
- [ ] Poner `VENTA_APERTURA` en una fecha futura: no debe dejar comprar.
- [ ] En `/admin` con su token: exportar el CSV y comprobar que los datos
      cuadran con lo comprado.

### 1.5 Que se aguante un golpe

- [ ] Reinicia el backend **mientras** alguien está en el paso de pago. Al
      volver, la orden tiene que seguir ahí y poder resolverse.
- [ ] Borra `datos/homecoming.db` y arranca: tiene que crear la base sola.

---

## Fase 2 — Con los secretos de Wompi (Sandbox)

Requiere `test_integrity_...` y `test_events_...`. Poner
`WOMPI_SIMULACION=false` y arrancar.

**Esta fase es la que de verdad valida el cobro.** Todo lo anterior usa un
simulador escrito por nosotros; aquí es Wompi el que responde.

### Primero: el túnel, o nada de esto funciona

**Wompi rechaza con 403 cualquier `redirect-url` que apunte a `localhost` o
`127.0.0.1`.** Con `http` o con `https`, da igual — el checkout ni siquiera
abre, devuelve una página de error de CloudFront que no menciona el motivo.

Hay que exponer el puerto 3000 con un túnel público. En VS Code: pestaña
**Puertos** → reenviar el **3000** → clic derecho → **Visibilidad: Pública**. Si
queda en privada, Wompi recibe la pantalla de login de Microsoft en vez del
sitio.

Después, en el `.env` del backend:

```bash
WOMPI_REDIRECT_URL=https://xxxxx-3000.use2.devtunnels.ms/pago/resultado
CORS_ORIGINS=https://xxxxx-3000.use2.devtunnels.ms
```

Y reiniciar. La URL del túnel cambia cada vez que se levanta, así que hay que
actualizarla en cada sesión de pruebas.

- [ ] El backend arranca sin quejarse.
- [ ] Al pagar, **abre el checkout real de Wompi**. Si dice "firma inválida", el
      secreto de integridad está mal o no corresponde a la llave.
- [ ] **Tarjeta aprobada** → llegan las boletas.
- [ ] **Tarjeta rechazada** → la orden queda rechazada y **los cupos vuelven al
      inventario**. Comprobarlo en `/admin`: si no vuelven, se pierden boletas
      vendibles con cada rechazo.
- [ ] **PSE**, que es el caso incómodo: se demora, devuelve `PENDING` primero y
      se resuelve después. Hay que ver que la orden espere y no se dé por
      perdida.
- [ ] Dejar una compra a medias y no volver: pasada la reserva, el cupo se
      libera solo.

### El webhook

Sin un dominio público, Wompi no puede avisarle a `localhost`. Dos opciones:

1. **Sin webhook.** Es válido: la página de resultado le pregunta a Wompi
   directamente por el id de la transacción, y el barrido recoge lo que se
   pierda. Cubre casi todo.
2. **Con un túnel** (`ngrok`, o los devtunnels de VS Code que ya se usaron
   antes) para recibir eventos reales y comprobar el checksum contra el secreto
   de verdad.

Si se hace la 2, probar además:

- [ ] Un webhook con firma mala se rechaza con 401.
- [ ] El mismo evento dos veces no duplica boletas.

---

## Fase 3 — En el servidor, antes de abrir

Ya con el dominio, el certificado y las llaves de producción.

- [ ] `https://tcshomecoming.columbus.edu.co` carga y el candado es válido.
- [ ] `/api/evento` responde.
- [ ] **Una compra real, con una tarjeta real, de una boleta.** Se hace una vez,
      se comprueba que el dinero aparece en el panel de Wompi, y se anula. Es la
      única forma de saber que producción funciona.
- [ ] Esa compra tiene que llegar por correo **a Gmail y a Outlook**, y hay que
      revisar la carpeta de spam. Sin SPF y DKIM bien puestos, ahí es donde
      aterrizan los correos con adjuntos y códigos.
- [ ] Reiniciar el servidor entero y comprobar que los dos servicios vuelven
      solos: `sudo reboot`, y después `systemctl status homecoming-api
      homecoming-web`.
- [ ] Que el respaldo automático esté corriendo y **que el archivo se pueda
      abrir**. Un respaldo que nadie ha restaurado nunca no es un respaldo.
- [ ] `/admin` y `/puerta` responden desde fuera, con su token.

---

## Fase 4 — Ensayo con gente

Esto no se prueba con software.

- [ ] **Ensayo de puerta**: cinco personas con boletas de prueba, con el escáner
      y el dispositivo reales, en el sitio del evento. Mide cuánto tarda cada
      escaneo. Con 500 personas llegando en una hora, dos segundos de más por
      persona son veinte minutos de fila.
- [ ] Comprobar que hay **señal** donde va a estar la puerta. Si no la hay, el
      modo sin red deja de ser un extra y pasa a ser el plan principal.
- [ ] Que quien esté en la entrada sepa qué hacer cuando un QR no sirva: a quién
      llama, y cómo se verifica a alguien por cédula desde `/admin`.
- [ ] Batería. El dispositivo de la puerta tiene que aguantar toda la noche.

---

## Lo que no se puede probar antes, y hay que asumir

Vale más tenerlo escrito que descubrirlo el 14 de noviembre.

**La avalancha real.** La prueba de concurrencia dispara 40 peticiones desde la
misma máquina. Si se avisa a 800 egresados por WhatsApp al mismo tiempo, el
patrón es otro. El aforo está protegido con transacciones y eso sí está probado;
lo que no se sabe es cómo responde el servidor con esa carga.

**Que los correos no caigan en spam masivamente.** Se puede probar con dos o
tres cuentas. Enviar 500 correos con PDF adjunto desde una cuenta de Gmail en
pocos minutos es otra cosa: Gmail tiene límites de envío diario y puede cortar a
mitad. **Conviene preguntarle a TI qué límite tiene la cuenta institucional**, y
que el envío sea escalonado, no todo de golpe.

**El pago tardío de PSE.** Se puede simular, pero el caso real —el pago que
llega aprobado sobre una orden ya vencida y con el aforo lleno— depende de que
pase de verdad. Es la decisión que sigue abierta.

**El día del evento.** Nadie ha usado este sistema con 500 personas. Conviene
tener a alguien con acceso a `/admin` durante la entrada, no solo el escáner.

---

## Orden sugerido

1. **Ahora**: Fase 1 completa. No depende de nadie y saca los errores tontos.
2. **Cuando lleguen los secretos**: Fase 2. Ahí se sabe si el cobro funciona.
3. **Cuando haya dominio**: Fase 3.
4. **La semana antes del evento**: Fase 4, en el sitio.

Las fases 1 y 2 se hacen en un día cada una. La 4 hay que agendarla con el
colegio, y es la que más se olvida.
